import { createSwarm }        from '../p2p/swarm.js'
import { createChat }         from '../p2p/chat.js'
import { createCapabilities } from '../p2p/capabilities.js'
import { createBoard }        from '../p2p/board.js'
import { createCommentator }  from '../ai/commentator.js'
import { createTools }        from '../ai/tools.js'
import { becomeWorker, stopBeingWorker, WORKER_TIER } from '../ai/delegation.js'
import { createWallet }       from '../wallet/wallet.js'
import { createPool }         from '../wallet/pool.js'
import { createIdentity }     from '../p2p/identity.js'
import { REACTION_LABEL }     from '../p2p/schema.js'

// ── Room ID ──────────────────────────────────────────────────────────────────
const roomId = location.hash.replace('#', '').trim() || 'moufut-default'

// ── Modo LAN sin internet ────────────────────────────────────────────────────
// `?bootstrap=host:port` apunta a un nodo propio levantado con
// `scripts/lan-bootstrap.js` en la misma red local, en vez de la DHT pública
// (que necesita internet). Sin este parámetro, comportamiento normal.
const lanBootstrap = (() => {
  const raw = new URLSearchParams(location.search).get('bootstrap')
  if (!raw) return null
  const [host, portStr] = raw.split(':')
  const port = Number(portStr)
  if (!host || !port) return null
  return [{ host, port }]
})()

// ── Prefer reduced motion ────────────────────────────────────────────────────
const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Navigation ───────────────────────────────────────────────────────────────
const screens  = document.querySelectorAll('.screen')
const navItems = document.querySelectorAll('.nav-item')

function showScreen(id) {
  screens.forEach(s  => s.classList.remove('active'))
  navItems.forEach(n => {
    const active = n.dataset.screen === id
    n.classList.toggle('active', active)
    n.setAttribute('aria-current', active ? 'page' : 'false')
  })
  document.getElementById(`screen-${id}`)?.classList.add('active')
}

navItems.forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)))

// ── Accessibility announcer ──────────────────────────────────────────────────
const announcer = document.getElementById('announcer')
function announce(msg) { if (announcer) announcer.textContent = msg }

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getCurrentMatchTime() {
  return document.getElementById('matchTime')?.textContent || '—'
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null
function showToast(msg) {
  let el = document.querySelector('.toast')
  if (!el) {
    el = document.createElement('div')
    el.className = 'toast'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    document.body.appendChild(el)
  }
  el.textContent = msg
  clearTimeout(toastTimer)
  el.classList.add('toast-visible')
  toastTimer = setTimeout(() => el.classList.remove('toast-visible'), 3500)
}

// ── GOL Burst (CSS particle system) ─────────────────────────────────────────
function triggerGolBurst() {
  if (REDUCE_MOTION) return
  const container = document.createElement('div')
  container.className = 'gol-burst-container'
  container.setAttribute('aria-hidden', 'true')
  document.body.appendChild(container)

  const COLORS = ['#00E676', '#FFB300', '#8B5CF6', '#FF1744', '#FFFFFF']
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div')
    p.className = 'gol-particle'
    const angle = (i / 18) * 360
    const dist  = 70 + Math.random() * 80
    p.style.setProperty('--angle', `${angle}deg`)
    p.style.setProperty('--dist',  `${dist}px`)
    p.style.setProperty('--color', COLORS[i % COLORS.length])
    p.style.setProperty('--delay', `${Math.floor(Math.random() * 80)}ms`)
    container.appendChild(p)
  }
  setTimeout(() => container.remove(), 1400)
}

// ── Score flash ───────────────────────────────────────────────────────────────
function flashScore() {
  const elements = document.querySelectorAll('.score')
  elements.forEach(el => {
    el.classList.add('score-flash')
    setTimeout(() => el.classList.remove('score-flash'), 600)
  })
}

// ── Animated counter for pot ─────────────────────────────────────────────────
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }

let potAnimFrame   = null
let potCurrentVal  = 0

function animatePot(to) {
  if (REDUCE_MOTION) {
    const setAll = (v) => {
      const s = Number(v).toFixed(2)
      document.getElementById('poolAmount').textContent = s
      document.getElementById('poolPot').textContent    = s
    }
    setAll(to)
    potCurrentVal = to
    return
  }
  cancelAnimationFrame(potAnimFrame)
  const from     = potCurrentVal
  const duration = 600
  const start    = performance.now()
  function tick(now) {
    const t = Math.min((now - start) / duration, 1)
    const v = from + (to - from) * easeOutCubic(t)
    const s = v.toFixed(2)
    document.getElementById('poolAmount').textContent = s
    document.getElementById('poolPot').textContent    = s
    if (t < 1) { potAnimFrame = requestAnimationFrame(tick) }
    else        { potCurrentVal = to }
  }
  potAnimFrame = requestAnimationFrame(tick)
}

function popStatusValue(id) {
  const el = document.getElementById(id)
  if (!el || REDUCE_MOTION) return
  el.classList.remove('pop')
  void el.offsetWidth // reflow to restart
  el.classList.add('pop')
  setTimeout(() => el.classList.remove('pop'), 450)
}

// ── Connection status ─────────────────────────────────────────────────────────
function updateConnectionStatus({ connected, peers = 0 }) {
  const dot   = document.getElementById('connectionDot')
  const label = document.getElementById('connectionLabel')
  const count = document.getElementById('peersCount')
  dot?.classList.toggle('connected', connected)
  dot?.classList.toggle('searching', !connected)
  if (label) label.textContent = connected ? (lanBootstrap ? 'P2P · LAN sin internet' : 'P2P') : 'Buscando...'
  if (count) count.textContent = `${peers} peer${peers !== 1 ? 's' : ''}`
}

// ── Chat UI ───────────────────────────────────────────────────────────────────
const chatMessages = document.getElementById('chatMessages')

function appendChatMessage({ text, mine = true, from = 'Tú' }) {
  chatMessages.querySelector('.chat-empty')?.remove()
  const el = document.createElement('div')
  el.className = `chat-msg ${mine ? 'mine' : 'other'}`
  el.innerHTML = `
    <div class="chat-bubble">${escapeHtml(text)}</div>
    <span class="chat-msg-meta">${escapeHtml(from)} · ahora</span>
  `
  chatMessages.appendChild(el)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function appendReactionBubble(label, isGol = false) {
  const el = document.createElement('div')
  el.className = isGol ? 'gol-badge' : 'chat-reaction-bubble'
  if (isGol) {
    el.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
      </svg>
      GOL
    `
    triggerGolBurst()
    flashScore()
  } else {
    el.textContent = label
  }
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
  if (placeholder) commentaryFeed.insertBefore(el, placeholder)
  else             commentaryFeed.appendChild(el)
  commentaryFeed.scrollTop = 0
}

function setIAStatus(text) {
  const el = document.getElementById('iaStatusText')
  if (el) el.textContent = text
}

function showModelProgress(pct) {
  const card  = document.getElementById('modelProgressCard')
  const fill  = document.getElementById('modelProgressFill')
  const pctEl = document.getElementById('modelProgressPct')
  const bar   = document.getElementById('modelProgressBar')
  if (!card) return
  if (pct === null) { card.hidden = true; return }
  card.hidden = false
  if (fill)  fill.style.width = `${pct}%`
  if (pctEl) pctEl.textContent = `${Math.round(pct)}%`
  if (bar)   bar.setAttribute('aria-valuenow', Math.round(pct))
}

// ── Board / Pool UI ────────────────────────────────────────────────────────────
function renderBets(bets, myId) {
  const container  = document.getElementById('poolParticipants')
  const poolPlayers = document.getElementById('poolPlayers')
  const badge      = document.getElementById('quinielaBadge')
  if (!container) return

  if (bets.length === 0) {
    container.innerHTML = '<div class="participant-empty"><p>Nadie ha apostado aún.<br/>Sé el primero en predecir el marcador.</p></div>'
    if (poolPlayers) poolPlayers.textContent = '0'
    if (badge)       badge.hidden = true
    return
  }

  if (poolPlayers) {
    poolPlayers.textContent = bets.length
    popStatusValue('poolPlayers')
  }

  if (badge) badge.hidden = false

  container.innerHTML = bets.map(b => {
    const isMe  = b.peerId === myId
    const vIcon = b.verified
      ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>`

    return `
      <div class="participant-row" role="listitem">
        <span class="participant-verified ${b.verified ? 'ok' : 'fail'}"
              title="${b.verified ? 'Firma verificada' : 'Firma inválida'}"
              aria-label="${b.verified ? 'Apuesta verificada' : 'Firma no verificada'}">
          ${vIcon}
        </span>
        <span class="participant-id">${escapeHtml(b.peerId.slice(0, 8))}${isMe ? ' (tú)' : ''}</span>
        <span class="participant-pred">${b.home}–${b.away}</span>
        <span class="participant-amount">${Number(b.amount).toFixed(2)} USDt</span>
      </div>
    `
  }).join('')
}

function renderConsensusReports(reports, consensus) {
  const section  = document.getElementById('consensusReports')
  const list     = document.getElementById('consensusList')
  const badge    = document.getElementById('consensusBadge')
  const liquidBtn = document.getElementById('btnLiquidate')

  if (!section || reports.length === 0) {
    if (section) section.hidden = true
    return
  }

  section.hidden = false
  list.innerHTML = reports.map(r => {
    const key      = consensus && `${consensus.home}:${consensus.away}` === `${r.home}:${r.away}`
    return `
      <div class="consensus-item${key ? ' matching' : ''}">
        <span class="consensus-peer">${r.peerId.slice(0, 8)}</span>
        <span class="consensus-score">${r.home}–${r.away}</span>
      </div>
    `
  }).join('')

  if (badge)      badge.hidden    = !consensus
  if (liquidBtn)  liquidBtn.hidden = !consensus
}

// ── Settlement modal ──────────────────────────────────────────────────────────
function showSettlement({ score, winners, share, iAmWinner, noWinners = false }) {
  const overlay = document.getElementById('settlementOverlay')
  if (!overlay) return

  document.getElementById('settlementScore').textContent = score ? `${score.home} – ${score.away}` : '—'
  document.getElementById('settlementAmount').textContent = noWinners ? '' : `${Number(share).toFixed(2)} USDt`

  const resultEl = document.getElementById('settlementResult')
  if (noWinners) {
    resultEl.textContent = 'Nadie acertó el marcador'
    resultEl.className   = 'settlement-result loser'
  } else if (iAmWinner) {
    resultEl.textContent = 'GANASTE EL POZO'
    resultEl.className   = 'settlement-result'
    announce('Ganaste el pozo de la quiniela')
  } else {
    resultEl.textContent = 'No acertaste esta vez'
    resultEl.className   = 'settlement-result loser'
    announce('La quiniela ha sido liquidada. No acertaste el marcador.')
  }

  const winnersEl = document.getElementById('settlementWinners')
  if (winners.length > 0 && !noWinners) {
    winnersEl.innerHTML = winners.map(w =>
      `<span class="settlement-winner-chip">${w.peerId.slice(0, 8)}</span>`
    ).join('')
  } else {
    winnersEl.innerHTML = ''
  }

  // Burst dentro del modal también
  if (iAmWinner && !REDUCE_MOTION) {
    const burst = document.getElementById('settlementBurst')
    const COLORS = ['#FFB300', '#00E676', '#8B5CF6', '#FFFFFF']
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div')
      p.className = 'gol-particle'
      p.style.setProperty('--angle', `${(i / 12) * 360}deg`)
      p.style.setProperty('--dist',  `${100 + Math.random() * 60}px`)
      p.style.setProperty('--color', COLORS[i % COLORS.length])
      p.style.setProperty('--delay', `${i * 30}ms`)
      if (burst) burst.appendChild(p)
    }
    setTimeout(() => { if (burst) burst.innerHTML = '' }, 1500)
  }

  overlay.hidden = false
  document.getElementById('btnSettlementClose')?.focus()
}

document.getElementById('btnSettlementClose')?.addEventListener('click', () => {
  document.getElementById('settlementOverlay').hidden = true
})

// ── Import wallet modal ───────────────────────────────────────────────────────
function openImportModal() {
  const overlay = document.getElementById('importModalOverlay')
  if (!overlay) return
  overlay.hidden = false
  document.getElementById('mnemonicInput')?.focus()
}

function closeImportModal() {
  const overlay = document.getElementById('importModalOverlay')
  if (overlay) overlay.hidden = true
  const errEl = document.getElementById('mnemonicError')
  if (errEl) { errEl.hidden = true; errEl.textContent = '' }
  const mnInput = document.getElementById('mnemonicInput')
  if (mnInput) mnInput.value = ''
}

document.getElementById('btnImportClose')?.addEventListener('click', closeImportModal)
document.getElementById('btnImportCancel')?.addEventListener('click', closeImportModal)

document.getElementById('importModalOverlay')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeImportModal()
})

// ── Seed reveal modal (cartera de sesión efímera — ver wallet.js) ─────────────
// Sin cierre por click-afuera a propósito: es la única vez que se ve esta
// frase, mejor forzar el click explícito en "Entendido".
function showSeedModal(mnemonic) {
  const overlay = document.getElementById('seedModalOverlay')
  const phraseEl = document.getElementById('seedModalPhrase')
  if (!overlay || !phraseEl) return
  phraseEl.value = mnemonic
  overlay.hidden = false
}

function closeSeedModal() {
  const overlay = document.getElementById('seedModalOverlay')
  if (overlay) overlay.hidden = true
}

document.getElementById('btnSeedClose')?.addEventListener('click', closeSeedModal)
document.getElementById('btnSeedCopy')?.addEventListener('click', () => {
  const phrase = document.getElementById('seedModalPhrase')?.value
  if (!phrase) return
  navigator.clipboard?.writeText(phrase).catch(() => {})
  showToast('Frase semilla copiada')
})

// ── Banner "MODO DEMO" ──────────────────────────────────────────────────────
function updateDemoBanner(wallet) {
  const banner = document.getElementById('demoBanner')
  const text   = document.getElementById('demoBannerText')
  if (!banner || !text) return
  banner.hidden = false
  if (wallet.isDemo) {
    banner.classList.remove('demo-banner--real')
    text.textContent = `MODO DEMO · ${wallet.network} · Balance simulado, sin fondos reales`
  } else {
    banner.classList.add('demo-banner--real')
    text.textContent = `MODO REAL · ${wallet.network}${wallet.isTestnet ? ' · Testnet, sin valor real' : ' · ¡FONDOS REALES!'}`
  }
}

// ── Main init ─────────────────────────────────────────────────────────────────
async function init() {
  const codeEl = document.getElementById('roomCode')
  if (codeEl) codeEl.textContent = roomId

  updateConnectionStatus({ connected: false, peers: 0 })

  // ── P2P ──────────────────────────────────────────────────────────────────
  const swarm        = await createSwarm(roomId, { bootstrap: lanBootstrap })
  const identity      = createIdentity(swarm.keypair)
  const chat          = createChat(swarm)
  const capabilities  = createCapabilities({ swarm })
  const board         = createBoard({ swarm, myId: identity.shortId })

  console.log('[MouFut] Mi identidad P2P:', identity.shortId, '| sala:', roomId)

  // ── Wallet ────────────────────────────────────────────────────────────────
  // Cartera de sesión: se genera efímera al arrancar (ver wallet.js), nunca
  // se guarda — por eso se muestra la seed una sola vez acá mismo.
  const wallet = await createWallet()
  updateDemoBanner(wallet)
  if (wallet.mnemonic) showSeedModal(wallet.mnemonic)

  // Ocultar skeleton y mostrar contenido real
  document.getElementById('walletSkeleton').hidden = true
  document.getElementById('walletContent').hidden  = false

  const addrEl = document.getElementById('walletAddress')
  if (wallet.address && addrEl) {
    addrEl.textContent = wallet.address
    addrEl.title       = wallet.address
  } else if (addrEl) {
    addrEl.textContent = 'Sin cartera — crea o importa una'
  }

  async function refreshBalance() {
    const balEl = document.getElementById('walletBalance')
    if (!balEl) return
    const bal = await wallet.getBalance()
    balEl.textContent = bal != null ? Number(bal).toFixed(2) : '—'
  }
  await refreshBalance()

  // ── Pool ─────────────────────────────────────────────────────────────────
  const pool = createPool({ swarm, identity })

  pool.onChange(event => {
    if (event.type === 'bets') {
      renderBets(event.bets, identity.shortId)
      animatePot(pool.totalPot)
    }

    if (event.type === 'consensus') {
      renderConsensusReports(event.reports, event.score)
      showToast(`Consenso: ${event.score.home}–${event.score.away}`)
      announce(`Se alcanzó consenso: marcador ${event.score.home} a ${event.score.away}`)
    }

    if (event.type === 'reports') {
      renderConsensusReports(event.reports, null)
    }

    if (event.type === 'settled') {
      document.getElementById('poolStatus').textContent = 'Liquidada'
      showSettlement(event)
    }

    if (event.type === 'settlement_received') {
      showToast('La quiniela fue liquidada por otro peer')
    }

    if (event.type === 'no_winners') {
      showSettlement({ score: event.score, winners: [], share: 0, iAmWinner: false, noWinners: true })
    }
  })

  // ── IA ───────────────────────────────────────────────────────────────────
  // Estado real del partido para el tool `get_match_state`: el marcador de
  // arriba (scoreHome/scoreAway) es solo un placeholder visual que nunca se
  // actualiza (no hay forma de saber qué equipo anotó en una reacción
  // genérica "GOL"), así que se prioriza el consenso real de la quiniela
  // (`pool.consensus`, marcador que la mayoría de peers reportó y verificó)
  // cuando existe, en vez de inventar un marcador.
  function getMatchState() {
    const minute    = document.getElementById('matchTime')?.textContent || '—'
    const consensus = pool.consensus
    const home = consensus?.home ?? (Number(document.getElementById('scoreHome')?.textContent) || 0)
    const away = consensus?.away ?? (Number(document.getElementById('scoreAway')?.textContent) || 0)
    return { minute, home, away, scoreConfirmed: consensus != null }
  }

  function onProposeBet({ home, away, amount }) {
    const homeEl   = document.getElementById('betHome')
    const awayEl   = document.getElementById('betAway')
    const amountEl = document.getElementById('betAmount')
    if (homeEl)   homeEl.value = home
    if (awayEl)   awayEl.value = away
    if (amountEl) amountEl.value = amount
    showScreen('quiniela')
    showToast('MouBot preparó tu apuesta — revisa y confirma en Quiniela')
  }

  let ai // se asigna abajo — `tools` necesita referenciarlo para traducir, pero `ai` necesita `tools` para crearse
  const tools = createTools({
    getMatchState,
    board,
    pool,
    translateText: (text, targetLang) => ai.translate(text, targetLang),
    onProposeBet
  })

  setIAStatus('Cargando modelo...')
  showModelProgress(0)
  ai = await createCommentator({
    capabilities,
    tools,
    onProgress: (pct) => {
      if (pct === null) {
        showModelProgress(null)
        markIAReady()
      } else {
        showModelProgress(pct)
        setIAStatus(`Descargando ${Math.round(pct)}%`)
      }
    }
  })

  function markIAReady() {
    setIAStatus('Listo')
    updateAIRuntimeBadge()
  }

  function updateAIRuntimeBadge() {
    const badge = document.getElementById('iaRuntimeBadge')
    if (!badge) return
    const { mode, workerId } = ai.getRuntimeInfo()
    badge.hidden = false
    badge.classList.toggle('delegated', mode === 'delegated')
    badge.textContent = mode === 'delegated'
      ? `Delegada · peer ${workerId?.slice(0, 8)}`
      : 'Local en este dispositivo'
  }
  updateAIRuntimeBadge()
  // La delegación puede cambiar en caliente (un worker aparece o se va de la
  // sala) — commentator.js se reacomoda solo, acá solo refrescamos el badge.
  capabilities.onChange(() => updateAIRuntimeBadge())

  // ── Worker QVAC (delegación P2P) ────────────────────────────────────────
  const workerToggle = document.getElementById('workerToggleInput')
  const workerSub     = document.getElementById('workerToggleSub')

  workerToggle?.addEventListener('change', async () => {
    workerToggle.disabled = true
    try {
      if (workerToggle.checked) {
        const publicKey = await becomeWorker()
        capabilities.announce({ publicKey, tier: WORKER_TIER })
        if (workerSub) workerSub.textContent = 'Activo — otros peers de la sala pueden delegarte inferencia pesada'
        showToast('Ahora eres worker de IA para esta sala')
      } else {
        await stopBeingWorker()
        capabilities.announce(null)
        if (workerSub) workerSub.textContent = 'Presta este dispositivo para correr el modelo grande de otros peers de la sala'
        showToast('Dejaste de ser worker de IA')
      }
    } catch (err) {
      workerToggle.checked = !workerToggle.checked
      showToast(`Error: ${err.message}`)
    } finally {
      workerToggle.disabled = false
    }
  })

  // ── Swarm events ──────────────────────────────────────────────────────────
  swarm.onPeerJoin((peerId) => {
    updateConnectionStatus({ connected: true, peers: swarm.peers.length })
    appendReactionBubble(`${peerId.slice(0, 8)} se unió`)
    showToast(`Peer conectado: ${peerId.slice(0, 8)}`)
  })

  swarm.onPeerLeave((peerId) => {
    const connected = swarm.peers.length > 0
    updateConnectionStatus({ connected, peers: swarm.peers.length })
    appendReactionBubble(`${peerId.slice(0, 8)} salió`)
  })

  // ── Chat ──────────────────────────────────────────────────────────────────
  const chatForm  = document.getElementById('chatForm')
  const chatInput = document.getElementById('chatInput')

  chat.onMessage(({ text, fromPeer }) => {
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

  // ── Reactions ─────────────────────────────────────────────────────────────
  swarm.onMessage((msg) => {
    if (msg.type !== 'reaction') return
    const label = REACTION_LABEL[msg.reaction] ?? msg.reaction.toUpperCase()
    const isGol = msg.reaction === 'gol'
    appendReactionBubble(label, isGol)
  })

  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const reaction = btn.dataset.reaction
      const label    = REACTION_LABEL[reaction] ?? reaction.toUpperCase()
      const isGol    = reaction === 'gol'
      swarm.send({ type: 'reaction', reaction })
      appendReactionBubble(label, isGol)
    })
  })

  // ── Bet form ──────────────────────────────────────────────────────────────
  const btnBet = document.getElementById('btnPlaceBet')

  btnBet?.addEventListener('click', async () => {
    const home   = document.getElementById('betHome').value
    const away   = document.getElementById('betAway').value
    const amount = document.getElementById('betAmount').value

    if (!wallet.address) {
      showToast('Primero crea o importa una cartera')
      return
    }

    if (Number(amount) <= 0) {
      showToast('El monto debe ser mayor a 0')
      return
    }

    btnBet.classList.add('loading')
    btnBet.disabled = true

    try {
      pool.submit({ home, away, amount })
      showToast(`Apuesta firmada: ${home}–${away} · ${Number(amount).toFixed(2)} USDt`)
      announce(`Apuesta enviada: México ${home}, Argentina ${away}, ${Number(amount).toFixed(2)} USDt`)
    } catch (err) {
      showToast(`Error: ${err.message}`)
    } finally {
      btnBet.classList.remove('loading')
      btnBet.disabled = false
    }
  })

  // ── Report final score ────────────────────────────────────────────────────
  document.getElementById('btnReportScore')?.addEventListener('click', () => {
    const home = document.getElementById('finalHome').value
    const away = document.getElementById('finalAway').value
    pool.reportFinalScore({ home, away })
    showToast(`Marcador reportado: ${home}–${away}`)
  })

  document.getElementById('btnLiquidate')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnLiquidate')
    btn.disabled = true
    btn.textContent = 'Liquidando...'
    try {
      const result = await pool.liquidate()
      if (result.error) { showToast(result.error); btn.disabled = false; btn.textContent = 'Liquidar pozo' }
    } catch (err) {
      showToast(`Error al liquidar: ${err.message}`)
      btn.disabled = false
      btn.textContent = 'Liquidar pozo'
    }
  })

  // ── Wallet actions ────────────────────────────────────────────────────────
  document.getElementById('btnCreateWallet')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnCreateWallet')
    btn.disabled = true
    btn.textContent = 'Creando...'
    try {
      const w = await wallet.create()
      if (addrEl) { addrEl.textContent = w.address; addrEl.title = w.address }
      await refreshBalance()
      if (w.mnemonic) showSeedModal(w.mnemonic)
    } catch (err) {
      showToast(`Error: ${err.message}`)
    } finally {
      btn.disabled = false
      btn.textContent = 'Nueva cartera'
    }
  })

  document.getElementById('btnImportWallet')?.addEventListener('click', openImportModal)

  document.getElementById('btnImportConfirm')?.addEventListener('click', async () => {
    const phrase  = document.getElementById('mnemonicInput')?.value?.trim()
    const errEl   = document.getElementById('mnemonicError')
    const btn     = document.getElementById('btnImportConfirm')

    if (!phrase) {
      errEl.textContent = 'Ingresa tu frase semilla.'
      errEl.hidden = false
      return
    }

    btn.disabled = true
    btn.textContent = 'Importando...'
    errEl.hidden = true

    try {
      const w = await wallet.importFromMnemonic(phrase)
      if (addrEl) { addrEl.textContent = w.address; addrEl.title = w.address }
      await refreshBalance()
      closeImportModal()
      showToast('Cartera importada correctamente')
    } catch (err) {
      errEl.textContent = `Error: ${err.message || 'Frase inválida. Verifica las 12 palabras.'}`
      errEl.hidden = false
      document.getElementById('mnemonicInput')?.focus()
    } finally {
      btn.disabled = false
      btn.textContent = 'Importar'
    }
  })

  // ── Copy room code ────────────────────────────────────────────────────────
  document.getElementById('btnCopyRoom')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(roomId).catch(() => {})
    showToast('Código de sala copiado')
  })

  // ── IA — preguntas y formulario ───────────────────────────────────────────
  const iaForm  = document.getElementById('iaForm')
  const iaInput = document.getElementById('iaInput')

  async function askMouBot(question) {
    setIAStatus('Pensando...')
    const time = getCurrentMatchTime()
    try {
      const text = await ai.analyze({ type: 'question', text: question })
      addCommentary({ time, tag: 'MouBot', text })
    } catch {
      addCommentary({ time, tag: 'MouBot', text: `Sin respuesta para: "${question}"` })
    } finally {
      markIAReady()
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

  document.getElementById('btnTactical')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnTactical')
    btn.disabled = true
    btn.textContent = 'Analizando...'
    setIAStatus('Análisis táctico...')
    try {
      const text = await ai.analyzeTactical()
      addCommentary({ time: getCurrentMatchTime(), tag: 'Táctico', text })
    } finally {
      btn.disabled = false
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
        </svg>
        Análisis táctico completo
      `
      markIAReady()
    }
  })

  // ── Eventos P2P match_event → comentarista ────────────────────────────────
  swarm.onMessage(async (msg) => {
    if (msg.type !== 'match_event') return
    setIAStatus('Analizando...')
    try {
      const comment = await ai.analyze(msg.event)
      addCommentary({ time: getCurrentMatchTime(), tag: msg.event.type ?? 'Evento', text: comment })
    } finally {
      markIAReady()
    }
  })

  // ── Reloj de partido vivo ─────────────────────────────────────────────────
  startMatchClock()
}

function startMatchClock() {
  const el = document.getElementById('matchTime')
  if (!el) return

  // Arranca desde el minuto actual mostrado en el HTML (ej. "45'")
  let minute = parseInt(el.textContent, 10) || 0
  let seconds = 0

  setInterval(() => {
    seconds++
    if (seconds >= 60) { seconds = 0; minute++ }
    el.textContent = `${minute}'`
    el.setAttribute('aria-label', `Minuto ${minute}`)
  }, 1000)
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => {
    console.error('[MouFut] Error al inicializar:', err)
    showToast('Error de inicio — revisa la consola')
  })
})
