// Scroll-reveal + estado activo del nav. Vainilla JS, sin dependencias.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Menú móvil (hamburguesa) ─────────────────────────────────────────────────
const navToggle  = document.getElementById('navToggle')
const mobileMenu = document.getElementById('mobileMenu')

if (navToggle && mobileMenu) {
  function closeMobileMenu() {
    mobileMenu.classList.remove('open')
    navToggle.classList.remove('open')
    navToggle.setAttribute('aria-expanded', 'false')
  }

  function toggleMobileMenu() {
    const isOpen = mobileMenu.classList.toggle('open')
    navToggle.classList.toggle('open', isOpen)
    navToggle.setAttribute('aria-expanded', String(isOpen))
  }

  navToggle.addEventListener('click', toggleMobileMenu)
  mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMobileMenu))
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMobileMenu() })
  window.addEventListener('resize', () => { if (window.innerWidth >= 768) closeMobileMenu() })
}

if (!reduceMotion && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          revealObserver.unobserve(entry.target)
        }
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  )
  document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el))
} else {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'))
}

const sections = [...document.querySelectorAll('main section[id]')]
const navLinks = [...document.querySelectorAll('.nav-links a, .mobile-menu a')]

if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
  const navObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const id = entry.target.id
        navLinks.forEach((link) => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`)
        })
      }
    },
    { rootMargin: '-45% 0px -45% 0px' }
  )
  sections.forEach((s) => navObserver.observe(s))
}

// ── Contadores animados de la sección de estadísticas ──────────────────────
function renderCount(el, value) {
  const prefix = el.dataset.prefix || ''
  const suffix = el.dataset.suffix || ''
  el.textContent = prefix + value + suffix
}

function animateCount(el) {
  const to = parseInt(el.dataset.countTo, 10)
  const duration = 1200
  const start = performance.now()

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration)
    const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
    renderCount(el, Math.round(to * eased))
    if (progress < 1) requestAnimationFrame(tick)
    else renderCount(el, to)
  }
  requestAnimationFrame(tick)
}

const statNumbers = [...document.querySelectorAll('.stat-number[data-count-to]')]

if (reduceMotion || !('IntersectionObserver' in window)) {
  statNumbers.forEach((el) => renderCount(el, el.dataset.countTo))
} else {
  const countObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          animateCount(entry.target)
          countObserver.unobserve(entry.target)
        }
      }
    },
    { threshold: 0.6 }
  )
  statNumbers.forEach((el) => countObserver.observe(el))
}

// ── Glow que sigue el cursor en las tarjetas "Por qué" ──────────────────────
document.querySelectorAll('.why-card').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    card.style.setProperty('--my', `${e.clientY - rect.top}px`)
  })
})

// ── Demo interactiva (chat / MouBot IA / quiniela) ──────────────────────────
// Simulación visual del flujo completo — sin datos reales, sin backend.
const demoTabs = [...document.querySelectorAll('.demo-tab')]
const demoScreens = [...document.querySelectorAll('.demo-screen')]
let demoTimers = []

function schedule(fn, delay) {
  demoTimers.push(setTimeout(fn, reduceMotion ? 0 : delay))
}

function clearDemoTimers() {
  demoTimers.forEach(clearTimeout)
  demoTimers = []
}

function resetDemoScreen(screen) {
  screen.querySelectorAll('[data-demo-list]').forEach((list) => { list.innerHTML = '' })
  const pot = screen.querySelector('[data-demo-pot]')
  if (pot) pot.textContent = '0'
  const consensus = screen.querySelector('[data-demo-consensus]')
  if (consensus) consensus.classList.remove('show')
}

function addBubble(list, { text, mine, reaction }) {
  const el = document.createElement('div')
  el.className = 'demo-bubble' + (mine ? ' mine' : '') + (reaction ? ' reaction' : '')
  el.textContent = text
  list.appendChild(el)
  schedule(() => el.classList.add('show'), 20)
}

function addTyping(list) {
  const el = document.createElement('div')
  el.className = 'demo-typing'
  el.innerHTML = '<span></span><span></span><span></span>'
  list.appendChild(el)
  schedule(() => el.classList.add('show'), 20)
  return el
}

function addPoolRow(list, { peer, score, amount }) {
  const el = document.createElement('div')
  el.className = 'demo-pool-row'
  el.innerHTML = `<span>${peer}</span><b>${score}</b><span>${amount} USDt</span>`
  list.appendChild(el)
  schedule(() => el.classList.add('show'), 20)
}

function animatePot(el, from, to) {
  if (reduceMotion) { el.textContent = to; return }
  const duration = 500
  const start = performance.now()
  function tick(now) {
    const t = Math.min(1, (now - start) / duration)
    el.textContent = Math.round(from + (to - from) * t)
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function runDemoChat(screen) {
  const list = screen.querySelector('[data-demo-list]')
  schedule(() => addBubble(list, { text: '¿Vieron esa jugada?' }), 400)
  schedule(() => addBubble(list, { text: '¡Casi gol!', mine: true }), 1200)
  schedule(() => addBubble(list, { text: 'GOL', reaction: true }), 2000)
  schedule(() => addBubble(list, { text: '¡GOOOOL! Qué jugada' }), 2600)
}

function runDemoIa(screen) {
  const list = screen.querySelector('[data-demo-list]')
  schedule(() => addBubble(list, { text: '¿Qué táctica usa México?', mine: true }), 300)
  schedule(() => {
    const typing = addTyping(list)
    schedule(() => {
      typing.remove()
      addBubble(list, { text: 'México defiende con línea de 5, cediendo el balón. Argentina necesita velocidad por las bandas.' })
    }, 1500)
  }, 900)
}

function runDemoQuiniela(screen) {
  const list = screen.querySelector('[data-demo-list]')
  const pot = screen.querySelector('[data-demo-pot]')
  const consensus = screen.querySelector('[data-demo-consensus]')
  schedule(() => { addPoolRow(list, { peer: 'a3f81c2', score: '2:1', amount: 10 }); animatePot(pot, 0, 10) }, 500)
  schedule(() => { addPoolRow(list, { peer: 'f92e0b7', score: '1:1', amount: 15 }); animatePot(pot, 10, 25) }, 1300)
  schedule(() => { addPoolRow(list, { peer: '02cd9a4', score: '2:1', amount: 8 }); animatePot(pot, 25, 33) }, 2100)
  schedule(() => consensus.classList.add('show'), 2900)
}

const demoRunners = { chat: runDemoChat, ia: runDemoIa, quiniela: runDemoQuiniela }

function activateDemoTab(name) {
  clearDemoTimers()
  demoTabs.forEach((tab) => {
    const isActive = tab.dataset.demoTab === name
    tab.classList.toggle('active', isActive)
    tab.setAttribute('aria-pressed', String(isActive))
  })
  demoScreens.forEach((screen) => {
    const isActive = screen.dataset.demoScreen === name
    screen.classList.toggle('active', isActive)
    resetDemoScreen(screen)
  })
  const activeScreen = demoScreens.find((s) => s.dataset.demoScreen === name)
  if (activeScreen && demoRunners[name]) demoRunners[name](activeScreen)
}

if (demoTabs.length) {
  demoTabs.forEach((tab) => {
    tab.addEventListener('click', () => activateDemoTab(tab.dataset.demoTab))
  })

  // Arranca la primera demo una sola vez, cuando la sección entra en pantalla
  const demoSection = document.getElementById('demo')
  if (demoSection && 'IntersectionObserver' in window) {
    const demoStartObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activateDemoTab('chat')
            demoStartObserver.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.4 }
    )
    demoStartObserver.observe(demoSection)
  } else {
    activateDemoTab('chat')
  }
}

// ── Terminal animada de instalación (sección "Cómo correrlo") ───────────────
// Simulación visual de los comandos reales del README — sin datos inventados,
// el <pre class="sr-only-code"> de al lado trae el mismo contenido en texto
// plano para lectores de pantalla y como respaldo si el JS no corre.
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : ms))
}

async function typeInto(el, text) {
  if (reduceMotion) { el.textContent = text; return }
  for (const ch of text) {
    el.textContent += ch
    await wait(14)
  }
}

async function runInstallTerminal(container) {
  container.innerHTML = ''
  const cursor = document.createElement('span')
  cursor.className = 'term-cursor'

  function addCommentLine(text) {
    const line = document.createElement('div')
    line.className = 'term-line term-comment'
    line.textContent = text
    container.appendChild(line)
  }

  function addBlankLine() {
    const line = document.createElement('div')
    line.className = 'term-line'
    line.innerHTML = '&nbsp;'
    container.appendChild(line)
  }

  async function runProgressBar() {
    const row = document.createElement('div')
    row.className = 'term-progress-row'
    const track = document.createElement('div')
    track.className = 'term-progress-track'
    const fill = document.createElement('div')
    fill.className = 'term-progress-fill'
    track.appendChild(fill)
    const pct = document.createElement('span')
    pct.className = 'term-progress-pct'
    pct.textContent = '0%'
    row.append(track, pct)
    container.appendChild(row)

    if (reduceMotion) {
      fill.style.width = '100%'
      pct.textContent = '100%'
    } else {
      await new Promise((resolve) => {
        const duration = 1100
        const start = performance.now()
        function tick(now) {
          const t = Math.min(1, (now - start) / duration)
          const pctVal = Math.round(t * 100)
          fill.style.width = pctVal + '%'
          pct.textContent = pctVal + '%'
          if (t < 1) requestAnimationFrame(tick)
          else resolve()
        }
        requestAnimationFrame(tick)
      })
    }

    const done = document.createElement('div')
    done.className = 'term-line term-done'
    done.textContent = '✓ listo'
    container.appendChild(done)
    await wait(200)
  }

  async function addCommandLine(cmdText, { progress } = {}) {
    const line = document.createElement('div')
    line.className = 'term-line'
    const prompt = document.createElement('span')
    prompt.className = 'term-prompt'
    prompt.textContent = '$'
    const textSpan = document.createElement('span')
    line.append(prompt, textSpan, cursor)
    container.appendChild(line)
    await typeInto(textSpan, cmdText)
    cursor.remove()
    await wait(160)
    if (progress) await runProgressBar()
  }

  addCommentLine('# opción 1: descarga el ZIP de arriba y descomprímelo, o clona con git')
  await addCommandLine('git clone https://github.com/ALFA117/moufut.git')
  await addCommandLine('cd moufut')
  await addCommandLine('npm install', { progress: true })
  addBlankLine()
  addCommentLine('# abre la ventana desktop (Pear/Bare)')
  await addCommandLine('pear run --dev .')

  const finalLine = document.createElement('div')
  finalLine.className = 'term-line'
  const finalPrompt = document.createElement('span')
  finalPrompt.className = 'term-prompt'
  finalPrompt.textContent = '$'
  finalLine.append(finalPrompt, cursor)
  container.appendChild(finalLine)
}

const terminalEl = document.querySelector('[data-terminal]')
if (terminalEl) {
  const runSection = document.getElementById('run')
  if (runSection && 'IntersectionObserver' in window) {
    const runTermObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            runInstallTerminal(terminalEl)
            runTermObserver.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.3 }
    )
    runTermObserver.observe(runSection)
  } else {
    runInstallTerminal(terminalEl)
  }
}
