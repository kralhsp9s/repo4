const mineflayer = require('mineflayer')
const http = require('http')

http.createServer((req, res) => {
  res.write("aktif")
  res.end()
}).listen(process.env.PORT || 3000)

let bot = null
let jumpInterval = null
let moveInterval = null
let reconnectTimeout = null

process.on('uncaughtException', (err) => {
  console.log("Büyük Hata:", err.message)
})

process.on('unhandledRejection', (err) => {
  console.log("Promise Hata:", err)
})

function randomNick() {
  const a = ["Void","Shadow","Venom","Blaze","Frost","Storm","Night","Phantom","Rogue","Nova"]
  const b = ["Hunter","Strike","Soul","Reaper","Walker","Slayer","Pulse","Rider","Claw"]
  return a[Math.floor(Math.random()*a.length)] +
         b[Math.floor(Math.random()*b.length)] +
         Math.floor(Math.random()*900+100)
}

function createBot() {
  stopActions()

  const config = {
    host: process.env.host || "SUNUCU_IP",
    port: process.env.p || 25565,
    username: randomNick(),
    version: "1.16.5"
  }

  console.log("Bağlanıyor:", config.username)

  bot = mineflayer.createBot(config)

  bot.once('spawn', () => {
    console.log("Giriş başarılı")
    startActions()
  })

  bot.on('end', handleDisconnect)

  bot.on('error', (err) => {
    console.log("Bot Hata:", err.message)
  })
}

function handleDisconnect() {
  console.log("Bağlantı koptu → tekrar deneniyor")
  stopActions()

  if (reconnectTimeout) return
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null
    createBot()
  }, 5000)
}

function startActions() {
  startJumping()
  startMoving()
}

function stopActions() {
  if (jumpInterval) clearInterval(jumpInterval)
  if (moveInterval) clearInterval(moveInterval)
  jumpInterval = null
  moveInterval = null
}

function startJumping() {
  jumpInterval = setInterval(() => {
    if (!bot || !bot.entity) return
    bot.setControlState('jump', true)
    setTimeout(() => bot.setControlState('jump', false), 300)
  }, 4000)
}

function startMoving() {
  const dirs = ['forward','back','left','right']

  moveInterval = setInterval(() => {
    if (!bot || !bot.entity) return
    dirs.forEach(d => bot.setControlState(d, false))
    const d = dirs[Math.floor(Math.random()*dirs.length)]
    bot.setControlState(d, true)
    setTimeout(() => bot.setControlState(d, false), 1500)
  }, 5000)
}

createBot()

setInterval(() => {
  console.log("30 dk doldu → reset")
  if (bot) bot.end()
}, 30 * 60 * 1000)
