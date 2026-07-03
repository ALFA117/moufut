// Prueba que announceLanBootstrap()/discoverLanBootstrap() (backlog v3, ver
// TAREAS.md) se encuentran de verdad por mDNS en esta máquina, antes de
// confiar en que el flujo `?bootstrap=auto` de la UI funciona.
import { announceLanBootstrap, discoverLanBootstrap } from '../src/p2p/lan-discovery.js'

async function main() {
  const announcement = announceLanBootstrap({ host: '192.168.1.99', port: 49737 })
  try {
    const found = await discoverLanBootstrap({ timeoutMs: 3000 })
    if (!found) {
      console.log('❌ No se encontró el bootstrap anunciado (mDNS sin respuesta)')
      process.exitCode = 1
      return
    }
    if (found.host === '192.168.1.99' && found.port === 49737) {
      console.log(`✅ Encontrado correctamente: ${found.host}:${found.port}`)
    } else {
      console.log(`❌ Encontrado pero con datos incorrectos: ${JSON.stringify(found)}`)
      process.exitCode = 1
    }
  } finally {
    announcement.destroy()
  }
}

main().catch((err) => {
  console.error('[FAIL]', err)
  process.exitCode = 1
})
