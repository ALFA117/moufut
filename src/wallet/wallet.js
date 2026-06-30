// Stub: cartera autocustodial con WDK (Tether)
// TODO Semis: integrar @tetherto/wdk

export async function createWallet() {
  console.log('[Wallet] WDK stub — pendiente')
  return {
    address: null,
    balance: null,
    create: async () => ({ address: '0x...nueva', mnemonic: '...' }),
    importFromMnemonic: async (mnemonic) => ({ address: '0x...importada' }),
    getBalance: async () => 0,
    signAndSend: async (tx) => { throw new Error('WDK no integrado aún') },
    destroy: () => {}
  }
}
