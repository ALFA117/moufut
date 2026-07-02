import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { Wallet as EthersWallet } from 'ethers'
import * as bip39 from 'bip39'

const USDT_ERC20       = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const ETH_RPC_PUBLIC   = 'https://eth.llamarpc.com'
const STORAGE_KEY      = 'moufut_mnemonic'
const REAL_MAINNET_KEY = 'moufut_real_mainnet'
const DEMO_BALANCE     = 250 // USDt de mentira — solo para que la UI de la demo tenga algo que mostrar

function isRealMainnetEnabled() {
  try { return localStorage.getItem(REAL_MAINNET_KEY) === '1' } catch { return false }
}

function saveMnemonic(mnemonic) {
  try { localStorage.setItem(STORAGE_KEY, mnemonic) } catch {}
}

function loadMnemonic() {
  try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
}

function makeWdk(mnemonic) {
  return new WDK(mnemonic).registerWallet('ethereum', WalletManagerEvm, {
    provider: ETH_RPC_PUBLIC
  })
}

/**
 * Cartera EVM autocustodial (WDK de Tether).
 *
 * MODO DEMO (por defecto): la dirección se deriva de verdad de la frase
 * BIP-39 (con `ethers`, sin tocar la red), pero el balance y los envíos son
 * simulados — nunca se conecta a Ethereum mainnet ni mueve fondos reales.
 * Así la demo se ve auténtica sin arriesgar dinero real durante el hackathon.
 *
 * MODO MAINNET REAL: se activa a propósito con
 * `localStorage.setItem('moufut_real_mainnet', '1')` (recarga después) desde
 * la consola de Pear/devtools. En ese modo la cartera opera contra el
 * contrato real de USDt (ERC-20) en Ethereum mainnet vía un RPC público —
 * usa fondos reales bajo tu propio riesgo.
 *
 * La frase semilla nunca sale del dispositivo — se guarda solo en
 * `localStorage` local. Si ya existe una guardada, se restaura al crear.
 *
 * @returns {Promise<{
 *   address: string|null,
 *   mnemonic: string|null,
 *   isDemo: boolean,
 *   create: () => Promise<{address:string, mnemonic:string}>,
 *   importFromMnemonic: (phrase: string) => Promise<{address:string}>,
 *   getBalance: () => Promise<number|null>,
 *   signAndSend: (tx: {to:string, amount:number}) => Promise<unknown>,
 *   destroy: () => void,
 * }>}
 */
export async function createWallet() {
  const demo = !isRealMainnetEnabled()

  let mnemonic = loadMnemonic()
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

  if (mnemonic) {
    try {
      address = await deriveAddress(mnemonic)
      console.log(`[Wallet] Cartera restaurada (${demo ? 'demo' : 'MAINNET REAL'}):`, address)
    } catch (err) {
      console.warn('[Wallet] Error al restaurar:', err.message)
      mnemonic = null
    }
  }

  if (!address) {
    console.log('[Wallet] Sin cartera — listo para crear o importar')
  }
  if (demo) {
    console.log('[Wallet] Modo DEMO activo: balance y envíos simulados, no se toca Ethereum mainnet.')
  } else {
    console.warn('[Wallet] MODO MAINNET REAL activo — esta cartera opera con fondos reales.')
  }

  return {
    get address() { return address },
    get mnemonic() { return mnemonic },
    get isDemo() { return demo },

    async create() {
      mnemonic = bip39.generateMnemonic()
      saveMnemonic(mnemonic)
      address = await deriveAddress(mnemonic)
      console.log(`[Wallet] Nueva cartera (${demo ? 'demo' : 'MAINNET REAL'}):`, address)
      return { address, mnemonic }
    },

    async importFromMnemonic(phrase) {
      if (!bip39.validateMnemonic(phrase)) throw new Error('Frase secreta inválida')
      mnemonic = phrase.trim()
      saveMnemonic(mnemonic)
      address = await deriveAddress(mnemonic)
      console.log(`[Wallet] Cartera importada (${demo ? 'demo' : 'MAINNET REAL'}):`, address)
      return { address }
    },

    async getBalance() {
      if (!address) return null
      if (demo) return DEMO_BALANCE
      if (!account) return null
      try {
        const bal = await account.getBalance(USDT_ERC20)
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
        token: USDT_ERC20,
        to,
        amount: BigInt(Math.round(amount * 1e6))
      })
    },

    destroy() {
      wdk?.dispose?.()
    }
  }
}
