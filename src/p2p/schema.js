/**
 * Tipos y validadores de mensajes P2P para MouFut.
 * Todos los mensajes tienen: { type, _v:1, _ts:timestamp, ...payload }
 */

export const MSG = Object.freeze({
  CHAT:            'chat',
  REACTION:        'reaction',
  PREDICTION:      'prediction',
  MATCH_EVENT:     'match_event',
  FINAL_SCORE:     'final_score',
  SETTLEMENT:      'settlement',
  STATE_SYNC:      'state_sync',
  QVAC_CAPABILITY: 'qvac_capability',
})

const isInt    = (v) => Number.isInteger(Number(v)) && Number(v) >= 0
const isAmount = (v) => typeof v === 'number' && isFinite(v) && v > 0
const isHex    = (v) => typeof v === 'string' && /^[0-9a-f]+$/.test(v)
const isStr    = (v) => typeof v === 'string' && v.length > 0
const isBool   = (v) => typeof v === 'boolean'

const VALIDATORS = {
  [MSG.CHAT]: (m) =>
    isStr(m.text) && m.text.length <= 500,

  [MSG.REACTION]: (m) =>
    isStr(m.reaction),

  [MSG.PREDICTION]: (m) =>
    isInt(m.home) &&
    isInt(m.away) &&
    isAmount(m.amount) &&
    isHex(m.sig) &&
    isHex(m.pubkey) &&
    m.pubkey.length === 64, // Ed25519 pubkey = 32 bytes = 64 hex chars

  [MSG.MATCH_EVENT]: (m) =>
    m.event != null && isStr(m.event.type),

  [MSG.FINAL_SCORE]: (m) =>
    isInt(m.home) && isInt(m.away),

  [MSG.SETTLEMENT]: (m) =>
    Array.isArray(m.winners) &&
    typeof m.amount === 'number' &&
    m.score != null,

  [MSG.STATE_SYNC]: (m) =>
    Array.isArray(m.bets) && Array.isArray(m.reports),

  // `available:false` anuncia que un peer deja de ofrecerse como worker
  // (deja de correr startQVACProvider) — ahí `publicKey`/`tier` no aplican.
  [MSG.QVAC_CAPABILITY]: (m) =>
    isBool(m.available) &&
    (m.available === false || (isHex(m.publicKey) && isStr(m.tier))),
}

/**
 * Valida un mensaje P2P recibido.
 * Mensajes desconocidos pasan la validación (forward-compatible).
 */
export function validate(msg) {
  if (!msg || typeof msg !== 'object') return false
  if (typeof msg.type !== 'string')    return false
  const check = VALIDATORS[msg.type]
  return check ? check(msg) : true
}

/** Crea un mensaje P2P tipado con versión y timestamp (respeta `_ts` si ya viene en `data`). */
export function createMsg(type, data = {}) {
  return { type, _v: 1, _ts: Date.now(), ...data }
}

/** Diccionario de etiquetas legibles para reacciones (sin emojis como íconos). */
export const REACTION_LABEL = {
  gol:   'GOL',
  falta: 'FALTA',
  var:   'VAR',
  roja:  'ROJA',
  fuera: 'FUERA',
}
