const mineflayer = require('mineflayer')
const http = require('http')

http.createServer((req, res) => {
  res.write("aktif")
  res.end()
}).listen(process.env.PORT || 3000)

let bot
let jumpInterval = null
let moveInterval = null


function randomNick() {
  const cool1 = ["Void","Shadow","Venom","Blaze","Frost","Storm","Night","Phantom","Rogue","Nova","Vortex","Drift"]
  const cool2 = ["Hunter","Strike","Soul","Reaper","Walker","Slayer","Pulse","Rider","Claw","Byte"]
  const w1 = cool1[Math.floor(Math.random() * cool1.length)]
  const w2 = cool2[Math.floor(Math.random() * cool2.length)]
  const num = Math.floor(Math.random() * 900 + 100)
  return w1 + w2 + num
}

function createBot() {

  const config = {
    host: process.env.host,
    port: process.env.p,
    username: randomNick(), 
    version: "1.16.5"
  }

  bot = mineflayer.createBot(config)

  console.log("Bot bağlanıyor... Nick:", config.username)

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

    directions.forEach(dir => bot.setControlState(dir, false))

    const dir = directions[Math.floor(Math.random() * directions.length)]
    bot.setControlState(dir, true)

    const moveTime = 1000 + Math.random() * 2000

    setTimeout(() => {
      bot.setControlState(dir, false)
    }, moveTime)

  }, 5000)
}

createBot()

setInterval(() => {
  console.log("30 dakika doldu → Bot resetleniyor (yeni nick)")
  if (bot) bot.quit()
}, 30 * 60 * 1000)  bot.on('kicked', (reason) => {
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
