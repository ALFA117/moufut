// Prueba end-to-end real de la cartera WDK contra Sepolia (testnet) — ver
// TAREAS.md, Checkpoint B, item "No probado: signAndSend()/transfer() real".
// A diferencia de QVAC (que necesita el runtime Bare/Pear para sus plugins
// nativos), @tetherto/wdk-wallet-evm es JS puro sobre `ethers` y corre igual
// en Node plano (confirmado leyendo su package.json: expone `index.js` para
// Node además de `bare.js` para el runtime Bare — no hay dependencia nativa
// que solo funcione dentro de Pear).
//
// Este script NO pasa por wallet.js (ese módulo usa `localStorage`, API de
// navegador que no existe en Node plano — solo corre dentro de la UI
// desktop). En vez de eso llama a WDK/wallet-evm directo, igual que hace
// `deriveRealAddress()` internamente, para probar la ruta real de red.
//
// Uso:
//   node scripts/test-wallet-sepolia.js
//     -> genera una mnemonic nueva cada vez, imprime la dirección y las
//        instrucciones de fondeo, y se detiene ahí (no hay nada que enviar).
//   TEST_MNEMONIC="doce palabras..." node scripts/test-wallet-sepolia.js
//     -> reusa siempre la misma dirección. Fondeá esa dirección UNA vez
//        (instrucciones abajo) y volvé a correr el script las veces que
//        quieras: si ya tiene ETH de gas + USDt de prueba, intenta un
//        transfer real (auto-envío de 1 USDt) para confirmar que
//        signAndSend()/transfer() funciona de punta a punta.
import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const RPC  = 'https://sepolia.drpc.org'
const USDT = '0x7169d38820dfd117c3fa1f22a697dba58d90ba06' // Test Tether USD, Sepolia

function fundingInstructions(address) {
  console.log('\nPara fondear esta dirección (una sola vez):')
  console.log('  1. ETH de prueba (gas): https://www.alchemy.com/faucets/ethereum-sepolia')
  console.log(`     o https://sepolia-faucet.pk910.de/  ->  pegar: ${address}`)
  console.log(`  2. USDt de prueba (mint público del contrato): abrir`)
  console.log(`     https://sepolia.etherscan.io/address/${USDT}#writeContract`)
  console.log(`     conectar una wallet (ej. MetaMask) con la cuenta de arriba y`)
  console.log(`     llamar a la función "mint" (o similar de auto-mint del contrato).`)
  console.log('\nDespués volvé a correr:')
  console.log(`  TEST_MNEMONIC="<tu frase>" node scripts/test-wallet-sepolia.js`)
}

async function main() {
  console.log('=== Prueba real: WDK + wallet-evm contra Sepolia ===')
  console.log(`RPC: ${RPC}`)
  console.log(`Contrato USDt de prueba: ${USDT}\n`)

  const reusingMnemonic = Boolean(process.env.TEST_MNEMONIC)
  const mnemonic = process.env.TEST_MNEMONIC || WDK.getRandomSeedPhrase()
  const wdk = new WDK(mnemonic).registerWallet('ethereum', WalletManagerEvm, { provider: RPC })

  const t0 = Date.now()
  const account = await wdk.getAccount('ethereum', 0)
  const address = await account.getAddress()
  console.log(`✅ Cuenta derivada en ${Date.now() - t0}ms`)
  console.log(`   Dirección: ${address}`)

  if (!reusingMnemonic) {
    console.log('\n⚠️  Mnemonic generada al azar — se pierde al terminar este proceso.')
    console.log('   Para reusar esta MISMA dirección en la próxima corrida (necesario')
    console.log('   para poder fondearla y después probar el transfer real), guardá:')
    console.log(`   TEST_MNEMONIC="${mnemonic}"`)
  }

  let ethBalance = 0n
  let usdtBalance = 0n
  try {
    const t1 = Date.now()
    // `getBalance()` sin argumentos devuelve el balance NATIVO (ETH) en este
    // SDK. El balance de un token ERC-20 es un método aparte:
    // `getTokenBalance(address)`. Confirmado leyendo
    // wallet-account-read-only-evm.js instalado — un intento anterior de este
    // script llamaba a `getBalance(USDT)`, que ignora el argumento y siempre
    // devuelve el balance de ETH, no el de USDt (mismo bug real que existía
    // en src/wallet/wallet.js, corregido en el mismo commit que este script).
    ethBalance = await account.getBalance()
    usdtBalance = await account.getTokenBalance(USDT)
    console.log(`✅ Balances leídos en ${Date.now() - t1}ms — RPC real de Sepolia alcanzado`)
    console.log(`   ETH (gas):  ${Number(ethBalance) / 1e18}`)
    console.log(`   USDt:       ${Number(usdtBalance) / 1e6}`)
  } catch (err) {
    console.log(`❌ Falló la lectura de balances: ${err.message}`)
    process.exitCode = 1
    return
  }

  if (ethBalance === 0n || usdtBalance === 0n) {
    console.log('\n(No se prueba signAndSend()/transfer() real: falta fondear esta')
    console.log(' dirección con ETH de prueba para gas y/o USDt de prueba.)')
    fundingInstructions(address)
    return
  }

  console.log('\n💸 Cartera fondeada — probando transfer() real (auto-envío de 1 USDt)...')
  try {
    const t2 = Date.now()
    // `EvmTransferOptions` del SDK usa `recipient`, no `to` — mismo bug real
    // corregido en src/wallet/wallet.js. Un auto-envío a la propia dirección
    // prueba la ruta completa (firma + broadcast + confirmación) sin perder
    // fondos de prueba.
    const result = await account.transfer({
      token: USDT,
      recipient: address,
      amount: 1_000000n // 1 USDt (6 decimales)
    })
    console.log(`✅ transfer() confirmado en ${Date.now() - t2}ms`)
    console.log(`   Hash: ${result.hash}`)
    console.log(`   Fee:  ${result.fee}`)
  } catch (err) {
    console.log(`❌ transfer() falló: ${err.message}`)
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('[FAIL]', err)
  process.exit(1)
})
