// Prueba: RAG local sobre la base de fútbol (ai/rag.js), 100% on-device vía QVAC.
// Uso: node scripts/test-rag.js
import { searchKnowledge } from '../src/ai/rag.js'

async function main() {
  console.log('[test-rag] Buscando en la base de fútbol (puede descargar el modelo de embeddings la primera vez)...')

  const results = await searchKnowledge('¿Qué es el fuera de lugar?', {
    onProgress: (pct) => {
      if (pct != null) console.log(`[test-rag] progreso: ${pct.toFixed(0)}%`)
    }
  })

  console.log('[test-rag] Resultados:', results)

  if (results.length === 0) {
    console.log('[test-rag] AVISO: sin resultados — QVAC no cargó (falta runtime Bare/Pear) o la base no tiene contexto relevante.')
    process.exit(2)
  }

  const hit = results.some(r => r.content.includes('Fuera de lugar'))
  if (!hit) {
    console.error('[FAIL] Los resultados no incluyen el documento esperado sobre offside.')
    process.exit(1)
  }

  console.log('[OK] RAG devolvió el documento relevante de la base de fútbol.')
  process.exit(0)
}

main().catch((err) => {
  console.error('[FAIL]', err.message)
  process.exit(1)
})
