import { loadModel, ragIngest, ragSearch, ragListWorkspaces } from '@qvac/sdk'
import { EMBEDDINGGEMMA_300M_Q8_0 } from '@qvac/sdk/models'
import { FUTBOL_KB } from './knowledge/futbol-kb.js'

/**
 * RAG local sobre conocimiento de fútbol (reglas, formato del Mundial 2026,
 * historial México-Argentina — ver `knowledge/futbol-kb.js`), 100% on-device
 * vía el backend vectorial nativo de QVAC (HyperDB, sin dependencias nuevas).
 * Ver `node_modules/@qvac/sdk/dist/examples/rag/rag-hyperdb/ingest.js` para
 * la referencia oficial de este flujo (ragIngest → ragSearch).
 */

const WORKSPACE = 'futbol-kb'

let embedModelId = null
let indexReadyPromise = null

async function ensureIndexed({ onProgress } = {}) {
  if (indexReadyPromise) return indexReadyPromise
  indexReadyPromise = (async () => {
    embedModelId = await loadModel({
      modelSrc: EMBEDDINGGEMMA_300M_Q8_0,
      onProgress: (p) => {
        if (p.percentage != null) onProgress?.(p.percentage)
      }
    })
    onProgress?.(null)

    // La base es estática y ya vive en disco entre sesiones (HyperDB
    // persiste el workspace) — si ya se indexó una vez, no hay que repetirlo.
    const workspaces = await ragListWorkspaces()
    if (workspaces.some(w => w.name === WORKSPACE)) {
      console.log('[RAG] Base de fútbol ya indexada, se reutiliza.')
      return
    }

    console.log(`[RAG] Indexando ${FUTBOL_KB.length} documentos de la base de fútbol...`)
    await ragIngest({ modelId: embedModelId, workspace: WORKSPACE, documents: FUTBOL_KB, chunk: false })
    console.log('[RAG] Base de fútbol indexada.')
  })().catch((err) => {
    indexReadyPromise = null // permite reintentar en la próxima búsqueda
    throw err
  })
  return indexReadyPromise
}

/**
 * Busca los `topK` fragmentos más relevantes de la base de fútbol para
 * `query`. Indexa la base la primera vez que se llama (lazy, una sola vez
 * por sesión). Si QVAC no está disponible (sin runtime Bare/Pear, etc.),
 * devuelve un arreglo vacío en vez de fallar — el orquestador simplemente
 * responde sin contexto extra en ese caso, nunca se cae la respuesta por esto.
 *
 * @param {string} query
 * @param {{topK?: number, onProgress?: (pct:number|null)=>void}} [opts]
 * @returns {Promise<Array<{content:string, score:number}>>}
 */
export async function searchKnowledge(query, { topK = 2, onProgress } = {}) {
  try {
    await ensureIndexed({ onProgress })
    const results = await ragSearch({ modelId: embedModelId, workspace: WORKSPACE, query, topK })
    return results.map(r => ({ content: r.content, score: r.score }))
  } catch (err) {
    console.warn('[RAG] Búsqueda no disponible:', err.message)
    return []
  }
}
