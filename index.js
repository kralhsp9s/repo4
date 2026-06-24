require('dotenv').config();
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const util = require('minecraft-server-util');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let bot = null;
let botStartTime = null;
let jumpInterval = null;
let moveInterval = null;
let reconnectTimeout = null;

// --- PROSES HATA YAKALAYICILAR (Çökmeyi Önler) ---
process.on('uncaughtException', (err) => {
    console.log("⚠️ Kritik Sistem Hatası:", err.message);
});

process.on('unhandledRejection', (err) => {
    console.log("⚠️ Çözülemeyen Promise Hatası:", err);
});

// --- EXPRESS AYARLARI ---
app.use(express.json());

// Ana dizindeki index.html dosyasını güvenli şekilde açar
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'bot-panel-gizli-sifre', 
    resave: false,
    saveUninitialized: true
}));

// --- YARDIMCI FONKSİYONLAR ---
function randomNick() {
    const a = ["Void","Shadow","Venom","Blaze","Frost","Storm","Night","Phantom","Rogue","Nova"];
    const b = ["Hunter","Strike","Soul","Reaper","Walker","Slayer","Pulse","Rider","Claw"];
    return a[Math.floor(Math.random() * a.length)] +
           b[Math.floor(Math.random() * b.length)] +
           Math.floor(Math.random() * 900 + 100);
}

// --- ANTI-AFK HAREKET MEKANİZMASI ---
function startActions() {
    startJumping();
    startMoving();
    
    // Anti-AFK kafa sallama hareketi
    setInterval(() => {
        if (bot && bot.entity) {
            bot.look(bot.entity.yaw + 0.1, bot.entity.pitch);
        }
    }, 15000);
}

function stopActions() {
    if (jumpInterval) clearInterval(jumpInterval);
    if (moveInterval) clearInterval(moveInterval);
    jumpInterval = null;
    moveInterval = null;
}

function startJumping() {
    jumpInterval = setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('jump', true);
        setTimeout(() => { if (bot) bot.setControlState('jump', false); }, 300);
    }, 4000);
}

function startMoving() {
    const dirs = ['forward', 'back', 'left', 'right'];
    moveInterval = setInterval(() => {
        if (!bot || !bot.entity) return;
        dirs.forEach(d => bot.setControlState(d, false));
        const d = dirs[Math.floor(Math.random() * dirs.length)];
        bot.setControlState(d, true);
        setTimeout(() => { if (bot) bot.setControlState(d, false); }, 1500);
    }, 5000);
}

// --- MINEFLAYER BOT OLUŞTURMA ---
function createBot() {
    stopActions();

    const config = {
        host: process.env.MC_HOST || "izmirr.aternos.me",
        port: parseInt(process.env.MC_PORT) || 25565, 
        username: randomNick(),
        checkTimeoutInterval: 90000, // Zaman aşımı toleransı (Hugging Face için yüksek tutuldu)
        keepAlive: true,             // Bağlantıyı diri tutar
        version: "1.20.1"
    };

    console.log(`[🤖] Bağlanıyor... Kullanıcı Adı: ${config.username}`);
    bot = mineflayer.createBot(config);

    bot.once('spawn', () => {
        console.log("[🟢] Giriş başarılı! Dünyaya indim.");
        botStartTime = Date.now();
        startActions();
    });

    // --- CANLI CHAT LOG VE OTOMATİK GİRİŞ SİSTEMİ ---
    bot.on('messagestr', (message, position) => {
        if (position === 'game_info') return; // Action-bar yazılarını loglama

        // Web paneline mesajı gönder
        io.emit('chat-log', { username: '💬 Sunucu Akışı', message: message });

        // Otomatik Giriş/Kayıt Sistemi
        const msgLower = message.toLowerCase();
        if (msgLower.includes('/register') || msgLower.includes('kayıt') || msgLower.includes('kayit')) {
            bot.chat('/register Sifre1234 Sifre1234');
            console.log("[🔐] Sunucuya otomatik kayıt isteği gönderildi.");
        } else if (msgLower.includes('/login') || msgLower.includes('giriş') || msgLower.includes('giris')) {
            bot.chat('/login Sifre1234');
            console.log("[🔐] Sunucuya otomatik giriş isteği gönderildi.");
        }
    });

    bot.on('end', handleDisconnect);

    bot.on('error', (err) => {
        console.log("Bot Hata Alındı:", err.message);
    });
}

function handleDisconnect() {
    console.log("[🔴] Bağlantı koptu → 30 saniye sonra tekrar denenecek...");
    stopActions();

    if (reconnectTimeout) return;
    reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        createBot();
    }, 30000);
}

// 30 dakikada bir otomatik yenileme döngüsü
setInterval(() => {
    console.log("[🔄] 30 dakika doldu. Otomatik reset atılıyor...");
    if (bot) bot.end();
}, 30 * 60 * 1000);

// Başlatıcıyı Ateşle
createBot();

// --- API ROUTE'LARI ---

app.get('/api/server-info', async (req, res) => {
    try {
        const host = process.env.MC_HOST || "izmirr.aternos.me";
        const port = parseInt(process.env.MC_PORT) || 25565;
        const result = await util.status(host, port);
        const uptime = botStartTime ? Math.floor((Date.now() - botStartTime) / 1000 / 60) : 0;
        
        res.json({
            online: true,
            players: result.players.online,
            maxPlayers: result.players.max,
            samplePlayers: result.players.sample || [],
            version: result.version.name,
            motd: result.motd.clean,
            favicon: result.favicon,
            uptime: uptime
        });
    } catch (error) {
        res.json({ online: false });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || "admin";
    const adminPass = process.env.ADMIN_PASS || "admin123";

    if (username === adminUser && password === adminPass) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Hatalı giriş' });
    }
});

app.get('/api/check-auth', (req, res) => {
    res.json({ isAdmin: !!req.session.isAdmin });
});

// --- SOCKET.IO KONTROL İŞLEMLERİ ---
io.on('connection', (socket) => {
    socket.on('admin-action', (data) => {
        if (!bot) return;

        if (data.action === 'send-message') {
            bot.chat(data.message);
        } 
        else if (data.action === 'get-location') {
            if (bot.entity) {
                const pos = bot.entity.position;
                socket.emit('location-result', `X: ${pos.x.toFixed(2)}, Y: ${pos.y.toFixed(2)}, Z: ${pos.z.toFixed(2)}`);
            } else {
                socket.emit('location-result', "Konum alınamadı");
            }
        } 
        else if (data.action === 'eval-code') {
            try {
                let result = eval(data.code); 
                socket.emit('eval-result', String(result));
            } catch (err) {
                socket.emit('eval-result', `Hata: ${err.message}`);
            }
        }
    });
});

// --- WEB SUNUCUSUNU BAŞLAT ---
// Hugging Face 7860 portunu zorunlu kıldığı için isimlendirmeyi WEB_PORT yaparak çakışmaları tamamen bitirdik.
const WEB_PORT = process.env.PORT || 3000;
server.listen(WEB_PORT, () => {
    console.log(`[🚀] Web paneli aktif port: ${WEB_PORT}`);
});
