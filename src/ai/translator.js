import { loadModel, transcribe, translate } from '@qvac/sdk'
import { WHISPER_BASE_Q8_0, AFRICAN_4B_TRANSLATION_Q4_K_M } from '@qvac/sdk/models'

let whisperModelId   = null
let translateModelId = null

async function loadModels() {
  try {
    [whisperModelId, translateModelId] = await Promise.all([
      loadModel({
        modelSrc: WHISPER_BASE_Q8_0,
        onProgress: (p) => p.percentage != null && process.stderr?.write?.(`\r[Whisper] ${p.percentage.toFixed(0)}%`)
      }),
      loadModel({
        modelSrc: AFRICAN_4B_TRANSLATION_Q4_K_M,
        onProgress: (p) => p.percentage != null && process.stderr?.write?.(`\r[NMT] ${p.percentage.toFixed(0)}%`)
      })
    ])
    console.log('[Translator] Whisper + NMT listos on-device')
  } catch (err) {
    console.warn('[Translator] QVAC no disponible:', err.message)
  }
}

export async function createTranslator() {
  await loadModels()

  return {
    /**
     * Transcribe un buffer de audio (Uint8Array o Buffer) a texto.
     * @param {Uint8Array} audioBuffer
     * @returns {Promise<string>}
     */
    async transcribeAudio(audioBuffer) {
      if (!whisperModelId) return '[Sin Whisper] transcripción no disponible'
      try {
        return await transcribe({ modelId: whisperModelId, audioChunk: audioBuffer })
      } catch (err) {
        return `[Error transcripción] ${err.message}`
      }
    },

    /**
     * Traduce texto de `from` a `to` on-device con NMT.
     * @param {string} text
     * @param {'es'|'en'|string} to
     * @param {string} [from]
     * @returns {Promise<string>}
     */
    async translateText(text, to = 'en', from = 'es') {
      if (!translateModelId) return `[Sin NMT] ${text}`
      try {
        const result = translate({ modelId: translateModelId, text, from, to, stream: false })
        return await result.text
      } catch (err) {
        return `[Error traducción] ${err.message}`
      }
    },

    /**
     * Pipeline completo: audio → transcripción → traducción.
     * @param {Uint8Array} audioBuffer
     * @param {'en'|string} targetLang
     * @returns {Promise<{original: string, translated: string}>}
     */
    async pipeline(audioBuffer, targetLang = 'en') {
      const original   = await this.transcribeAudio(audioBuffer)
      const translated = await this.translateText(original, targetLang)
      return { original, translated }
    },

    destroy() {}
  }
}
