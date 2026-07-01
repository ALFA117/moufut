// Scroll-reveal + estado activo del nav. Vainilla JS, sin dependencias.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
const navLinks = [...document.querySelectorAll('.nav-links a')]

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
