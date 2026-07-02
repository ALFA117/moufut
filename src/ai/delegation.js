import { startQVACProvider, stopQVACProvider, loadModel } from '@qvac/sdk'

/**
 * Delegación de inferencia P2P — usa el mecanismo NATIVO de QVAC (no un
 * protocolo propio): `startQVACProvider()` abre un servidor en la misma DHT
 * que ya usa Hyperswarm (`dht.connect(publicKey)`, sin topic ni discovery
 * aparte) y cualquier peer puede después pedir `loadModel({ delegate })`
 * apuntando a ese `publicKey` para correr la inferencia ahí en vez de local.
 * Ver `node_modules/@qvac/sdk/dist/examples/delegated-inference/` para la
 * referencia oficial de este flujo.
 */

// Etiqueta informativa que se anuncia junto al publicKey (ver p2p/capabilities.js)
// — puramente descriptiva para la UI, QVAC no la usa para nada.
export const WORKER_TIER = 'desktop-qvac'

let providerPublicKey = null

/**
 * Convierte este dispositivo en "worker" QVAC: otros peers de la sala pueden
 * delegarle inferencia pesada. Idempotente (llamar dos veces no reinicia el
 * provider, según la doc de `startQVACProvider`).
 * @returns {Promise<string>} el publicKey del provider, para anunciar por la malla P2P
 */
export async function becomeWorker() {
  const res = await startQVACProvider()
  if (!res.success || !res.publicKey) {
    throw new Error(res.error || 'No se pudo iniciar el provider QVAC')
  }
  providerPublicKey = res.publicKey
  console.log('[Delegación] Este dispositivo es worker QVAC:', providerPublicKey)
  return providerPublicKey
}

/** Deja de ofrecer inferencia a otros peers de la sala. */
export async function stopBeingWorker() {
  if (!providerPublicKey) return
  await stopQVACProvider()
  console.log('[Delegación] Este dispositivo dejó de ser worker QVAC')
  providerPublicKey = null
}

export function isWorker() { return providerPublicKey != null }
export function getProviderPublicKey() { return providerPublicKey }

/**
 * Carga un modelo intentando delegarlo primero a un peer worker conocido; si
 * no hay worker anunciado en la sala, o la delegación falla (peer offline,
 * timeout de conexión), cae a un modelo local más chico. El fallback lo
 * maneja esta función a propósito (con `fallbackToLocal: false` hacia QVAC)
 * en vez de dejar que QVAC recargue el MISMO modelo grande local — en
 * hardware débil eso sería demasiado pesado; queremos un modelo distinto.
 *
 * @param {object} opts
 * @param {{peerId:string, publicKey:string, tier:string}|null} opts.worker - worker conocido (de `p2p/capabilities.js`), o `null`
 * @param {object} opts.remoteModel - `modelSrc` a pedirle al worker (modelo grande)
 * @param {object} opts.localModel  - `modelSrc` a correr en este dispositivo si no hay worker disponible (modelo chico)
 * @param {number} [opts.timeout] - ms de espera para la conexión delegada. La DHT puede tardar 15-45s en "calentar"
 *   en la primera conexión del proceso (ver comentario del SDK en `delegated-inference/consumer.js`); conexiones
 *   siguientes son sub-segundo. Con menos tiempo, una demora de red normal se confundiría con "peer caído".
 * @param {(pct:number|null)=>void} [opts.onProgress]
 * @returns {Promise<{modelId:string, mode:'delegated'|'local', peerId?:string}>}
 */
export async function loadWithDelegateFallback({ worker, remoteModel, localModel, timeout = 60_000, onProgress }) {
  if (worker) {
    try {
      const modelId = await loadModel({
        modelSrc: remoteModel,
        delegate: {
          providerPublicKey: worker.publicKey,
          timeout,
          fallbackToLocal: false
        },
        onProgress
      })
      console.log(`[Delegación] Inferencia delegada a peer ${worker.peerId} (${worker.tier})`)
      return { modelId, mode: 'delegated', peerId: worker.peerId }
    } catch (err) {
      console.warn(`[Delegación] No se pudo delegar a ${worker.peerId}, corriendo local:`, err.message)
    }
  }

  const modelId = await loadModel({ modelSrc: localModel, onProgress })
  return { modelId, mode: 'local' }
}
