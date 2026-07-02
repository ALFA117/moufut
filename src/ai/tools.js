import { z } from 'zod'

/**
 * Herramientas locales que el orquestador (MouBot con tool calling) puede
 * invocar para responder con datos reales de la sala en vez de inventarlos.
 * Cada `handler` corre 100% en el dispositivo, sobre módulos ya existentes
 * de P2P/wallet — nada llama a una API externa. El formato `{name,
 * description, parameters, handler}` es el que espera `completion({tools})`
 * de QVAC (ver `node_modules/@qvac/sdk/dist/examples/tools/`).
 *
 * @param {object} deps
 * @param {() => {home:number, away:number, minute:string}} deps.getMatchState
 * @param {{predictions: Array<{home:number, away:number, amount:number, peerId:string}>}} deps.board - tablón de predicciones (p2p/board.js)
 * @param {{bets:Array, totalPot:number, consensus:object|null, isSettled:boolean}} deps.pool - quiniela (wallet/pool.js)
 * @param {(text:string, targetLang?:string) => Promise<string>} deps.translateText
 * @param {(bet:{home:number, away:number, amount:number}) => void} deps.onProposeBet - deja la apuesta lista en la UI para que el usuario la confirme; NUNCA envía dinero por sí sola
 * @returns {import('@qvac/sdk').Tool[]}
 */
export function createTools({ getMatchState, board, pool, translateText, onProposeBet }) {
  return [
    {
      name: 'get_match_state',
      description: 'Devuelve el marcador y el minuto actual del partido en curso.',
      parameters: z.object({}),
      handler: async () => getMatchState()
    },

    {
      name: 'query_board',
      description: 'Lee el tablón de predicciones de marcador que los demás peers de la sala compartieron por la malla P2P.',
      parameters: z.object({}),
      handler: async () => ({ predictions: board.predictions })
    },

    {
      name: 'translate_text',
      description: 'Traduce un texto a otro idioma, on-device.',
      parameters: z.object({
        text: z.string().describe('Texto a traducir'),
        targetLang: z.string().optional().describe('Código del idioma destino, p.ej. "en" o "es" (default "en")')
      }),
      handler: async ({ text, targetLang }) => ({ translated: await translateText(text, targetLang || 'en') })
    },

    {
      name: 'get_pool_status',
      description: 'Consulta el estado de la quiniela: bote total en USDt, número de apuestas registradas y si ya hay consenso de marcador final.',
      parameters: z.object({}),
      handler: async () => ({
        totalPot: pool.totalPot,
        betsCount: pool.bets.length,
        consensus: pool.consensus,
        isSettled: pool.isSettled
      })
    },

    {
      name: 'place_bet',
      description: 'Prepara una apuesta de marcador en la quiniela. NUNCA envía dinero directamente: solo deja la apuesta lista en la pantalla de Quiniela para que el usuario la revise y confirme a mano con el botón "Apostar".',
      parameters: z.object({
        home: z.number().describe('Marcador que predice el usuario para el equipo local (México)'),
        away: z.number().describe('Marcador que predice el usuario para el equipo visitante'),
        amount: z.number().describe('Monto en USDt que el usuario quiere apostar')
      }),
      handler: async ({ home, away, amount }) => {
        onProposeBet({ home, away, amount })
        return {
          proposed: true,
          home, away, amount,
          note: 'Apuesta preparada en la pestaña Quiniela, pendiente de que el usuario la confirme a mano.'
        }
      }
    }
  ]
}
