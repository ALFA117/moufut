import crypto from 'crypto'

export function createChat(swarm) {
  const myId = crypto.randomBytes(4).toString('hex')
  const history = []
  const listeners = []

  swarm.onMessage((msg, fromPeer) => {
    if (msg.type !== 'chat') return
    const entry = { ...msg, fromPeer, at: Date.now() }
    history.push(entry)
    listeners.forEach(cb => cb(entry))
  })

  return {
    myId,
    history,
    send(text) {
      const msg = { type: 'chat', from: myId, text, ts: Date.now() }
      const entry = { ...msg, fromPeer: 'me', at: Date.now() }
      history.push(entry)
      swarm.send(msg)
      listeners.forEach(cb => cb(entry))
    },
    onMessage(cb) { listeners.push(cb) }
  }
}
