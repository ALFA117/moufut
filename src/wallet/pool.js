import { validate, createMsg, MSG } from '../p2p/schema.js'

/**
 * Pool de quiniela P2P para MouFut.
 *
 * Responsabilidades:
 *  1. Recibir y verificar apuestas firmadas de peers
 *  2. Registrar reportes de marcador final
 *  3. Calcular consenso por mayoría simple
 *  4. Detectar ganadores y disparar liquidación
 *  5. Emitir eventos a la UI via onChange()
 *
 * Las llaves nunca salen del dispositivo — pool.liquidate() solo
 * determina quién ganó; el transfer real lo ejecuta el usuario en wallet.js
 */
export function createPool({ swarm, identity }) {
  // peerId → { home, away, amount, sig, pubkey, verified, ts, peerId }
  const bets = new Map()
  // peerId → { home, away }
  const scoreReports = new Map()
  const listeners = []

  let consensusScore = null
  let settled        = false

  // ── Mensajes entrantes ──────────────────────────────────────────────────────

  swarm.onMessage((msg, fromPeer) => {
    if (!validate(msg)) return

    if (msg.type === MSG.PREDICTION) {
      const { home, away, amount, sig, pubkey, _ts } = msg
      // Verificar firma Ed25519: el payload canónico es { home, away, amount, ts }
      const payload  = { amount: Number(amount), away: Number(away), home: Number(home), ts: _ts }
      const verified = identity.verifyPayload(payload, sig, pubkey)

      bets.set(fromPeer, {
        home: Number(home), away: Number(away),
        amount: Number(amount),
        sig, pubkey, verified,
        ts: _ts, peerId: fromPeer
      })
      emit({ type: 'bets', bets: allBets() })
    }

    if (msg.type === MSG.FINAL_SCORE) {
      scoreReports.set(fromPeer, { home: Number(msg.home), away: Number(msg.away) })
      handleScoreUpdate()
    }

    if (msg.type === MSG.SETTLEMENT) {
      emit({ type: 'settlement_received', data: msg })
    }

    // Un peer existente nos reenvía el estado completo de la quiniela (apuestas
    // firmadas + reportes de marcador) para que los peers que se unen tarde a
    // la malla queden sincronizados sin haber visto los mensajes originales.
    if (msg.type === MSG.STATE_SYNC) {
      let changed = false

      for (const b of msg.bets) {
        if (bets.has(b.peerId)) continue
        const payload  = { amount: Number(b.amount), away: Number(b.away), home: Number(b.home), ts: b.ts }
        const verified = identity.verifyPayload(payload, b.sig, b.pubkey)
        bets.set(b.peerId, {
          home: Number(b.home), away: Number(b.away), amount: Number(b.amount),
          sig: b.sig, pubkey: b.pubkey, verified,
          ts: b.ts, peerId: b.peerId
        })
        changed = true
      }

      for (const r of msg.reports) {
        if (scoreReports.has(r.peerId)) continue
        scoreReports.set(r.peerId, { home: Number(r.home), away: Number(r.away) })
        changed = true
      }

      if (changed) {
        emit({ type: 'bets', bets: allBets() })
        handleScoreUpdate()
      }
    }
  })

  swarm.onPeerLeave((peerId) => {
    const hadBet = bets.has(peerId)
    bets.delete(peerId)
    scoreReports.delete(peerId)
    if (hadBet) emit({ type: 'bets', bets: allBets() })
  })

  // Cuando un nuevo peer se une a la malla, le distribuimos el estado que ya
  // conocemos (si lo hay) para que no dependa de haber estado presente cuando
  // se originaron las apuestas o reportes.
  //
  // La conexión recién aceptada por Hyperswarm puede tardar ~1-3s en terminar
  // de estabilizarse a nivel de transporte (hole-punching/UDX); un envío
  // inmediato puede perderse en silencio durante esa ventana. Por eso se
  // reintenta unas pocas veces con backoff — STATE_SYNC es idempotente
  // (el receptor ignora bets/reports que ya conoce), así que repetir es seguro.
  swarm.onPeerJoin(() => {
    if (bets.size === 0 && scoreReports.size === 0) return
    const sendSync = () => swarm.send(createMsg(MSG.STATE_SYNC, { bets: allBets(), reports: allReports() }))
    sendSync()
    for (const delayMs of [800, 2000, 4000]) setTimeout(sendSync, delayMs)
  })

  // ── Helpers privados ────────────────────────────────────────────────────────

  function allBets()   { return [...bets.values()] }
  function allReports(){ return [...scoreReports.entries()].map(([id, s]) => ({ peerId: id, ...s })) }

  function totalPot()  { return allBets().reduce((s, b) => s + b.amount, 0) }

  function computeConsensus() {
    if (scoreReports.size < 1) return null
    const counts = new Map()
    for (const s of scoreReports.values()) {
      const key = `${s.home}:${s.away}`
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    // Mayoría simple: >50% de los reportes coinciden
    const threshold = scoreReports.size / 2
    for (const [key, count] of counts) {
      if (count > threshold) {
        const [h, a] = key.split(':').map(Number)
        return { home: h, away: a }
      }
    }
    return null
  }

  function handleScoreUpdate() {
    const consensus = computeConsensus()
    if (consensus && !settled) {
      consensusScore = consensus
      emit({ type: 'consensus', score: consensus, reports: allReports() })
    } else {
      emit({ type: 'reports', reports: allReports(), consensus: null })
    }
  }

  function emit(event) { listeners.forEach(cb => cb(event)) }

  // ── API pública ─────────────────────────────────────────────────────────────

  return {
    get bets()      { return allBets() },
    get totalPot()  { return totalPot() },
    get consensus() { return consensusScore },
    get reports()   { return allReports() },
    get isSettled() { return settled },

    /**
     * Registra y difunde la apuesta del peer local.
     * La firma es Ed25519 sobre el payload canónico JSON ordenado.
     */
    submit({ home, away, amount }) {
      const h = Number(home), a = Number(away), amt = Number(amount)
      if (!Number.isFinite(h) || !Number.isFinite(a)) throw new Error('Marcador inválido')
      if (!Number.isFinite(amt) || amt <= 0)           throw new Error('Monto inválido')

      const ts      = Date.now()
      const payload = { amount: amt, away: a, home: h, ts }
      const sig     = identity.signPayload(payload)
      const myId    = identity.shortId

      bets.set(myId, { home: h, away: a, amount: amt, sig, pubkey: identity.publicKeyHex, verified: true, ts, peerId: myId })
      swarm.send(createMsg(MSG.PREDICTION, {
        home: h, away: a, amount: amt,
        sig, pubkey: identity.publicKeyHex, _ts: ts
      }))
      emit({ type: 'bets', bets: allBets() })
    },

    /**
     * Reporta el marcador final del partido.
     * Cuando la mayoría de peers reporta el mismo resultado, se activa el consenso.
     */
    reportFinalScore({ home, away }) {
      if (settled) return
      const h = Number(home), a = Number(away)
      scoreReports.set(identity.shortId, { home: h, away: a })
      swarm.send(createMsg(MSG.FINAL_SCORE, { home: h, away: a }))
      handleScoreUpdate()
    },

    /**
     * Devuelve las apuestas que aciertan el marcador dado (o el consenso si no se pasa).
     */
    winners(score) {
      const s = score ?? consensusScore
      if (!s) return []
      return allBets().filter(b => b.home === s.home && b.away === s.away)
    },

    /**
     * Liquida la quiniela:
     *  - Detecta ganadores por consenso de marcador
     *  - Calcula la parte proporcional del pozo
     *  - Difunde MSG.SETTLEMENT a todos los peers
     *  - Retorna { winners, share, pot, iAmWinner }
     *
     * La transferencia real de USDt la ejecuta el llamador con wallet.signAndSend().
     */
    async liquidate(forcedScore) {
      if (settled) return { error: 'El pool ya fue liquidado' }
      settled = true

      const s = forcedScore ?? consensusScore
      if (!s) {
        settled = false
        return { error: 'No hay consenso de marcador aún' }
      }

      const winnerBets = this.winners(s)
      const pot        = totalPot()

      if (winnerBets.length === 0) {
        swarm.send(createMsg(MSG.SETTLEMENT, { score: s, winners: [], amount: 0, pot, noWinners: true }))
        emit({ type: 'settled', winners: [], share: 0, pot, score: s, iAmWinner: false })
        return { winners: [], share: 0, pot, iAmWinner: false }
      }

      const share    = pot / winnerBets.length
      const myId     = identity.shortId
      const iAmWinner = winnerBets.some(b => b.peerId === myId)

      swarm.send(createMsg(MSG.SETTLEMENT, {
        score: s,
        winners: winnerBets.map(b => b.peerId),
        amount: share,
        pot
      }))

      emit({ type: 'settled', winners: winnerBets, share, pot, score: s, iAmWinner })
      return { winners: winnerBets, share, pot, iAmWinner }
    },

    onChange(cb) { listeners.push(cb) }
  }
}
