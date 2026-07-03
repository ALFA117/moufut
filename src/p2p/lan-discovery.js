import mdns from 'multicast-dns'

// Backlog v3 (ver TAREAS.md): antes el modo LAN sin internet exigía escribir
// a mano `?bootstrap=host:port` en la URL. Esto permite autodescubrir un nodo
// levantado con `scripts/lan-bootstrap.js` en la misma red vía mDNS, sin
// depender de ningún servidor ni de la DHT pública (que necesita internet).
const SERVICE_NAME = '_moufut-bootstrap._udp.local'

/**
 * Anuncia este nodo bootstrap por mDNS en la LAN. Cualquier peer que llame a
 * `discoverLanBootstrap()` en la misma red lo encuentra sin escribir la IP a
 * mano.
 * @param {{host:string, port:number}} bootstrap
 * @returns {{ destroy: () => void }}
 */
export function announceLanBootstrap({ host, port }) {
  const instance = mdns()

  instance.on('query', (query) => {
    const asksForUs = query.questions.some((q) => q.type === 'SRV' && q.name === SERVICE_NAME)
    if (!asksForUs) return
    instance.respond({
      answers: [
        { name: SERVICE_NAME, type: 'SRV', data: { port, weight: 0, priority: 0, target: host } }
      ]
    })
  })

  return { destroy: () => instance.destroy() }
}

/**
 * Busca un nodo bootstrap anunciado en la LAN vía mDNS.
 * @param {{timeoutMs?: number}} [opts]
 * @returns {Promise<{host:string, port:number}|null>} `null` si nadie respondió a tiempo
 */
export function discoverLanBootstrap({ timeoutMs = 2000 } = {}) {
  return new Promise((resolve) => {
    const instance = mdns()
    let done = false

    function finish(result) {
      if (done) return
      done = true
      instance.destroy()
      resolve(result)
    }

    instance.on('response', (response) => {
      const srv = response.answers.find((a) => a.type === 'SRV' && a.name === SERVICE_NAME)
      if (srv) finish({ host: srv.data.target, port: srv.data.port })
    })

    instance.query({ questions: [{ name: SERVICE_NAME, type: 'SRV' }] })
    setTimeout(() => finish(null), timeoutMs)
  })
}
