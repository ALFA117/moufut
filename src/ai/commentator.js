import { completion, unloadModel } from '@qvac/sdk'
import { SMOLLM2_360M_INST_Q8, QWEN3_1_7B_INST_Q4 } from '@qvac/sdk/models'
import { loadWithDelegateFallback } from './delegation.js'

// Modelo local (chico, hardware débil) vs. el que se le pide a un peer worker
// (más grande/capaz) cuando hay uno anunciado en la sala — ver delegation.js.
const LOCAL_MODEL  = SMOLLM2_360M_INST_Q8
const REMOTE_MODEL = QWEN3_1_7B_INST_Q4

let commentModelId  = null
let runtimeMode      = 'local'  // 'local' | 'delegated' — dónde corrió la última carga de modelo
let runtimeWorkerId  = null     // peerId del worker si runtimeMode === 'delegated'
let reloading         = false

const eventHistory = []
const MAX_HISTORY  = 8

const SYSTEM_PROMPT   = 'Eres un comentarista deportivo apasionado de fútbol. Responde siempre en 1-2 oraciones cortas, estilo radio en vivo.'
const TACTICAL_PROMPT = 'Eres un analista táctico de fútbol. Dado el historial de jugadas, genera un análisis táctico breve (2-3 oraciones) sobre lo que está pasando en el partido.'
const ASK_PROMPT      = 'Eres MouBot, comentarista experto de fútbol. Responde la pregunta del usuario en 1-2 oraciones directas y apasionadas, como si estuvieras en la cabina de radio.'

const EVENT_DESC = {
  goal:       (e) => `GOL de ${e.player ?? 'jugador desconocido'} al minuto ${e.minute ?? '?'}.`,
  foul:       (e) => `Falta de ${e.player ?? 'jugador'} al minuto ${e.minute ?? '?'}.`,
  var:        (e) => `Revisión VAR: ${e.outcome ?? 'en revisión'} (min ${e.minute ?? '?'}).`,
  yellowCard: (e) => `Tarjeta amarilla para ${e.player ?? 'jugador'} al minuto ${e.minute ?? '?'}.`,
  redCard:    (e) => `Tarjeta roja — ${e.player ?? 'jugador'} expulsado al minuto ${e.minute ?? '?'}.`,
  gol:        (e) => `¡GOOOL! ${e.player ?? ''} anota en el partido.`,
  falta:      (e) => `Falta sancionada al minuto ${e.minute ?? '?'}.`,
  roja:       (e) => `¡Tarjeta ROJA! Expulsión en el campo.`,
  fuera:      (e) => `La jugada se va fuera. Saque de banda o de puerta.`,
}

function describeEvent(event) {
  const fn = EVENT_DESC[event.type]
  return fn ? fn(event) : `Evento "${event.type}" en el partido.`
}

/**
 * Carga el modelo del comentarista, delegando a un peer worker de la sala si
 * `capabilities` conoce uno (ver `p2p/capabilities.js` + `ai/delegation.js`),
 * o corriendo local si no hay ninguno o la delegación falla.
 */
async function loadCommentModel({ onProgress, capabilities } = {}) {
  const worker = capabilities?.bestWorker() ?? null
  try {
    const result = await loadWithDelegateFallback({
      worker,
      remoteModel: REMOTE_MODEL,
      localModel: LOCAL_MODEL,
      onProgress: (p) => {
        if (p.percentage != null) {
          console.log(`[IA] Descargando modelo... ${p.percentage.toFixed(0)}%`)
          onProgress?.(p.percentage)
        }
      }
    })
    commentModelId = result.modelId
    runtimeMode    = result.mode
    runtimeWorkerId = result.peerId ?? null
    onProgress?.(null)
    console.log(`[IA] Modelo listo (${runtimeMode}${runtimeWorkerId ? ' · peer ' + runtimeWorkerId : ''}):`, commentModelId)
  } catch (err) {
    console.warn('[IA] No se pudo cargar QVAC:', err.message)
    commentModelId  = null
    runtimeMode      = 'local'
    runtimeWorkerId  = null
    onProgress?.(null)
  }
}

/**
 * Reevalúa si conviene cambiar de worker: si el worker delegado actual se
 * fue de la sala (hay que caer a local), o si estábamos en local y acaba de
 * aparecer un worker (conviene subir de modelo). Se llama cuando cambia el
 * registro de capacidades P2P — nunca en medio de una respuesta en curso.
 */
async function maybeSwitchWorker({ capabilities, onProgress } = {}) {
  if (reloading || !capabilities) return

  const worker = capabilities.bestWorker()
  const stillDelegatedToKnownWorker = runtimeMode === 'delegated' && worker?.peerId === runtimeWorkerId
  const lostOurWorker  = runtimeMode === 'delegated' && !stillDelegatedToKnownWorker
  const gainedAWorker  = runtimeMode === 'local' && worker != null

  if (!lostOurWorker && !gainedAWorker) return

  reloading = true
  const previousModelId = commentModelId
  await loadCommentModel({ onProgress, capabilities })
  if (previousModelId && previousModelId !== commentModelId) {
    try { await unloadModel({ modelId: previousModelId }) } catch {}
  }
  reloading = false
}

// `predict` acota el número de tokens de salida — con SMOLLM2 360M (el modelo
// más chico disponible en el registro de QVAC para completions) el largo de
// la respuesta es la principal palanca que queda para acercarse a <2s de
// latencia on-device; los prompts ya piden 1-3 oraciones, esto lo garantiza.
async function runCompletion(userText, systemPrompt = SYSTEM_PROMPT, maxTokens = 64) {
  const run = completion({
    modelId: commentModelId,
    history: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ],
    stream: false,
    generationParams: { predict: maxTokens }
  })
  const result = await run.final
  return result.content ?? ''
}

/**
 * Comentarista/analista táctico on-device (QVAC). Si hay un peer worker
 * anunciado en la sala, la inferencia se DELEGA ahí (modelo más grande,
 * `QWEN3_1_7B_INST_Q4`) vía el mecanismo nativo de QVAC; si no hay worker o
 * la delegación falla, corre local con un modelo chico (SMOLLM2 360M). Si ni
 * eso carga (sin internet la primera vez, o corriendo fuera del runtime
 * Bare/Pear — ver README), cada método cae a un stub de texto plano en vez
 * de fallar, para que la UI nunca se quede sin respuesta.
 *
 * @param {object} [opts]
 * @param {(pct: number|null) => void} [opts.onProgress] - progreso de descarga del modelo (0-100, `null` al terminar)
 * @param {ReturnType<import('../p2p/capabilities.js').createCapabilities>} [opts.capabilities] - registro de workers P2P conocidos
 * @returns {Promise<{
 *   analyze: (event: {type:string, [k:string]:any}) => Promise<string>,
 *   analyzeTactical: () => Promise<string>,
 *   translate: (text: string, targetLang?: string) => Promise<string>,
 *   getHistory: () => object[],
 *   getRuntimeInfo: () => {mode:'local'|'delegated', workerId: string|null},
 *   destroy: () => void,
 * }>}
 */
export async function createCommentator({ onProgress, capabilities } = {}) {
  await loadCommentModel({ onProgress, capabilities })

  capabilities?.onChange(() => { void maybeSwitchWorker({ capabilities, onProgress }) })

  return {
    /**
     * Comenta un evento del partido (gol, falta, VAR, ...) o responde una
     * pregunta libre del usuario si `event.type === 'question'`.
     * @param {{type:string, text?:string, player?:string, minute?:number}} event
     * @returns {Promise<string>}
     */
    async analyze(event) {
      // Las preguntas libres del usuario van por su propio flujo
      if (event.type === 'question') {
        if (!commentModelId) return `[MouBot offline] ${event.text}`
        try {
          return await runCompletion(event.text, ASK_PROMPT)
        } catch {
          return `[MouBot offline] ${event.text}`
        }
      }

      const desc = describeEvent(event)
      eventHistory.push({ type: event.type ?? 'event', desc, ts: Date.now() })
      if (eventHistory.length > MAX_HISTORY) eventHistory.shift()

      if (!commentModelId) return `[Stub] ${desc}`
      try {
        return await runCompletion(`Comenta este momento: ${desc}`)
      } catch {
        return `[Stub] ${desc}`
      }
    },

    /** Analiza tácticamente las últimas jugadas registradas (hasta `MAX_HISTORY`). */
    async analyzeTactical() {
      if (eventHistory.length === 0) return 'No hay eventos registrados aún.'
      const summary = eventHistory.map((e, i) => `${i + 1}. ${e.type}: ${e.desc}`).join('\n')
      if (!commentModelId) return `[Stub táctico] Últimas ${eventHistory.length} jugadas registradas.`
      try {
        const run = completion({
          modelId: commentModelId,
          history: [
            { role: 'system', content: TACTICAL_PROMPT },
            { role: 'user',   content: `Historial de jugadas:\n${summary}\n\n¿Qué está pasando tácticamente?` }
          ],
          stream: false,
          generationParams: { predict: 110 } // 2-3 oraciones — un poco más largo que el comentario rápido
        })
        const result = await run.final
        return result.content ?? ''
      } catch {
        return `[Stub táctico] Últimas ${eventHistory.length} jugadas analizadas.`
      }
    },

    /** Traducción liviana vía completion (alternativa rápida al NMT pesado de `translator.js`). */
    async translate(text, targetLang = 'en') {
      if (!commentModelId) return `[Stub→${targetLang}] ${text}`
      try {
        const prompt = `Translate the following to ${targetLang}. Reply only with the translation:\n${text}`
        // La traducción escala con el largo del texto de entrada, con un techo
        // para no perder el objetivo de latencia en textos largos.
        const maxTokens = Math.min(200, Math.max(48, Math.ceil(text.length / 2)))
        return await runCompletion(prompt, SYSTEM_PROMPT, maxTokens)
      } catch {
        return `[Stub→${targetLang}] ${text}`
      }
    },

    getHistory() { return [...eventHistory] },

    /** Dónde corrió (o correría) la última respuesta: local en este dispositivo, o delegada a un peer. */
    getRuntimeInfo() { return { mode: runtimeMode, workerId: runtimeWorkerId } },

    destroy() { eventHistory.length = 0 }
  }
}
