// Punto de entrada de UI — conecta módulos P2P/IA/Wallet con la interfaz

export async function launchUI({ swarm, ai, wallet, roomId }) {
  // Inyectar código de sala
  const codeEl = document.getElementById('roomCode')
  if (codeEl) codeEl.textContent = roomId

  // Conectar eventos de P2P a la UI
  swarm.onMessage(({ text, from }) => {
    import('./app.js').then(m => m.receiveMessage({ text, from }))
  })

  swarm.onPeerJoin(() => {
    import('./app.js').then(m => m.updateConnectionStatus({ connected: true, peers: swarm.peers.length }))
  })

  swarm.onPeerLeave(() => {
    import('./app.js').then(m => m.updateConnectionStatus({ connected: swarm.peers.length > 0, peers: swarm.peers.length }))
  })
}
