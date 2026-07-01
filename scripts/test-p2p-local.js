// Prueba local: dos peers en la misma sala, mismo proceso (simula "dos terminales").
// Verifica que swarm + chat intercambian mensajes correctamente.
// Uso: node scripts/test-p2p-local.js
import { createSwarm } from '../src/p2p/swarm.js'
import { createChat } from '../src/p2p/chat.js'

const ROOM = 'test-room-' + Date.now()
const TIMEOUT_MS = 20000

function fail(msg) {
  console.error(`[FAIL] ${msg}`)
  process.exit(1)
}

async function main() {
  console.log(`[test-p2p-local] Sala: ${ROOM}`)

  const [swarmA, swarmB] = await Promise.all([createSwarm(ROOM), createSwarm(ROOM)])
  const chatA = createChat(swarmA)
  const chatB = createChat(swarmB)

  const gotMessage = new Promise((resolve) => {
    chatB.onMessage((entry) => {
      if (entry.fromPeer !== 'me' && entry.text === 'hola desde A') resolve(entry)
    })
  })

  // Esperar a que A y B se descubran como peers antes de enviar
  await new Promise((resolve) => {
    const check = () => {
      if (swarmA.peers.length > 0 && swarmB.peers.length > 0) return resolve()
      setTimeout(check, 200)
    }
    check()
  })

  console.log(`[test-p2p-local] Peers conectados: A ve ${swarmA.peers.length}, B ve ${swarmB.peers.length}`)
  chatA.send('hola desde A')

  const result = await Promise.race([
    gotMessage,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout esperando mensaje')), TIMEOUT_MS))
  ])

  console.log('[OK] Mensaje recibido en B:', result.text)
  await swarmA.destroy()
  await swarmB.destroy()
  process.exit(0)
}

main().catch((err) => fail(err.message))

setTimeout(() => fail(`timeout global (${TIMEOUT_MS}ms) — probablemente sin acceso a la DHT de Hyperswarm (requiere internet para bootstrap)`), TIMEOUT_MS + 2000)
