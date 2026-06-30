import { loadModel, completion } from '@qvac/sdk'
import { SMOLLM2_360M_INST_Q8 } from '@qvac/sdk/models'

let commentModelId = null
const eventHistory = []
const MAX_HISTORY  = 8

const SYSTEM_PROMPT    = 'Eres un comentarista deportivo apasionado de fútbol. Responde siempre en 1-2 oraciones cortas, estilo radio en vivo.'
const TACTICAL_PROMPT  = 'Eres un analista táctico de fútbol. Dado el historial de jugadas, genera un análisis táctico breve (2-3 oraciones) sobre lo que está pasando en el partido.'

const EVENT_DESC = {
  goal:       (e) => `GOL de ${e.player ?? 'jugador desconocido'} al minuto ${e.minute ?? '?'}.`,
  foul:       (e) => `Falta de ${e.player ?? 'jugador'} al minuto ${e.minute ?? '?'}.`,
  var:        (e) => `Revisión VAR: ${e.outcome ?? 'en revisión'} (min ${e.minute ?? '?'}).`,
  yellowCard: (e) => `Tarjeta amarilla para ${e.player ?? 'jugador'} al minuto ${e.minute ?? '?'}.`,
  redCard:    (e) => `Tarjeta roja — ${e.player ?? 'jugador'} expulsado al minuto ${e.minute ?? '?'}.`,
}

function describeEvent(event) {
  const fn = EVENT_DESC[event.type]
  return fn ? fn(event) : `Evento "${event.type}" en el partido.`
}

async function loadCommentModel() {
  try {
    commentModelId = await loadModel({
      modelSrc: SMOLLM2_360M_INST_Q8,
      onProgress: (p) => {
        if (p.percentage != null) process.stderr.write(`\r[IA] Descargando modelo... ${p.percentage.toFixed(0)}%`)
      }
    })
    process.stderr.write('\n')
    console.log('[IA] Modelo on-device listo:', commentModelId)
  } catch (err) {
    console.warn('[IA] No se pudo cargar QVAC:', err.message)
    commentModelId = null
  }
}

async function runCompletion(userText) {
  const run = completion({
    modelId: commentModelId,
    history: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userText }
    ],
    stream: false
  })
  const result = await run.final
  return result.content ?? ''
}

export async function createCommentator() {
  await loadCommentModel()

  return {
    async analyze(event) {
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
          stream: false
        })
        const result = await run.final
        return result.content ?? ''
      } catch {
        return `[Stub táctico] Últimas ${eventHistory.length} jugadas analizadas.`
      }
    },

    async translate(text, targetLang = 'en') {
      if (!commentModelId) return `[Stub→${targetLang}] ${text}`
      try {
        const prompt = `Translate the following to ${targetLang}. Reply only with the translation:\n${text}`
        return await runCompletion(prompt)
      } catch {
        return `[Stub→${targetLang}] ${text}`
      }
    },

    getHistory() { return [...eventHistory] },

    destroy() { eventHistory.length = 0 }
  }
}
