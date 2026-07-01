/**
 * Tablón de predicciones compartido entre peers: cada peer transmite su
 * apuesta de marcador y todos ven las de los demás en tiempo real (sin
 * persistencia — no sincroniza con peers que se unen tarde, a diferencia de
 * la quiniela en `wallet/pool.js`).
 *
 * @param {object} opts
 * @param {ReturnType<import('./swarm.js').createSwarm> extends Promise<infer T> ? T : never} opts.swarm
 * @param {string} opts.myId - identificador local del peer (p.ej. `identity.shortId`)
 * @returns {{
 *   predictions: Array<{home:number, away:number, amount:number, ts:number, peerId:string}>,
 *   submit: (pred: {home:number, away:number, amount:number}) => void,
 *   onChange: (cb: (predictions: object[]) => void) => void,
 * }}
 */
export function createBoard({ swarm, myId }) {
  const predictions = new Map()
  const listeners = []

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
