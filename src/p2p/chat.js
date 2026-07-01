import crypto from 'crypto'

/**
 * Chat de texto sobre un swarm ya conectado (ver `createSwarm`). Mantiene un
 * historial local en memoria; no persiste ni se sincroniza para peers que se
 * unen tarde (a diferencia de la quiniela en `wallet/pool.js`).
 *
 * @param {ReturnType<import('./swarm.js').createSwarm> extends Promise<infer T> ? T : never} swarm
 * @returns {{
 *   myId: string,
 *   history: Array<{type:'chat', from:string, text:string, ts:number, fromPeer:string, at:number}>,
 *   send: (text: string) => void,
 *   onMessage: (cb: (entry: object) => void) => void,
 * }}
 */
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
