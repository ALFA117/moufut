// Prueba: distribución del estado de la quiniela por la malla.
// A apuesta antes de que C exista. C se une tarde y debe recibir la apuesta
// de A vía MSG.STATE_SYNC, sin haber visto el mensaje original.
import { createSwarm } from '../src/p2p/swarm.js'
import { createIdentity } from '../src/p2p/identity.js'
import { createPool } from '../src/wallet/pool.js'

const ROOM = 'test-pool-' + Date.now()
const TIMEOUT_MS = 25000

function fail(msg) {
  console.error(`[FAIL] ${msg}`)
  process.exit(1)
}

async function waitUntil(check, label) {
  const start = Date.now()
  while (Date.now() - start < TIMEOUT_MS) {
    if (check()) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`timeout esperando: ${label}`)
}

async function main() {
  console.log(`[test-pool-sync] Sala: ${ROOM}`)

  const swarmA = await createSwarm(ROOM)
  const swarmB = await createSwarm(ROOM)
  const poolA  = createPool({ swarm: swarmA, identity: createIdentity(swarmA.keypair) })
  const poolB  = createPool({ swarm: swarmB, identity: createIdentity(swarmB.keypair) })

  await waitUntil(() => swarmA.peers.length > 0 && swarmB.peers.length > 0, 'A y B conectados')

  poolA.submit({ home: 2, away: 1, amount: 10 })
  await waitUntil(() => poolB.bets.length === 1, 'B ve la apuesta de A')
  console.log('[test-pool-sync] B ya ve la apuesta de A:', poolB.bets[0])

  // C se une después de que la apuesta ya existía — nunca vio el mensaje original.
  const swarmC = await createSwarm(ROOM)
  const poolC  = createPool({ swarm: swarmC, identity: createIdentity(swarmC.keypair) })

  await waitUntil(() => poolC.bets.length === 1, 'C recibe el estado vía STATE_SYNC')
  const synced = poolC.bets[0]
  if (synced.home !== 2 || synced.away !== 1 || synced.amount !== 10) {
    fail(`estado sincronizado incorrecto: ${JSON.stringify(synced)}`)
  }
  if (!synced.verified) fail('la apuesta sincronizada no pasó la verificación de firma')

  console.log('[OK] C sincronizó el estado de la quiniela sin haber visto el mensaje original:', synced)

  await Promise.all([swarmA.destroy(), swarmB.destroy(), swarmC.destroy()])
  process.exit(0)
}

main().catch((err) => fail(err.message))
setTimeout(() => fail(`timeout global (${TIMEOUT_MS}ms)`), TIMEOUT_MS + 3000)
