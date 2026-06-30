// UI controller — navegación entre pantallas y lógica de interfaz

const screens   = document.querySelectorAll('.screen')
const navItems  = document.querySelectorAll('.nav-item')

// ── Navegación ──────────────────────────────────────────────────────────────
function showScreen(id) {
  screens.forEach(s => s.classList.remove('active'))
  navItems.forEach(n => {
    const isActive = n.dataset.screen === id
    n.classList.toggle('active', isActive)
    n.setAttribute('aria-current', isActive ? 'page' : 'false')
  })
  document.getElementById(`screen-${id}`)?.classList.add('active')
}

navItems.forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen))
})

// ── Chat ────────────────────────────────────────────────────────────────────
const chatForm     = document.getElementById('chatForm')
const chatInput    = document.getElementById('chatInput')
const chatMessages = document.getElementById('chatMessages')

function appendMessage({ text, mine = true, meta = 'Tú · ahora' }) {
  const empty = chatMessages.querySelector('.chat-empty')
  if (empty) empty.remove()

  const el = document.createElement('div')
  el.className = `chat-msg ${mine ? 'mine' : 'other'}`
  el.innerHTML = `
    <div class="chat-bubble">${escapeHtml(text)}</div>
    <span class="chat-msg-meta">${escapeHtml(meta)}</span>
  `
  chatMessages.appendChild(el)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function appendReaction(label) {
  const el = document.createElement('div')
  el.className = 'chat-reaction-bubble'
  el.textContent = label
  chatMessages.appendChild(el)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

chatForm.addEventListener('submit', e => {
  e.preventDefault()
  const text = chatInput.value.trim()
  if (!text) return
  appendMessage({ text, mine: true })
  chatInput.value = ''
  chatInput.focus()
  // TODO: enviar por P2P cuando swarm esté conectado
})

// ── Reacciones ───────────────────────────────────────────────────────────────
const REACTION_LABELS = { gol: '⚽ GOL!', falta: '🟡 FALTA', var: '📺 VAR', roja: '🟥 ROJA', fuera: '❌ FUERA' }

document.querySelectorAll('.reaction-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const label = REACTION_LABELS[btn.dataset.reaction] || btn.dataset.reaction.toUpperCase()
    appendReaction(label)
    // TODO: broadcast por P2P
  })
})

// ── Copiar código de sala ────────────────────────────────────────────────────
document.getElementById('btnCopyRoom')?.addEventListener('click', () => {
  const code = document.getElementById('roomCode').textContent
  navigator.clipboard?.writeText(code).catch(() => {})
  showToast('Código copiado')
})

// ── IA — preguntas rápidas ───────────────────────────────────────────────────
const iaForm  = document.getElementById('iaForm')
const iaInput = document.getElementById('iaInput')
const feed    = document.getElementById('commentaryFeed')

document.querySelectorAll('.btn-quick').forEach(btn => {
  btn.addEventListener('click', () => {
    iaInput.value = btn.dataset.question
    askMouBot(btn.dataset.question)
  })
})

iaForm.addEventListener('submit', e => {
  e.preventDefault()
  const q = iaInput.value.trim()
  if (!q) return
  askMouBot(q)
  iaInput.value = ''
})

function askMouBot(question) {
  setIAStatus('Pensando...')
  // TODO: llamar a QVAC on-device
  setTimeout(() => {
    addCommentary({ time: getCurrentMatchTime(), tag: 'MouBot', text: `[Respuesta simulada] "${question}" — análisis táctico en espera de integración QVAC.` })
    setIAStatus('Listo')
  }, 1200)
}

function addCommentary({ time, tag, text }) {
  const placeholder = document.getElementById('commentaryPlaceholder')
  const el = document.createElement('div')
  el.className = 'commentary-item'
  el.innerHTML = `
    <div class="comment-meta">
      <span class="comment-time">${escapeHtml(time)}</span>
      <span class="comment-tag">${escapeHtml(tag)}</span>
    </div>
    <p class="comment-text">${escapeHtml(text)}</p>
  `
  feed.insertBefore(el, placeholder)
  feed.scrollTop = 0
}

function setIAStatus(text) {
  const el = document.getElementById('iaStatusText')
  if (el) el.textContent = text
}

// ── Quiniela ─────────────────────────────────────────────────────────────────
document.getElementById('btnPlaceBet')?.addEventListener('click', () => {
  const home   = document.getElementById('betHome').value
  const away   = document.getElementById('betAway').value
  const amount = document.getElementById('betAmount').value
  if (!home || !away || !amount || Number(amount) <= 0) {
    showToast('Completa tu predicción y monto')
    return
  }
  showToast(`Apuesta enviada: ${home}-${away} · ${amount} USDt`)
  // TODO: integrar WDK para firma y broadcast
})

document.getElementById('btnCreateWallet')?.addEventListener('click', () => {
  showToast('Creando cartera... (WDK pendiente)')
})

document.getElementById('btnImportWallet')?.addEventListener('click', () => {
  showToast('Importar cartera... (WDK pendiente)')
})

// ── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  toast.textContent = msg
  document.body.appendChild(toast)

  requestAnimationFrame(() => toast.classList.add('toast-visible'))
  setTimeout(() => {
    toast.classList.remove('toast-visible')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getCurrentMatchTime() {
  return document.getElementById('matchTime')?.textContent || '—'
}

// ── Estado P2P (para cuando se conecte el swarm) ─────────────────────────────
export function updateConnectionStatus({ connected, peers = 0 }) {
  const dot   = document.getElementById('connectionDot')
  const label = document.getElementById('connectionLabel')
  const count = document.getElementById('peersCount')

  dot?.classList.toggle('connected', connected)
  dot?.classList.toggle('searching', !connected)
  if (label) label.textContent = connected ? 'P2P' : 'Buscando'
  if (count) count.textContent = `${peers} peer${peers !== 1 ? 's' : ''}`
}

export function receiveMessage({ text, from }) {
  appendMessage({ text, mine: false, meta: `${from} · ahora` })
}

export function receiveReaction({ label }) {
  appendReaction(label)
}
