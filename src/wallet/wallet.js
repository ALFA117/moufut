import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { Wallet as EthersWallet } from 'ethers'
import * as bip39 from 'bip39'

const REAL_MAINNET_KEY = 'moufut_real_mainnet'
const DEMO_BALANCE     = 250 // USDt de mentira — solo para que la UI de la demo tenga algo que mostrar

// Sepolia por default (TESTNET=false para mainnet real — ver README "Cambiar
// de red"). RPC y dirección de USDt de prueba tomados directo de fuentes
// verificadas, no inventados:
//  - `provider: 'https://sepolia.drpc.org'` es el ejemplo oficial de
//    docs.wdk.tether.io / README de @tetherto/wdk-wallet-evm (el paquete
//    solo sigue la red que le indique la URL del RPC, no hay un parámetro
//    `chainId` propio — confirmado leyendo el README instalado).
//  - `0x7169d38820dfd117c3fa1f22a697dba58d90ba06` es "Test Tether USD"
//    (USDT, 6 decimales) verificado en Sepolia Etherscan, con función pública
//    de auto-mint para conseguir saldo de prueba — no existe un USDT oficial
//    de Tether en testnet, este es el estándar de facto que usa el ecosistema
//    (p.ej. mercados de prueba de Aave en Sepolia).
const TESTNET = process.env.TESTNET !== 'false'
const NETWORK = TESTNET
  ? { label: 'Sepolia (testnet)', rpc: 'https://sepolia.drpc.org', usdt: '0x7169d38820dfd117c3fa1f22a697dba58d90ba06' }
  : { label: 'Ethereum mainnet',  rpc: 'https://eth.llamarpc.com',  usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7' }

function isRealMainnetEnabled() {
  try { return localStorage.getItem(REAL_MAINNET_KEY) === '1' } catch { return false }
}

function makeWdk(mnemonic) {
  return new WDK(mnemonic).registerWallet('ethereum', WalletManagerEvm, {
    provider: NETWORK.rpc
  })
}

/**
 * Cartera EVM autocustodial (WDK de Tether), efímera de sesión.
 *
 * SEED EFÍMERA — nunca se persiste: se genera una frase BIP-39 nueva con
 * `WDK.getRandomSeedPhrase()` cada vez que se llama `createWallet()` (o
 * `.create()`), y vive solo en memoria mientras dura la sesión. No se guarda
 * en `localStorage` ni en ningún otro lado — al cerrar o recargar la app, la
 * cartera se pierde. Es la opción más segura para un demo de hackathon: cero
 * riesgo de que alguien meta fondos reales y los pierda por una fuga de la
 * seed en texto plano. Quien quiera reusar la misma dirección entre sesiones
 * puede copiar su frase y usar "Importar cartera" — eso es una decisión
 * explícita del usuario, no algo que la app haga sola.
 *
 * MODO DEMO (por defecto): la dirección se deriva de verdad de la frase
 * BIP-39 (con `ethers`, sin tocar la red), pero el balance y los envíos son
 * simulados — nunca se conecta a ninguna red real ni mueve fondos reales.
 * Así la demo se ve auténtica sin arriesgar dinero real durante el hackathon.
 *
 * MODO REAL: se activa a propósito con
 * `localStorage.setItem('moufut_real_mainnet', '1')` (recarga después) desde
 * la consola de Pear/devtools. En ese modo la cartera opera de verdad contra
 * el contrato de USDt en `NETWORK.label` (Sepolia testnet por defecto — ver
 * la constante `TESTNET` arriba; `TESTNET=false` para Ethereum mainnet real).
 *
 * @returns {Promise<{
 *   address: string|null,
 *   mnemonic: string|null,
 *   isDemo: boolean,
 *   network: string,
 *   isTestnet: boolean,
 *   create: () => Promise<{address:string, mnemonic:string}>,
 *   importFromMnemonic: (phrase: string) => Promise<{address:string}>,
 *   getBalance: () => Promise<number|null>,
 *   signAndSend: (tx: {to:string, amount:number}) => Promise<unknown>,
 *   destroy: () => void,
 * }>}
 */
export async function createWallet() {
  const demo = !isRealMainnetEnabled()

  let mnemonic = WDK.getRandomSeedPhrase()
  let wdk      = null
  let account  = null
  let address  = null

  function deriveDemoAddress(phrase) {
    return EthersWallet.fromPhrase(phrase).address
  }

  async function deriveRealAddress(phrase) {
    wdk     = makeWdk(phrase)
    account = await wdk.getAccount('ethereum', 0)
    return account.getAddress()
  }

  async function deriveAddress(phrase) {
    return demo ? deriveDemoAddress(phrase) : deriveRealAddress(phrase)
  }

  address = await deriveAddress(mnemonic)
  console.log(`[Wallet] Cartera de sesión generada (${demo ? 'demo' : 'REAL'} · red: ${NETWORK.label}):`, address)
  console.log('[Wallet] La frase semilla NO se guarda — se pierde al cerrar o recargar la app.')
  if (demo) {
    console.log('[Wallet] Modo DEMO activo: balance y envíos simulados, no se toca la red.')
  } else {
    console.warn(`[Wallet] MODO REAL activo — esta cartera opera de verdad contra ${NETWORK.label}.`)
  }

  return {
    get address() { return address },
    get mnemonic() { return mnemonic },
    get isDemo() { return demo },
    get network() { return NETWORK.label },
    get isTestnet() { return TESTNET },

    async create() {
      mnemonic = WDK.getRandomSeedPhrase()
      address = await deriveAddress(mnemonic)
      console.log(`[Wallet] Nueva cartera de sesión (${demo ? 'demo' : 'REAL'} · ${NETWORK.label}):`, address)
      return { address, mnemonic }
    },

    async importFromMnemonic(phrase) {
      if (!bip39.validateMnemonic(phrase)) throw new Error('Frase secreta inválida')
      mnemonic = phrase.trim()
      address = await deriveAddress(mnemonic)
      console.log(`[Wallet] Cartera importada (${demo ? 'demo' : 'REAL'} · ${NETWORK.label}):`, address)
      return { address }
    },

    async getBalance() {
      if (!address) return null
      if (demo) return DEMO_BALANCE
      if (!account) return null
      try {
        const bal = await account.getBalance(NETWORK.usdt)
        return typeof bal === 'bigint' ? Number(bal) / 1e6 : Number(bal)
      } catch {
        return null
      }
    },

    async signAndSend({ to, amount }) {
      if (!address) throw new Error('No hay cartera activa')
      if (demo) {
        await new Promise((resolve) => setTimeout(resolve, 400))
        return { demo: true, txHash: '0xDEMO' + Date.now().toString(16) }
      }
      if (!account) throw new Error('No hay cartera activa')
      return account.transfer({
        token: NETWORK.usdt,
        to,
        amount: BigInt(Math.round(amount * 1e6))
      })
    },

    destroy() {
      wdk?.dispose?.()
    }
  }
}
