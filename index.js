const mineflayer = require('mineflayer')
const http = require('http')


http.createServer((req, res) => {
  res.write(" aktif")
  res.end()
}).listen(process.env.PORT || 3000)

const config = {
  host: process.env.host,
  port: process.env.p,
  username: process.env.ad,
  version: "1.16.5"
}

let bot
let jumpInterval = null
let moveInterval = null

function createBot() {
  bot = mineflayer.createBot(config)

  console.log("Bot bağlanıyor...")

  bot.on('spawn', () => {
    console.log("Bot giriş yaptı!")
    startActions()
  })

  bot.on('end', () => {
    console.log("Bağlantı kesildi. Yeniden bağlanılıyor...")
    stopActions()
    setTimeout(createBot, 5000)
  })

  bot.on('kicked', (reason) => {
    console.log("Atıldı:", reason)
  })

  bot.on('error', err => {
    console.log("Hata:", err.message)
  })
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
    if (!bot.entity) return

    if (Math.random() < 0.4) {
      bot.setControlState('jump', true)
      setTimeout(() => bot.setControlState('jump', false), 300)
    }
  }, 4000)
}

function startMoving() {
  const directions = ['forward', 'back', 'left', 'right']

  moveInterval = setInterval(() => {
    if (!bot.entity) return

    // Tüm tuşları bırak
    directions.forEach(dir => bot.setControlState(dir, false))

    // Rastgele yön seç
    const dir = directions[Math.floor(Math.random() * directions.length)]
    bot.setControlState(dir, true)

    // 1–3 saniye yürüsün
    const moveTime = 1000 + Math.random() * 2000

    setTimeout(() => {
      bot.setControlState(dir, false)
    }, moveTime)

  }, 5000)
}

createBot()
