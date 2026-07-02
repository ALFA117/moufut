import { validate, createMsg, MSG } from './schema.js'

/**
 * Registro de "workers" QVAC anunciados por la malla: peers que corren
 * `startQVACProvider()` (delegación nativa de QVAC — ver `src/ai/delegation.js`)
 * y se ofrecen a correr inferencia pesada por los demás. No hace falta un
 * topic ni discovery aparte: el `publicKey` que se anuncia aquí es el mismo
 * que se usa después en `loadModel({ delegate: { providerPublicKey } })`.
 *
 * @param {object} opts
 * @param {ReturnType<import('./swarm.js').createSwarm> extends Promise<infer T> ? T : never} opts.swarm
 * @returns {{
 *   workers: Array<{peerId:string, publicKey:string, tier:string}>,
 *   bestWorker: () => {peerId:string, publicKey:string, tier:string} | null,
 *   announce: (info: {publicKey:string, tier:string} | null) => void,
 *   onChange: (cb: (workers: object[]) => void) => void,
 * }}
 */
export function createCapabilities({ swarm }) {
  const workers = new Map() // peerId -> {peerId, publicKey, tier}
  const listeners = []

  function notify() { listeners.forEach(cb => cb([...workers.values()])) }

  swarm.onMessage((msg, fromPeer) => {
    if (msg.type !== MSG.QVAC_CAPABILITY || !validate(msg)) return
    if (msg.available === false) {
      if (workers.delete(fromPeer)) notify()
      return
    }
    workers.set(fromPeer, { peerId: fromPeer, publicKey: msg.publicKey, tier: msg.tier })
    notify()
  })

  swarm.onPeerLeave((peerId) => {
    if (workers.delete(peerId)) notify()
  })

  return {
    get workers() { return [...workers.values()] },

    /** El primer worker anunciado disponible en la sala, o `null` si no hay ninguno. */
    bestWorker() {
      const list = [...workers.values()]
      return list.length ? list[0] : null
    },

    /**
     * Anuncia (o retira, pasando `null`) la capacidad de este peer como
     * worker QVAC. `info.publicKey` debe venir de `startQVACProvider()`.
     */
    announce(info) {
      swarm.send(createMsg(MSG.QVAC_CAPABILITY, info
        ? { available: true, publicKey: info.publicKey, tier: info.tier }
        : { available: false }))
    },

    onChange(cb) { listeners.push(cb) }
  }
}
