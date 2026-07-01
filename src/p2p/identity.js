import sodium from 'sodium-universal'
import b4a from 'b4a'

/**
 * Wraps a Hyperswarm keypair as a cryptographic identity.
 * Signs messages with crypto_sign_detached (Ed25519).
 */
export function createIdentity(keypair) {
  const { publicKey, secretKey } = keypair

  return {
    get publicKey()    { return publicKey },
    get publicKeyHex() { return b4a.toString(publicKey, 'hex') },
    get shortId()      { return b4a.toString(publicKey, 'hex').slice(0, 8) },

    sign(data) {
      const msg = typeof data === 'string' ? b4a.from(data, 'utf8') : b4a.from(data)
      const sig  = b4a.alloc(sodium.crypto_sign_BYTES)
      sodium.crypto_sign_detached(sig, msg, secretKey)
      return b4a.toString(sig, 'hex')
    },

    verify(data, sigHex, pubkeyHex) {
      try {
        const msg    = typeof data === 'string' ? b4a.from(data, 'utf8') : b4a.from(data)
        const sig    = b4a.from(sigHex, 'hex')
        const pubkey = b4a.from(pubkeyHex, 'hex')
        return sodium.crypto_sign_verify_detached(sig, msg, pubkey)
      } catch {
        return false
      }
    },

    signPayload(obj) {
      const canonical = JSON.stringify(obj, Object.keys(obj).sort())
      return this.sign(canonical)
    },

    verifyPayload(obj, sigHex, pubkeyHex) {
      const canonical = JSON.stringify(obj, Object.keys(obj).sort())
      return this.verify(canonical, sigHex, pubkeyHex)
    }
  }
}
