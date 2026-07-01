// Partículas ambientales del hero — canvas 2D liviano, sin dependencias.
// Chispas flotando en los colores de marca (verde/rojo), detrás del balón 3D.
// Respeta prefers-reduced-motion (se retira del DOM en vez de animar).
const canvas = document.getElementById('particlesCanvas')

if (canvas) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduceMotion) {
    canvas.remove()
  } else {
    const ctx = canvas.getContext('2d')
    const COLORS = ['#00B368', '#F01E3C', '#F5F7F5']
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let particles = []
    let width = 0
    let height = 0

    function countForArea(w, h) {
      return Math.round(Math.min(80, Math.max(28, (w * h) / 18000)))
    }

    function makeParticle() {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1 + Math.random() * 2.2,
        speed: 6 + Math.random() * 16, // px/s hacia arriba
        drift: (Math.random() - 0.5) * 8, // px/s lateral
        color: COLORS[(Math.random() * COLORS.length) | 0],
        alpha: 0.15 + Math.random() * 0.35,
      }
    }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      particles = Array.from({ length: countForArea(width, height) }, makeParticle)
    }

    let tabVisible = true
    document.addEventListener('visibilitychange', () => {
      tabVisible = document.visibilityState === 'visible'
    })

    let last = performance.now()
    function tick(now) {
      requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!tabVisible || !width || !height) return

      ctx.clearRect(0, 0, width, height)
      for (const p of particles) {
        p.y -= p.speed * dt
        p.x += p.drift * dt
        if (p.y < -4) { p.y = height + 4; p.x = Math.random() * width }
        if (p.x < -4) p.x = width + 4
        if (p.x > width + 4) p.x = -4

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    resize()
    window.addEventListener('resize', resize)
    requestAnimationFrame(tick)
  }
}
