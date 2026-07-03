// Prueba de carga real de los candidatos 1B-3B para reemplazar/complementar
// SMOLLM2_360M_INST_Q8 como modelo local del comentarista (ver TAREAS.md,
// Checkpoint C / Fase 2). Para cada candidato: carga, mide tiempo + memoria,
// corre un prompt corto de comentarista de fútbol, y descarga antes de
// seguir con el siguiente (para no acumular memoria entre candidatos).
//
// Uso: node scripts/test-model-load.js
import { loadModel, unloadModel, completion } from '@qvac/sdk'
import {
  QWEN3_1_7B_INST_Q4,
  LLAMA_3_2_1B_INST_Q4_0,
  SALAMANDRATA_2B_INST_Q4
} from '@qvac/sdk/models'

const PROMPT = 'Comenta este momento: GOL de Mbappé al minuto 45.'
const SYSTEM_PROMPT = 'Eres un comentarista deportivo apasionado de fútbol. Responde siempre en 1-2 oraciones cortas, estilo radio en vivo.'

const candidates = [
  { label: 'QWEN3_1_7B_INST_Q4 (1.7B, q4)', modelSrc: QWEN3_1_7B_INST_Q4 },
  { label: 'LLAMA_3_2_1B_INST_Q4_0 (1B, q4_0)', modelSrc: LLAMA_3_2_1B_INST_Q4_0 },
  { label: 'SALAMANDRATA_2B_INST_Q4 (2B, q4, español nativo)', modelSrc: SALAMANDRATA_2B_INST_Q4 }
]

function mb(bytes) { return Math.round(bytes / 1024 / 1024) }

async function testCandidate({ label, modelSrc }) {
  console.log(`\n=== ${label} ===`)
  const t0 = Date.now()
  let modelId
  // El arranque del worker RPC de QVAC es intermitente en este entorno (Node
  // plano, no runtime Bare/Pear real) — "RPC initialization timed out" a
  // veces pasa incluso con un modelo que sabemos que carga bien (confirmado
  // reintentando SMOLLM2_360M_INST_Q8, que ya tenía inferencia real probada
  // en sesiones previas). Reintentar es representativo del comportamiento
  // real, no un parche para forzar un resultado.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      modelId = await loadModel({
        modelSrc,
        onProgress: (p) => {
          if (p.percentage != null) process.stdout.write(`\r[carga] ${p.percentage.toFixed(0)}%  `)
        }
      })
      process.stdout.write('\n')
      break
    } catch (err) {
      if (attempt === 3) {
        console.log(`❌ No cargó tras ${attempt} intentos: ${err.message}`)
        return { label, ok: false, error: err.message }
      }
      console.log(`   (intento ${attempt} falló: ${err.message} — reintentando)`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  const loadMs = Date.now() - t0
  const mem = process.memoryUsage()
  console.log(`✅ Cargó en ${(loadMs / 1000).toFixed(1)}s. ID: ${modelId}`)
  console.log(`   Memoria del proceso (heapUsed/rss): ${mb(mem.heapUsed)}MB / ${mb(mem.rss)}MB`)

  let respuesta = null
  let genMs = null
  try {
    const t1 = Date.now()
    const run = completion({
      modelId,
      history: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: PROMPT }
      ],
      stream: false,
      generationParams: { predict: 64 }
    })
    const result = await run.final
    genMs = Date.now() - t1
    respuesta = result.contentText ?? ''
    console.log(`   Respuesta (${(genMs / 1000).toFixed(1)}s): "${respuesta}"`)
  } catch (err) {
    console.log(`   ⚠️ Cargó pero falló la inferencia: ${err.message}`)
  }

  try { await unloadModel({ modelId }) } catch {}
  console.log('   (descargado)')

  return { label, ok: true, loadMs, genMs, respuesta }
}

async function main() {
  const results = []
  for (const c of candidates) {
    results.push(await testCandidate(c))
  }

  console.log('\n=== Resumen ===')
  for (const r of results) {
    if (!r.ok) {
      console.log(`❌ ${r.label} — ${r.error}`)
    } else {
      console.log(`✅ ${r.label} — carga ${(r.loadMs / 1000).toFixed(1)}s, respuesta ${r.genMs ? (r.genMs / 1000).toFixed(1) + 's' : 'N/A'}`)
    }
  }
}

main().catch((err) => {
  console.error('[FAIL]', err)
  process.exit(1)
})
