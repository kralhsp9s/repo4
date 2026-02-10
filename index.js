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

// 💀 Program çökmesin
process.on('uncaughtException', err => console.log("Büyük Hata:", err.message))
process.on('unhandledRejection', err => console.log("Promise Hata:", err))

// 😈 Havalı Nick
function randomNick() {
  const cool1 = ["Void","Shadow","Venom","Blaze","Frost","Storm","Night","Phantom","Rogue","Nova","Vortex","Drift"]
  const cool2 = ["Hunter","Strike","Soul","Reaper","Walker","Slayer","Pulse","Rider","Claw","Byte"]
  return cool1[Math.floor(Math.random()*cool1.length)] +
         cool2[Math.floor(Math.random()*cool2.length)] +
         Math.floor(Math.random()*900+100)
}

function createBot() {
  stopActions()

  const config = {
    host: process.env.host,
    port: process.env.p,
    username: randomNick(),
    version: "1.16.5"
  }

  console.log("Bağlanıyor →", config.username)

  bot = mineflayer.createBot(config)

  bot.once('spawn', () => {
    console.log("Giriş başarılı")
    startActions()
  })

  bot.on('end', handleDisconnect)
  bot.on('kicked', reason => console.log("Kick:", reason))
  bot.on('error', err => console.log("Bot Hata:", err.message))
}

function handleDisconnect() {
  console.log("Bağlantı koptu → 5 sn sonra tekrar denenecek")
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
    if (!bot?.entity) return
    if (Math.random() < 0.4) {
      bot.setControlState('jump', true)
      setTimeout(() => bot.setControlState('jump', false), 300)
    }
  }, 4000)
}

function startMoving() {
  const directions = ['forward','back','left','right']

  moveInterval = setInterval(() => {
    if (!bot?.entity) return

    directions.forEach(d => bot.setControlState(d, false))
    const dir = directions[Math.floor(Math.random()*directions.length)]
    bot.setControlState(dir, true)

    setTimeout(() => bot.setControlState(dir, false),
      1000 + Math.random()*2000)
  }, 5000)
}

createBot()

// ⏳ 30 dk reset
setInterval(() => {
  console.log("30 dk doldu → Yeni nick ile reset")
  if (bot) bot.end()
}, 30 * 60 * 1000)    console.log("Bot giriş yaptı!")
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
