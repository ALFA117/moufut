import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import * as bip39 from 'bip39'

const USDT_ERC20      = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const ETH_RPC_PUBLIC  = 'https://eth.llamarpc.com'
const STORAGE_KEY     = 'moufut_mnemonic'

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
 * Cartera EVM autocustodial (WDK de Tether). La frase semilla BIP-39 nunca
 * sale del dispositivo — se guarda solo en `localStorage` local y se usa
 * para derivar la cuenta 0 de Ethereum vía `@tetherto/wdk-wallet-evm`.
 * Si ya existe una mnemonic guardada, se restaura automáticamente al crear.
 *
 * @returns {Promise<{
 *   address: string|null,
 *   mnemonic: string|null,
 *   create: () => Promise<{address:string, mnemonic:string}>,
 *   importFromMnemonic: (phrase: string) => Promise<{address:string}>,
 *   getBalance: () => Promise<number|null>,
 *   signAndSend: (tx: {to:string, amount:number}) => Promise<unknown>,
 *   destroy: () => void,
 * }>}
 */
export async function createWallet() {
  let mnemonic = loadMnemonic()
  let wdk      = null
  let account  = null
  let address  = null

  if (mnemonic) {
    try {
      wdk     = makeWdk(mnemonic)
      account = await wdk.getAccount('ethereum', 0)
      address = await account.getAddress()
      console.log('[Wallet] Cartera restaurada:', address)
    } catch (err) {
      console.warn('[Wallet] Error al restaurar:', err.message)
      mnemonic = null
    }
  }

  if (!address) {
    console.log('[Wallet] Sin cartera — listo para crear o importar')
  }

  return {
    get address() { return address },
    get mnemonic() { return mnemonic },

    async create() {
      mnemonic = bip39.generateMnemonic()
      saveMnemonic(mnemonic)
      wdk     = makeWdk(mnemonic)
      account = await wdk.getAccount('ethereum', 0)
      address = await account.getAddress()
      console.log('[Wallet] Nueva cartera:', address)
      return { address, mnemonic }
    },

    async importFromMnemonic(phrase) {
      if (!bip39.validateMnemonic(phrase)) throw new Error('Frase secreta inválida')
      mnemonic = phrase.trim()
      saveMnemonic(mnemonic)
      wdk     = makeWdk(mnemonic)
      account = await wdk.getAccount('ethereum', 0)
      address = await account.getAddress()
      console.log('[Wallet] Cartera importada:', address)
      return { address }
    },

    async getBalance() {
      if (!account) return null
      try {
        const bal = await account.getBalance(USDT_ERC20)
        return typeof bal === 'bigint' ? Number(bal) / 1e6 : Number(bal)
      } catch {
        return null
      }
    },

    async signAndSend({ to, amount }) {
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
