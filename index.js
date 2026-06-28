
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const util = require('minecraft-server-util');
const path = require('path');

// RENDER UYUMLU VIEWER
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
const inventoryViewer = require('mineflayer-web-inventory');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Render PORT
const WEB_PORT = process.env.VIEWER_PORT || 3000;

let bot = null;
let botStartTime = null;
let jumpInterval = null;
let moveInterval = null;
let lookInterval = null;
let isShuttingDown = false;

// --- PROSES HATA YAKALAYICILAR ---
process.on('uncaughtException', (err) => {
    if (err.code === 'EADDRINUSE') return;
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- RANDOM NICK ---
function randomNick() {
    const a = ["Void","Shadow","Venom","Blaze","Frost","Storm","Night","Phantom","Rogue","Nova"];
    const b = ["Hunter","Strike","Soul","Reaper","Walker","Slayer","Pulse","Rider","Claw"];

    return a[Math.floor(Math.random() * a.length)] +
           b[Math.floor(Math.random() * b.length)] +
           Math.floor(Math.random() * 900 + 100);
}

// --- ANTI AFK ---
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

        setTimeout(() => {
            if (bot) bot.setControlState('jump', false);
        }, 300);

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

        setTimeout(() => {
            if (bot) bot.setControlState(d, false);
        }, 1500);

    }, 5000);
}

// --- BOT OLUŞTUR ---
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

    console.log(`[🤖] Bağlanıyor... ${config.username}`);

    bot = mineflayer.createBot(config);

    bot.once('spawn', () => {

        console.log("[🟢] Bot spawn oldu");

        botStartTime = Date.now();

        startActions();

        // --- VIEWER ---
        try {

            mineflayerViewer(bot, {
                port: WEB_PORT,
                firstPerson: true
            });

            console.log("[👁️] Viewer aktif");

        } catch (e) {
            console.log("Viewer hatası:", e.message);
        }

        // --- INVENTORY ---
        try {

            inventoryViewer(bot, {
                app,
                bot,
                path: '/inventory'
            });

            console.log("[🎒] Inventory aktif");

        } catch (e) {
            console.log("Inventory hatası:", e.message);
        }

        sendBotStatus();
    });

    // --- CHAT LOG ---
    bot.on('messagestr', (message, position) => {

        if (position === 'game_info') return;

        io.emit('chat-log', {
            username: '💬 Sunucu',
            message
        });

        const msgLower = message.toLowerCase();

        if (
            msgLower.includes('/register') ||
            msgLower.includes('kayıt') ||
            msgLower.includes('kayit')
        ) {

            bot.chat('/register Sifre1234 Sifre1234');

        } else if (
            msgLower.includes('/login') ||
            msgLower.includes('giriş') ||
            msgLower.includes('giris')
        ) {

            bot.chat('/login Sifre1234');
        }
    });

    // --- STATUS ---
    bot.on('health', sendBotStatus);

    bot.on('entityEffect', (entity) => {
        if (entity === bot.entity) sendBotStatus();
    });

    bot.on('entityEffectEnd', (entity) => {
        if (entity === bot.entity) sendBotStatus();
    });

    bot.on('end', handleDisconnect);

    bot.on('error', (err) => {
        console.log("Bot hata:", err.message);
    });
}

function sendBotStatus() {

    if (!bot || !bot.entity) return;

    const activeEffects = Object.values(bot.entity.effects).map(e => ({
        id: e.id,
        amplifier: e.amplifier,
        duration: e.duration
    }));

    io.emit('bot-status', {
        health: Math.round(bot.health),
        food: Math.round(bot.food),
        foodSaturation: bot.foodSaturation,
        effects: activeEffects
    });
}

// --- DISCONNECT ---
function handleDisconnect() {

    if (isShuttingDown) return;

    isShuttingDown = true;

    console.log("[🔴] Bot bağlantısı kesildi");

    stopActions();

    setTimeout(() => {
        process.exit(0);
    }, 5000);
}

// 30 DK RESET
setInterval(() => {

    console.log("[🔄] Sistem resetleniyor");

    process.exit(0);

}, 30 * 60 * 1000);

createBot();

// --- API ---
app.get('/api/server-info', async (req, res) => {

    try {

        const host = process.env.MC_HOST || "izmirr.aternos.me";
        const port = parseInt(process.env.MC_PORT) || 25565;

        const result = await util.status(host, port);

        const uptime =
            botStartTime
            ? Math.floor((Date.now() - botStartTime) / 1000 / 60)
            : 0;

        res.json({
            online: true,
            players: result.players.online,
            maxPlayers: result.players.max,
            samplePlayers: result.players.sample || [],
            version: result.version.name,
            motd: result.motd.clean,
            favicon: result.favicon,
            uptime
        });

    } catch {

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

        res.status(401).json({
            success: false,
            message: 'Hatalı giriş'
        });
    }
});

app.get('/api/check-auth', (req, res) => {
    res.json({
        isAdmin: !!req.session.isAdmin
    });
});

// --- SOCKET ---
io.on('connection', (socket) => {

    socket.on('admin-action', (data) => {

        if (!bot) return;

        if (data.action === 'send-message') {

            if (bot.entity) {

                bot.chat(data.message);

            } else {

                socket.emit('chat-log', {
                    username: '⚠️ Sistem',
                    message: 'Bot henüz spawn olmadı.'
                });
            }
        }

        else if (data.action === 'get-location') {

            if (bot.entity) {

                const pos = bot.entity.position;

                socket.emit(
                    'location-result',
                    `X: ${pos.x.toFixed(2)}, Y: ${pos.y.toFixed(2)}, Z: ${pos.z.toFixed(2)}`
                );

            } else {

                socket.emit(
                    'location-result',
                    'Konum alınamadı'
                );
            }
        }
    });
});

// --- SERVER ---
server.listen(WEB_PORT, () => {
    console.log(`[🚀] Web panel aktif: ${WEB_PORT}`);
});

