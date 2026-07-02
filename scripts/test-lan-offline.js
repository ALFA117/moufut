// Prueba: dos peers se descubren y se mandan un mensaje usando SOLO un nodo
// bootstrap propio (HyperDHT.bootstrapper), sin tocar los nodos públicos de
// internet — el mecanismo que hace posible el modo LAN de MouFut sin
// internet (ver DHT.bootstrapper() en docs.pears.com/reference/building-
// blocks/hyperdht y `scripts/lan-bootstrap.js`).
//
// Esto prueba que el transporte funciona de forma aislada (loopback, un solo
// proceso). NO reemplaza la prueba real de "modo avión" en dos dispositivos
// físicos — ver los pasos en TAREAS.md para reproducir eso.
//
// Uso: node scripts/test-lan-offline.js
import HyperDHT from 'hyperdht'
import { createSwarm } from '../src/p2p/swarm.js'

const PORT = 49837 // puerto de prueba, distinto del default de lan-bootstrap.js
const HOST = '127.0.0.1'

async function main() {
  console.log('[test-lan] Levantando nodo bootstrap aislado en', `${HOST}:${PORT}`, '...')
  const bootstrapNode = HyperDHT.bootstrapper(PORT, HOST)
  await bootstrapNode.ready()

  const bootstrap = [{ host: HOST, port: PORT }]
  const roomId = 'test-lan-' + Date.now()

  // Secuencial, no Promise.all: representa mejor el caso real (dos procesos/
  // dispositivos separados que jamás arrancan en el mismo tick de JS).
  // Unirlos en paralelo expone una carrera real del announce/lookup contra
  // una red DHT de un solo nodo recién creada — no aplica al uso real.
  console.log('[test-lan] Uniendo dos peers a la misma sala, ambos apuntando SOLO al bootstrap local...')
  const peerA = await createSwarm(roomId, { bootstrap })
  const peerB = await createSwarm(roomId, { bootstrap })

  const received = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando el mensaje (30s)')), 30000)
    peerB.onMessage((msg) => {
      clearTimeout(timeout)
      resolve(msg)
    })
  })

  // Espera a que se conecten antes de mandar el mensaje
  await new Promise((resolve) => {
    if (peerA.peers.length > 0) return resolve()
    peerA.onPeerJoin(() => resolve())
  })

  peerA.send({ type: 'ping', text: 'hola desde modo LAN sin internet' })

  const msg = await received
  console.log('[test-lan] Mensaje recibido:', msg)

  await peerA.destroy()
  await peerB.destroy()
  await bootstrapNode.destroy()

  if (msg.text !== 'hola desde modo LAN sin internet') {
    console.error('[FAIL] El mensaje recibido no coincide con el enviado.')
    process.exit(1)
  }

  console.log('[OK] Los dos peers se descubrieron y comunicaron usando SOLO el bootstrap propio (sin DHT pública/internet).')
  process.exit(0)
}

main().catch((err) => {
  console.error('[FAIL]', err.message)
  process.exit(1)
})
