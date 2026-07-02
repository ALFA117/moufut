import { completion, unloadModel } from '@qvac/sdk'
import { SMOLLM2_360M_INST_Q8, QWEN3_1_7B_INST_Q4, LLAMA_TOOL_CALLING_1B_INST_Q4_K } from '@qvac/sdk/models'
import { loadWithDelegateFallback } from './delegation.js'
import { searchKnowledge } from './rag.js'

// Modelo "rápido" para quips de eventos/táctica (chico, hardware débil) vs. el
// que se le pide a un peer worker (más grande/capaz) cuando hay uno anunciado
// en la sala — ver delegation.js.
const LOCAL_MODEL  = SMOLLM2_360M_INST_Q8
const REMOTE_MODEL = QWEN3_1_7B_INST_Q4

// Modelo "orquestador" (tool calling) para la caja de preguntas libres — se
// carga aparte y bajo demanda, solo si al comentarista le pasan `tools`.
// Local: 1B afinado específicamente para tool calling. Delegado: el mismo
// REMOTE_MODEL de arriba (QWEN3_1_7B_INST_Q4 ya soporta tools de forma
// nativa — ver examples/tools/llamacpp-native-tools.js del SDK), así un
// worker solo necesita tener cargado un modelo para ambos usos.
const ORCHESTRATOR_LOCAL_MODEL = LLAMA_TOOL_CALLING_1B_INST_Q4_K

const ORCHESTRATOR_PROMPT = `Eres MouBot, el cerebro del partido: un asistente de fútbol on-device que puede usar herramientas para responder con datos reales de esta sala en vez de inventarlos.
- Usa get_match_state si preguntan por el marcador o el minuto actual.
- Usa query_board si preguntan qué predicen otros peers de la sala.
- Usa translate_text si piden traducir algo.
- Usa get_pool_status si preguntan por el bote o el estado de la quiniela.
- Usa place_bet si el usuario quiere apostar un marcador — nunca envías dinero tú mismo, solo preparas la apuesta para que la confirme.
Si la pregunta es táctica o de cultura general de fútbol, respóndela directo sin usar herramientas.
Responde siempre en 1-3 oraciones, en español.`

let commentModelId  = null
let orchestratorModelId    = null
let orchestratorLoadPromise = null
// `LLAMA_TOOL_CALLING_1B_INST_Q4_K` es un fine-tune de Llama para tool
// calling: el propio SDK documenta que estos modelos suelen emitir el header
// "pythonic" nativo de Llama en vez del formato que el auto-detector por
// nombre reconoce (ver JSDoc de `toolDialect` en completion-stream.d.ts). Se
// fuerza el dialecto solo cuando corre local con ese modelo; delegado usa
// QWEN3_1_7B_INST_Q4, que sí se auto-detecta bien (ver examples/tools/llamacpp-native-tools.js).
let orchestratorDialect = undefined

// Dónde corrió la ÚLTIMA respuesta real (fast o orquestador) — lo que
// muestra el badge de la UI. Se actualiza en cada carga/respuesta exitosa.
let lastMode      = 'local'   // 'local' | 'delegated'
let lastWorkerId  = null
let reloading     = false

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
 * Carga el modelo "rápido" del comentarista, delegando a un peer worker de la
 * sala si `capabilities` conoce uno (ver `p2p/capabilities.js` +
 * `ai/delegation.js`), o corriendo local si no hay ninguno o la delegación falla.
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
    markLastRun(result.mode, result.peerId ?? null)
    onProgress?.(null)
    console.log(`[IA] Modelo listo (${result.mode}${result.peerId ? ' · peer ' + result.peerId : ''}):`, commentModelId)
  } catch (err) {
    console.warn('[IA] No se pudo cargar QVAC:', err.message)
    commentModelId  = null
    onProgress?.(null)
  }
}

function markLastRun(mode, workerId) {
  lastMode     = mode
  lastWorkerId = workerId
}

/**
 * Reevalúa si conviene cambiar de worker: si el worker delegado actual se
 * fue de la sala (hay que caer a local), o si estábamos en local y acaba de
 * aparecer un worker (conviene subir de modelo). Se llama cuando cambia el
 * registro de capacidades P2P — nunca en medio de una respuesta en curso.
 * Solo reacomoda el modelo "rápido"; el orquestador (si ya se cargó) se
 * queda como está por simplicidad — recargarlo a mitad de sesión es un
 * refinamiento de una ronda futura.
 */
async function maybeSwitchWorker({ capabilities, onProgress } = {}) {
  if (reloading || !capabilities) return

  const worker = capabilities.bestWorker()
  const stillDelegatedToKnownWorker = lastMode === 'delegated' && worker?.peerId === lastWorkerId
  const lostOurWorker  = lastMode === 'delegated' && !stillDelegatedToKnownWorker
  const gainedAWorker  = lastMode === 'local' && worker != null

  if (!lostOurWorker && !gainedAWorker) return

  reloading = true
  const previousModelId = commentModelId
  await loadCommentModel({ onProgress, capabilities })
  if (previousModelId && previousModelId !== commentModelId) {
    try { await unloadModel({ modelId: previousModelId }) } catch {}
  }
  reloading = false
}

/**
 * Carga el modelo orquestador (tool calling) la primera vez que hace falta.
 * Llamadas concurrentes comparten la misma carga en curso.
 */
async function ensureOrchestratorModel({ capabilities, onProgress }) {
  if (orchestratorModelId) return orchestratorModelId
  if (!orchestratorLoadPromise) {
    orchestratorLoadPromise = (async () => {
      const worker = capabilities?.bestWorker() ?? null
      const result = await loadWithDelegateFallback({
        worker,
        remoteModel: REMOTE_MODEL,
        localModel: ORCHESTRATOR_LOCAL_MODEL,
        // ctx_size igual al del ejemplo oficial de tool calling del SDK — el
        // default puede ser insuficiente para las definiciones de las 5 tools.
        modelConfig: { tools: true, ctx_size: 4096 },
        // `loadModel` llama a onProgress con el objeto de progreso completo
        // ({percentage, downloaded, total}) — igual que en loadCommentModel,
        // acá se lo pasamos al callback del caller ya reducido al número.
        onProgress: (p) => {
          if (p.percentage != null) {
            console.log(`[IA] Descargando orquestador... ${p.percentage.toFixed(0)}%`)
            onProgress?.(p.percentage)
          }
        }
      })
      orchestratorModelId  = result.modelId
      orchestratorDialect  = result.mode === 'local' ? 'pythonic' : undefined
      markLastRun(result.mode, result.peerId ?? null)
      onProgress?.(null)
      console.log(`[IA] Orquestador listo (${result.mode}${result.peerId ? ' · peer ' + result.peerId : ''}):`, orchestratorModelId)
      return orchestratorModelId
    })().catch((err) => {
      orchestratorLoadPromise = null // permite reintentar en la próxima pregunta
      onProgress?.(null)
      throw err
    })
  }
  return orchestratorLoadPromise
}

/**
 * Turno completo de tool calling: el modelo decide si necesita alguna
 * herramienta, esta función las ejecuta (`call.invoke()`, provisto por QVAC)
 * y hace una segunda pasada con los resultados para la respuesta final en
 * lenguaje natural. Ver `node_modules/@qvac/sdk/dist/examples/tools/llamacpp-native-tools.js`.
 */
async function runOrchestratorTurn(userText, tools, context = '') {
  const history = [
    { role: 'system', content: ORCHESTRATOR_PROMPT },
    { role: 'user', content: context ? `${context}Pregunta: ${userText}` : userText }
  ]

  const run = completion({ modelId: orchestratorModelId, history, stream: false, tools, toolDialect: orchestratorDialect, generationParams: { predict: 150 } })
  const result = await run.final

  if (!result.toolCalls?.length) return result.contentText ?? ''

  history.push({ role: 'assistant', content: result.contentText ?? '' })
  for (const call of result.toolCalls) {
    let toolResult
    try {
      toolResult = call.invoke ? await call.invoke() : { error: `Sin handler para "${call.name}"` }
    } catch (err) {
      toolResult = { error: err.message }
    }
    console.log(`[IA] Tool call: ${call.name}(${JSON.stringify(call.arguments)}) ->`, toolResult)
    history.push({ role: 'tool', content: JSON.stringify(toolResult) })
  }

  const followUp = completion({ modelId: orchestratorModelId, history, stream: false, tools, toolDialect: orchestratorDialect, generationParams: { predict: 150 } })
  const followUpResult = await followUp.final
  return followUpResult.contentText ?? ''
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
  return result.contentText ?? ''
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
 * Si se pasan `tools` (ver `ai/tools.js`), las preguntas libres
 * (`analyze({type:'question'})`) se enrutan por un orquestador con tool
 * calling que decide solo qué herramienta usar; si el orquestador no está
 * disponible, cae a una respuesta simple sin herramientas. Toda pregunta
 * libre, con o sin orquestador, primero busca contexto en la base de fútbol
 * on-device (`ai/rag.js`) y lo agrega al prompt si encuentra algo relevante.
 *
 * @param {object} [opts]
 * @param {(pct: number|null) => void} [opts.onProgress] - progreso de descarga del modelo (0-100, `null` al terminar)
 * @param {ReturnType<import('../p2p/capabilities.js').createCapabilities>} [opts.capabilities] - registro de workers P2P conocidos
 * @param {import('@qvac/sdk').Tool[]} [opts.tools] - herramientas locales para el orquestador (ver `ai/tools.js`)
 * @returns {Promise<{
 *   analyze: (event: {type:string, [k:string]:any}) => Promise<string>,
 *   analyzeTactical: () => Promise<string>,
 *   translate: (text: string, targetLang?: string) => Promise<string>,
 *   getHistory: () => object[],
 *   getRuntimeInfo: () => {mode:'local'|'delegated', workerId: string|null},
 *   destroy: () => void,
 * }>}
 */
export async function createCommentator({ onProgress, capabilities, tools } = {}) {
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
        // RAG sobre la base de fútbol (ver ai/rag.js) — si no hay resultados
        // relevantes o QVAC no está disponible, devuelve [] y se responde
        // igual, solo que sin el contexto extra.
        const knowledge = await searchKnowledge(event.text)
        const context = knowledge.length
          ? `Contexto relevante de la base de conocimiento:\n${knowledge.map(k => `- ${k.content}`).join('\n')}\n\n`
          : ''

        if (tools?.length) {
          try {
            await ensureOrchestratorModel({ capabilities, onProgress })
            return await runOrchestratorTurn(event.text, tools, context)
          } catch (err) {
            console.warn('[IA] Orquestador no disponible, respondo sin herramientas:', err.message)
            // sigue abajo al camino simple como respaldo
          }
        }
        if (!commentModelId) return `[MouBot offline] ${event.text}`
        try {
          return await runCompletion(context ? `${context}Pregunta: ${event.text}` : event.text, ASK_PROMPT)
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
        return result.contentText ?? ''
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
    getRuntimeInfo() { return { mode: lastMode, workerId: lastWorkerId } },

    destroy() { eventHistory.length = 0 }
  }
}
