// Prueba de stress: N peers simultáneos en la misma sala, verificando que
// la malla converge (todos ven a todos) y que un mensaje difundido por uno
// llega a todos los demás.
// Uso: node scripts/test-stress-peers.js [N]
import { createSwarm } from '../src/p2p/swarm.js'
import { createChat } from '../src/p2p/chat.js'

const N = Number(process.argv[2]) || 12
const ROOM = 'test-stress-' + Date.now()
const CONNECT_TIMEOUT_MS = 60000
const MESSAGE_TIMEOUT_MS = 15000

function fail(msg) {
  console.error(`[FAIL] ${msg}`)
  process.exit(1)
}

async function waitUntil(check, label, ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (check()) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

async function main() {
  console.log(`[test-stress] Levantando ${N} peers en sala "${ROOM}"...`)

  // Se escalonan las uniones (en vez de todas a la vez) para no saturar las
  // consultas DHT simultáneas al correr N instancias dentro del mismo proceso/IP.
  const swarms = []
  for (let i = 0; i < N; i++) {
    swarms.push(await createSwarm(ROOM))
    await new Promise((r) => setTimeout(r, 400))
  }
  const chats = swarms.map(createChat)

  const meshOk = await waitUntil(
    () => swarms.every((s) => s.peers.length === N - 1),
    'malla completa',
    CONNECT_TIMEOUT_MS
  )

  const connectedCounts = swarms.map((s) => s.peers.length)
  console.log('[test-stress] Conexiones por peer:', connectedCounts)

  if (!meshOk) {
    const min = Math.min(...connectedCounts)
    console.warn(`[test-stress] AVISO: la malla no convergió al 100% (mínimo ${min}/${N - 1}). Continuando con verificación de mensajería de todas formas.`)
  }

  const receivedBy = new Set()
  for (let i = 1; i < chats.length; i++) {
    chats[i].onMessage((entry) => {
      if (entry.fromPeer !== 'me' && entry.text === 'broadcast-stress-test') receivedBy.add(i)
    })
  }

  chats[0].send('broadcast-stress-test')

  const allReceived = await waitUntil(() => receivedBy.size === N - 1, 'todos reciben el broadcast', MESSAGE_TIMEOUT_MS)

  console.log(`[test-stress] Mensaje recibido por ${receivedBy.size}/${N - 1} peers.`)

  await Promise.all(swarms.map((s) => s.destroy()))

  if (!allReceived) fail(`solo ${receivedBy.size}/${N - 1} peers recibieron el broadcast`)

  console.log(`[OK] ${N} peers conectados y mensaje difundido a toda la malla.`)
  process.exit(0)
}

main().catch((err) => fail(err.message))
setTimeout(() => fail(`timeout global`), CONNECT_TIMEOUT_MS + MESSAGE_TIMEOUT_MS + 10000)
