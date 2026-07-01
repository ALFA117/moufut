// Balón 3D decorativo del hero. Three.js vía CDN (sin build step): genera la
// textura de pentágonos por código (sin depender de ninguna imagen externa),
// respeta prefers-reduced-motion, y cae a un fallback CSS si WebGL o la CDN
// no están disponibles (sin conexión, navegador viejo, etc).
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js'

const GREEN = 0x00b368
const RED = 0xf01e3c

function buildBallTexture() {
  const W = 1024
  const H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Base de los "hexágonos" (blanco cálido, no puro para que no queme con las luces)
  ctx.fillStyle = '#F3F1EA'
  ctx.fillRect(0, 0, W, H)

  // Los 12 vértices de un icosaedro regular = los 12 centros de pentágono de
  // su dual (el balón clásico de fútbol / truncated icosahedron).
  const PHI = (1 + Math.sqrt(5)) / 2
  const raw = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ]
  const centers = raw.map(([x, y, z]) => {
    const l = Math.hypot(x, y, z)
    return [x / l, y / l, z / l]
  })

  function toUV([x, y, z]) {
    const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI)
    const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI
    return [u * W, v * H]
  }

  function drawPentagon(cx, cy, r, rot) {
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = rot + (i / 5) * Math.PI * 2 - Math.PI / 2
      const px = cx + Math.cos(a) * r
      const py = cy + Math.sin(a) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }

  ctx.fillStyle = '#141815'
  const radius = W * 0.055
  for (const c of centers) {
    const [u, v] = toUV(c)
    // Dibuja copias desplazadas para que el patrón no se corte en la costura u=0/1
    for (const dx of [-W, 0, W]) drawPentagon(u + dx, v, radius, c[0] + c[1])
  }

  // Sombreado sutil de "costuras" para dar volumen extra a la textura plana
  const vign = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, H * 0.75)
  vign.addColorStop(0, 'rgba(0,0,0,0)')
  vign.addColorStop(1, 'rgba(0,0,0,0.18)')
  ctx.fillStyle = vign
  ctx.fillRect(0, 0, W, H)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function initBall(canvas) {
  const container = canvas.parentElement
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
  camera.position.set(0, 0, 4.4)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const geometry = new THREE.SphereGeometry(1.3, 64, 64)
  const material = new THREE.MeshStandardMaterial({
    map: buildBallTexture(),
    roughness: 0.55,
    metalness: 0.06,
  })
  const ball = new THREE.Mesh(geometry, material)

  const rig = new THREE.Group()
  rig.add(ball)
  scene.add(rig)

  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const key = new THREE.DirectionalLight(0xffffff, 1.15)
  key.position.set(3, 4, 5)
  scene.add(key)
  const rimGreen = new THREE.PointLight(GREEN, 2.2, 14)
  rimGreen.position.set(-3.2, -1, -2)
  scene.add(rimGreen)
  const rimRed = new THREE.PointLight(RED, 1.4, 14)
  rimRed.position.set(2.4, -2.2, -2.6)
  scene.add(rimRed)

  function resize() {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  let targetTiltX = 0
  let targetTiltZ = 0
  window.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1
    const ny = (e.clientY / window.innerHeight) * 2 - 1
    targetTiltZ = nx * 0.18
    targetTiltX = ny * 0.12
  })

  let tabVisible = true
  document.addEventListener('visibilitychange', () => {
    tabVisible = document.visibilityState === 'visible'
  })

  function animate() {
    requestAnimationFrame(animate)
    if (!tabVisible) return
    if (!reduceMotion) ball.rotation.y += 0.0022
    rig.rotation.x += (targetTiltX - rig.rotation.x) * 0.05
    rig.rotation.z += (targetTiltZ - rig.rotation.z) * 0.05
    renderer.render(scene, camera)
  }
  animate()

  requestAnimationFrame(() => container.classList.add('ball-ready'))
}

const canvas = document.getElementById('ballCanvas')
if (canvas && window.WebGLRenderingContext) {
  try {
    initBall(canvas)
  } catch {
    canvas.parentElement?.classList.add('ball-fallback')
  }
} else {
  canvas?.parentElement?.classList.add('ball-fallback')
}
