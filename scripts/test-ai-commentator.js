// Prueba: cargar el modelo QVAC y obtener una respuesta on-device,
// sin llamar a ninguna API externa de LLM.
// Uso: node scripts/test-ai-commentator.js
import { createCommentator } from '../src/ai/commentator.js'

async function main() {
  console.log('[test-ai] Cargando comentarista QVAC (puede descargar el modelo la primera vez)...')

  const ai = await createCommentator({
    onProgress: (pct) => {
      if (pct != null) console.log(`[test-ai] progreso: ${pct.toFixed(0)}%`)
    }
  })

  const respuesta = await ai.analyze({ type: 'gol', player: 'Mbappé', minute: 45 })
  console.log('[test-ai] Respuesta del comentarista:', respuesta)

  if (respuesta.startsWith('[Stub]')) {
    console.log('[test-ai] AVISO: el modelo QVAC no cargó — respondió con el stub de respaldo, no con inferencia real on-device.')
    process.exit(2)
  }

  console.log('[OK] Respuesta generada por inferencia on-device real.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[FAIL]', err.message)
  process.exit(1)
})
