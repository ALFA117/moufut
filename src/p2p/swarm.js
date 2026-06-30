import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import crypto from 'crypto'

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
    joinListeners.forEach(cb => cb(peerId))

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
    get peers() { return [...peers.keys()] },
    send(msg) {
      const data = b4a.from(JSON.stringify(msg))
      for (const conn of swarm.connections) conn.write(data)
    },
    onMessage(cb) { messageListeners.push(cb) },
    onPeerJoin(cb) { joinListeners.push(cb) },
    onPeerLeave(cb) { leaveListeners.push(cb) },
    async destroy() { await swarm.destroy() }
  }
}
