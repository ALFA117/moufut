// Prueba end-to-end real de la cartera WDK contra Sepolia (testnet) — ver
// TAREAS.md, Checkpoint B, item "No verificado end-to-end contra un RPC
// real". A diferencia de QVAC (que necesita el runtime Bare/Pear para sus
// plugins nativos), @tetherto/wdk-wallet-evm es JS puro sobre `ethers` y
// corre igual en Node plano (confirmado leyendo su package.json: expone
// `index.js` para Node además de `bare.js` para el runtime Bare — no hay
// dependencia nativa que solo funcione dentro de Pear).
//
// Este script NO pasa por wallet.js (ese módulo usa `localStorage`, API de
// navegador que no existe en Node plano — solo corre dentro de la UI
// desktop). En vez de eso llama a WDK/wallet-evm directo, igual que hace
// `deriveRealAddress()` internamente, para probar la ruta real de red.
//
// Uso: node scripts/test-wallet-sepolia.js
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const RPC  = 'https://sepolia.drpc.org'
const USDT = '0x7169d38820dfd117c3fa1f22a697dba58d90ba06' // Test Tether USD, Sepolia

async function main() {
  console.log('=== Prueba real: WDK + wallet-evm contra Sepolia ===')
  console.log(`RPC: ${RPC}`)
  console.log(`Contrato USDt de prueba: ${USDT}\n`)

  const mnemonic = WDK.getRandomSeedPhrase()
  const wdk = new WDK(mnemonic).registerWallet('ethereum', WalletManagerEvm, { provider: RPC })

  const t0 = Date.now()
  const account = await wdk.getAccount('ethereum', 0)
  const address = await account.getAddress()
  console.log(`✅ Cuenta derivada en ${Date.now() - t0}ms`)
  console.log(`   Dirección: ${address}`)
  console.log('   (cartera nueva, sin fondos — se espera balance 0)')

  try {
    const t1 = Date.now()
    const bal = await account.getBalance(USDT)
    const balNum = typeof bal === 'bigint' ? Number(bal) / 1e6 : Number(bal)
    console.log(`✅ getBalance() respondió en ${Date.now() - t1}ms — RPC real de Sepolia alcanzado`)
    console.log(`   Balance USDt: ${balNum}`)
  } catch (err) {
    console.log(`❌ getBalance() falló: ${err.message}`)
    process.exitCode = 1
    return
  }

  console.log('\n(No se prueba signAndSend/transfer real: requeriría fondear esta')
  console.log(' dirección con ETH de prueba para gas + USDt de prueba via el mint')
  console.log(' público del contrato — acción manual, fuera del alcance de este script.)')
}

main().catch((err) => {
  console.error('[FAIL]', err)
  process.exit(1)
})
