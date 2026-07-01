import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import crypto from 'crypto'

/**
 * Une el dispositivo a una malla Hyperswarm identificada por `roomId` (el
 * topic es sha256("moufut:" + roomId), así que cualquier peer con el mismo
 * código de sala se descubre vía la DHT pública, sin servidor propio).
 *
 * @param {string} roomId - código de sala compartido entre peers
 * @returns {Promise<{
 *   roomId: string,
 *   keypair: {publicKey: Uint8Array, secretKey: Uint8Array},
 *   peers: string[],
 *   send: (msg: object) => void,
 *   onMessage: (cb: (msg: object, peerId: string) => void) => void,
 *   onPeerJoin: (cb: (peerId: string, info: object) => void) => void,
 *   onPeerLeave: (cb: (peerId: string) => void) => void,
 *   destroy: () => Promise<void>,
 * }>}
 */
export async function createSwarm(roomId) {
  const swarm = new Hyperswarm()
  const topic = crypto.createHash('sha256').update('moufut:' + roomId).digest()

  const peers = new Map()
  const messageListeners = []
  const joinListeners = []
  const leaveListeners = []

  swarm.on('connection', (conn, info) => {
    const peerId = b4a.toString(info.publicKey, 'hex').slice(0, 8)
    peers.set(peerId, conn)
    joinListeners.forEach(cb => cb(peerId, info))

    conn.on('data', (data) => {
      try {
        const msg = JSON.parse(b4a.toString(data))
        messageListeners.forEach(cb => cb(msg, peerId))
      } catch {}
    })

    conn.on('close', () => {
      peers.delete(peerId)
      leaveListeners.forEach(cb => cb(peerId))
    })

    conn.on('error', () => {})
  })

  const discovery = swarm.join(topic, { client: true, server: true })
  await discovery.flushed()

  console.log(`[P2P] Sala "${roomId}" activa | peers: ${swarm.connections.size}`)

  return {
    roomId,
    // Expone el keypair Ed25519 de Hyperswarm como identidad criptográfica del peer
    get keypair() { return swarm.keyPair },
    get peers()   { return [...peers.keys()] },
    send(msg) {
      const data = b4a.from(JSON.stringify(msg))
      // Itera sobre nuestro propio Map `peers` (poblado antes de disparar
      // joinListeners) en vez de `swarm.connections`: así un envío síncrono
      // disparado desde un handler de onPeerJoin siempre incluye al peer
      // que acaba de conectarse, sin depender del timing interno de Hyperswarm.
      for (const conn of peers.values()) conn.write(data)
    },
    onMessage(cb)  { messageListeners.push(cb) },
    onPeerJoin(cb) { joinListeners.push(cb) },
    onPeerLeave(cb){ leaveListeners.push(cb) },
    async destroy(){ await swarm.destroy() }
  }
}
