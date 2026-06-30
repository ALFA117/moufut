import { createSwarm } from './src/p2p/swarm.js'
import { createCommentator } from './src/ai/commentator.js'
import { createWallet } from './src/wallet/wallet.js'
import { launchUI } from './src/ui/index.js'

const roomId = process.argv[2] || 'moufut-default'

async function main() {
  console.log(`[MouFut] Iniciando sala: ${roomId}`)

  const swarm = await createSwarm(roomId)
  const ai = await createCommentator()
  const wallet = await createWallet()

  await launchUI({ swarm, ai, wallet, roomId })
}

main().catch(err => {
  console.error('[MouFut] Error fatal:', err)
  process.exit(1)
})
