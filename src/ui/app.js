import { createSwarm }       from '../p2p/swarm.js'
import { createChat }        from '../p2p/chat.js'
import { createBoard }       from '../p2p/board.js'
import { createCommentator } from '../ai/commentator.js'
import { createWallet }      from '../wallet/wallet.js'

// ── Room ID ──────────────────────────────────────────────────────────────────
const roomId = location.hash.replace('#', '').trim() || 'moufut-default'

// ── Navigation ───────────────────────────────────────────────────────────────
const screens  = document.querySelectorAll('.screen')
const navItems = document.querySelectorAll('.nav-item')

function showScreen(id) {
  screens.forEach(s => s.classList.remove('active'))
  navItems.forEach(n => {
    const active = n.dataset.screen === id
    n.classList.toggle('active', active)
    n.setAttribute('aria-current', active ? 'page' : 'false')
  })
  document.getElementById(`screen-${id}`)?.classList.add('active')
}

navItems.forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)))

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getCurrentMatchTime() {
  return document.getElementById('matchTime')?.textContent || '—'
}

let toastTimer = null
function showToast(msg) {
  let toast = document.querySelector('.toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'toast'
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    document.body.appendChild(toast)
  }
  toast.textContent = msg
  clearTimeout(toastTimer)
  toast.classList.add('toast-visible')
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast-visible')
  }, 3000)
}

// ── Connection status ─────────────────────────────────────────────────────────
function updateConnectionStatus({ connected, peers = 0 }) {
  const dot   = document.getElementById('connectionDot')
  const label = document.getElementById('connectionLabel')
  const count = document.getElementById('peersCount')
  dot?.classList.toggle('connected', connected)
  dot?.classList.toggle('searching', !connected)
  if (label) label.textContent = connected ? 'P2P' : 'Buscando'
  if (count) count.textContent = `${peers} peer${peers !== 1 ? 's' : ''}`
}

// ── Chat UI ───────────────────────────────────────────────────────────────────
const chatMessages = document.getElementById('chatMessages')

function appendChatMessage({ text, mine = true, from = 'Tú' }) {
  const empty = chatMessages.querySelector('.chat-empty')
  if (empty) empty.remove()

  const el = document.createElement('div')
  el.className = `chat-msg ${mine ? 'mine' : 'other'}`
  el.innerHTML = `
    <div class="chat-bubble">${escapeHtml(text)}</div>
    <span class="chat-msg-meta">${escapeHtml(from)} · ahora</span>
  `
  chatMessages.appendChild(el)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function appendReactionBubble(label) {
  const el = document.createElement('div')
  el.className = 'chat-reaction-bubble'
  el.textContent = label
  chatMessages.appendChild(el)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// ── IA commentary UI ──────────────────────────────────────────────────────────
const commentaryFeed = document.getElementById('commentaryFeed')

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
  commentaryFeed.scrollTop = 0
}

function setIAStatus(text) {
  const el = document.getElementById('iaStatusText')
  if (el) el.textContent = text
}

// ── Board UI (predicciones) ───────────────────────────────────────────────────
function renderBoard(predictions) {
  const container = document.getElementById('poolParticipants')
  const poolPlayers = document.getElementById('poolPlayers')
  const poolPot    = document.getElementById('poolPot')
  const potAmount  = document.getElementById('poolAmount')

  if (!container) return

  if (predictions.length === 0) {
    container.innerHTML = '<div class="participant-empty"><p>Nadie ha apostado aún.<br/>Sé el primero en predecir el marcador.</p></div>'
    if (poolPlayers) poolPlayers.textContent = '0'
    if (poolPot)    poolPot.textContent    = '0'
    if (potAmount)  potAmount.textContent  = '0'
    return
  }

  const total = predictions.reduce((s, p) => s + (p.amount ?? 0), 0)
  if (poolPlayers) poolPlayers.textContent = predictions.length
  if (poolPot)    poolPot.textContent    = total.toFixed(2)
  if (potAmount)  potAmount.textContent  = total.toFixed(2)

  container.innerHTML = predictions.map(p => `
    <div class="participant-row">
      <span class="participant-id">${escapeHtml(p.peerId.slice(0, 8))}</span>
      <span class="participant-pred">${p.home}-${p.away}</span>
      <span class="participant-amount">${Number(p.amount).toFixed(2)} USDt</span>
    </div>
  `).join('')
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  document.getElementById('roomCode')?.setAttribute('textContent', roomId)
  const codeEl = document.getElementById('roomCode')
  if (codeEl) codeEl.textContent = roomId

  updateConnectionStatus({ connected: false, peers: 0 })

  // P2P
  const swarm = await createSwarm(roomId)
  const chat  = createChat(swarm)
  const board = createBoard({ swarm, myId: chat.myId })

  // IA
  const ai     = await createCommentator()
  const wallet = await createWallet()

  // Wallet address
  const addrEl = document.getElementById('walletAddress')
  if (wallet.address && addrEl) addrEl.textContent = wallet.address

  // Swarm events
  swarm.onPeerJoin((peerId) => {
    updateConnectionStatus({ connected: true, peers: swarm.peers.length })
    appendReactionBubble(`${peerId.slice(0, 8)} se unió`)
    showToast(`Peer conectado: ${peerId.slice(0, 8)}`)
  })

  swarm.onPeerLeave((peerId) => {
    updateConnectionStatus({ connected: swarm.peers.length > 0, peers: swarm.peers.length })
    appendReactionBubble(`${peerId.slice(0, 8)} salió`)
  })

  // Chat
  const chatForm  = document.getElementById('chatForm')
  const chatInput = document.getElementById('chatInput')

  chat.onMessage(({ text, from, fromPeer }) => {
    appendChatMessage({ text, mine: false, from: fromPeer.slice(0, 8) })
  })

  chatForm?.addEventListener('submit', e => {
    e.preventDefault()
    const text = chatInput.value.trim()
    if (!text) return
    chat.send(text)
    appendChatMessage({ text, mine: true })
    chatInput.value = ''
    chatInput.focus()
  })

  // Reactions — sin emojis, solo texto
  const REACTION_LABELS = {
    gol:   'GOL',
    falta: 'FALTA',
    var:   'VAR',
    roja:  'ROJA',
    fuera: 'FUERA'
  }

  swarm.onMessage((msg) => {
    if (msg.type !== 'reaction') return
    appendReactionBubble(REACTION_LABELS[msg.reaction] ?? msg.reaction)
  })

  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const reaction = btn.dataset.reaction
      const label    = REACTION_LABELS[reaction] ?? reaction.toUpperCase()
      swarm.send({ type: 'reaction', reaction })
      appendReactionBubble(label)
    })
  })

  // Board predictions
  board.onChange(renderBoard)

  document.getElementById('btnPlaceBet')?.addEventListener('click', () => {
    const home   = document.getElementById('betHome').value
    const away   = document.getElementById('betAway').value
    const amount = document.getElementById('betAmount').value
    if (!home || !away || !amount || Number(amount) <= 0) {
      showToast('Completa tu predicción y monto')
      return
    }
    board.submit({ home, away, amount })
    showToast(`Predicción enviada: ${home}-${away} · ${amount} USDt`)
  })

  // Wallet actions
  document.getElementById('btnCreateWallet')?.addEventListener('click', async () => {
    showToast('Creando cartera...')
    try {
      const w = await wallet.create()
      if (addrEl) addrEl.textContent = w.address
      showToast('Cartera creada. Guarda tu frase secreta.')
    } catch {
      showToast('WDK pendiente de integración')
    }
  })

  document.getElementById('btnImportWallet')?.addEventListener('click', () => {
    showToast('Importar cartera: WDK pendiente')
  })

  // Copy room code
  document.getElementById('btnCopyRoom')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(roomId).catch(() => {})
    showToast('Código copiado')
  })

  // IA — preguntas rápidas y formulario
  const iaForm  = document.getElementById('iaForm')
  const iaInput = document.getElementById('iaInput')

  async function askMouBot(question) {
    setIAStatus('Pensando...')
    try {
      const text = await ai.analyze({ type: 'question', text: question })
      addCommentary({ time: getCurrentMatchTime(), tag: 'MouBot', text })
    } catch {
      addCommentary({ time: getCurrentMatchTime(), tag: 'MouBot', text: `[Sin respuesta] ${question}` })
    } finally {
      setIAStatus('Listo')
    }
  }

  document.querySelectorAll('.btn-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      iaInput.value = btn.dataset.question
      askMouBot(btn.dataset.question)
    })
  })

  iaForm?.addEventListener('submit', e => {
    e.preventDefault()
    const q = iaInput.value.trim()
    if (!q) return
    askMouBot(q)
    iaInput.value = ''
  })

  // IA comentarista — reacciones a jugadas recibidas
  swarm.onMessage(async (msg) => {
    if (msg.type !== 'match_event') return
    setIAStatus('Analizando...')
    try {
      const comment = await ai.analyze(msg.event)
      addCommentary({ time: getCurrentMatchTime(), tag: msg.event.type ?? 'Evento', text: comment })
    } finally {
      setIAStatus('Listo')
    }
  })
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => console.error('[MouFut] Error al inicializar:', err))
})
