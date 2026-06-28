require('dotenv').config();
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const util = require('minecraft-server-util');
const path = require('path');

// Yeni Eklenen Paketler
const mineflayerViewer = require('prismarine-viewer').mineflayer;
const inventoryViewer = require('mineflayer-web-inventory');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let bot = null;
let botStartTime = null;
let jumpInterval = null;
let moveInterval = null;
let lookInterval = null;
let isShuttingDown = false; // Yeniden başlatma çakışmalarını önlemek için kilit

// --- PROSES HATA YAKALAYICILAR ---
process.on('uncaughtException', (err) => {
    if (err.code === 'EADDRINUSE') return; // Port çakışmalarını yoksay
    console.log("⚠️ Kritik Sistem Hatası:", err.message);
});

process.on('unhandledRejection', (err) => {
    console.log("⚠️ Çözülemeyen Promise Hatası:", err);
});

// --- EXPRESS AYARLARI ---
app.use(express.json());
app.use(express.static('public')); 

app.use(session({
    secret: process.env.SESSION_SECRET || 'bot-panel-gizli-sifre', 
    resave: false,
    saveUninitialized: true
}));

// Ana Panel (Tek Sayfa)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// Not: /console rotası kaldırıldı çünkü artık her şey index.html içinde.

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
    
    if (lookInterval) clearInterval(lookInterval);
    lookInterval = setInterval(() => {
        if (bot && bot.entity) {
            bot.look(bot.entity.yaw + 0.1, bot.entity.pitch);
        }
    }, 15000);
}

function stopActions() {
    if (jumpInterval) clearInterval(jumpInterval);
    if (moveInterval) clearInterval(moveInterval);
    if (lookInterval) clearInterval(lookInterval);
    jumpInterval = null;
    moveInterval = null;
    lookInterval = null;
}

function startJumping() {
    if (jumpInterval) clearInterval(jumpInterval);
    jumpInterval = setInterval(() => {
        if (!bot || !bot.entity) return;
        bot.setControlState('jump', true);
        setTimeout(() => { if (bot) bot.setControlState('jump', false); }, 300);
    }, 4000);
}

function startMoving() {
    const dirs = ['forward', 'back', 'left', 'right'];
    if (moveInterval) clearInterval(moveInterval);
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
        checkTimeoutInterval: 90000, 
        keepAlive: true,             
        version: "1.21.4"
    };

    console.log(`[🤖] Bağlanıyor... Kullanıcı Adı: ${config.username}`);
    bot = mineflayer.createBot(config);

    bot.once('spawn', () => {
        console.log("[🟢] Giriş başarılı! Dünyaya indim.");
        botStartTime = Date.now();
        startActions();

        // 1. Canlı 3D Görüntü ve Radar (Port 3001)
        try {
            mineflayerViewer(bot, { port: 3001, firstPerson: true });
            console.log("[👁️] Canlı Görüntü & Radar Aktif: http://localhost:3001");
        } catch(e) { console.log("Viewer başlatılamadı veya zaten açık:", e.message); }

        // 2. Resimli Envanter (Port 3002)
        try {
            inventoryViewer(bot, { port: 3002 });
            console.log("[🎒] Web Envanter Aktif: http://localhost:3002");
        } catch(e) { console.log("Envanter başlatılamadı veya zaten açık:", e.message); }

        // İlk spawn olduğunda can ve açlığı gönder
        sendBotStatus();
    });

    // --- CANLI CHAT LOG VE OTOMATİK GİRİŞ SİSTEMİ ---
    bot.on('messagestr', (message, position) => {
        if (position === 'game_info') return; 

        io.emit('chat-log', { username: '💬 Sunucu Akışı', message: message });

        const msgLower = message.toLowerCase();
        if (msgLower.includes('/register') || msgLower.includes('kayıt') || msgLower.includes('kayit')) {
            bot.chat('/register Sifre1234 Sifre1234');
            console.log("[🔐] Sunucuya otomatik kayıt isteği gönderildi.");
        } else if (msgLower.includes('/login') || msgLower.includes('giriş') || msgLower.includes('giris')) {
            bot.chat('/login Sifre1234');
            console.log("[🔐] Sunucuya otomatik giriş isteği gönderildi.");
        }
    });

    // --- CAN, TOKLUK VE EFEKT GÜNCELLEMELERİ ---
    bot.on('health', sendBotStatus);
    bot.on('entityEffect', (entity, effect) => {
        if (entity === bot.entity) sendBotStatus();
    });
    bot.on('entityEffectEnd', (entity, effect) => {
        if (entity === bot.entity) sendBotStatus();
    });

    bot.on('end', handleDisconnect);
    bot.on('error', (err) => {
        console.log("Bot Hata Alındı:", err.message);
    });
}

// Frontend'e durumu emit eden fonksiyon
function sendBotStatus() {
    if (!bot || !bot.entity) return;
    
    // Üzerindeki büyü/efektleri al
    const activeEffects = Object.values(bot.entity.effects).map(e => ({
        id: e.id,
        amplifier: e.amplifier,
        duration: e.duration
    }));

    io.emit('bot-status', {
        health: Math.round(bot.health), // Max 20
        food: Math.round(bot.food), // Max 20 (Tokluk seviyesi)
        foodSaturation: bot.foodSaturation,
        effects: activeEffects
    });
}

// --- DÜZELTİLDİ: PORT TEMİZLEME İÇİN PM2 RESET ---
function handleDisconnect() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("[🔴] Bağlantı koptu! Port çakışmalarını önlemek için PM2 ile sistem yeniden başlatılıyor...");
    stopActions();

    // Portların temizlenmesi ve radarların çökmemesi için process'i kapatıyoruz.
    // PM2 "pm2-runtime index.js" komutu sayesinde sistemi anında tertemiz şekilde geri açacaktır.
    setTimeout(() => {
        process.exit(0);
    }, 5000); 
}

setInterval(() => {
    console.log("[🔄] 30 dakika doldu. PM2 üzerinden temiz reset atılıyor...");
    process.exit(0);
}, 30 * 60 * 1000);

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
            if (bot.entity) {
                bot.chat(data.message);
            } else {
                socket.emit('chat-log', { username: '⚠️ Sistem', message: 'Bot henüz dünyaya inmedi, mesaj gönderilemez.' });
            }
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
                // Eval çıktılarını düzgün okuyabilmek için formatlama
                let result = eval(data.code); 
                
                // Eğer sonuç bir JSON objesiyse okunabilir stringe çevir
                if (typeof result === 'object' && result !== null) {
                    try {
                        result = JSON.stringify(result, null, 2);
                    } catch (e) {
                        result = "[Karmaşık Obje/Döngüsel Referans]";
                    }
                }
                
                socket.emit('eval-result', result !== undefined ? String(result) : "Kod başarıyla çalıştırıldı (Çıktı yok).");
            } catch (err) {
                socket.emit('eval-result', `Hata: ${err.message}`);
            }
        }
    });
});

const WEB_PORT = process.env.VIEWER_PORT || 3000;
server.listen(WEB_PORT, () => {
    console.log(`[🚀] Web paneli aktif: http://localhost:${WEB_PORT}`);
});
