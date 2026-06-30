const listeners = []

export function createBoard({ swarm, myId }) {
  const predictions = new Map()

  swarm.onMessage((msg, fromPeer) => {
    if (msg.type !== 'prediction') return
    predictions.set(fromPeer, { ...msg.data, peerId: fromPeer })
    listeners.forEach(cb => cb([...predictions.values()]))
  })

  swarm.onPeerLeave((peerId) => {
    if (predictions.has(peerId)) {
      predictions.delete(peerId)
      listeners.forEach(cb => cb([...predictions.values()]))
    }
  })

  return {
    get predictions() { return [...predictions.values()] },

    submit({ home, away, amount }) {
      const data = { home: Number(home), away: Number(away), amount: Number(amount), ts: Date.now() }
      predictions.set(myId, { ...data, peerId: myId })
      swarm.send({ type: 'prediction', data })
      listeners.forEach(cb => cb([...predictions.values()]))
    },

    onChange(cb) { listeners.push(cb) }
  }
}
