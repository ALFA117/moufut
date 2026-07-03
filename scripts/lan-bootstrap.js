// Levanta un nodo bootstrap de HyperDHT aislado para operar MouFut en modo
// LAN sin internet (ver DHT.bootstrapper() en docs.pears.com/reference/
// building-blocks/hyperdht). Correlo en UN solo dispositivo de la sala (p.ej.
// la laptop); los demás peers apuntan a su IP:puerto con `?bootstrap=host:port`
// en la URL de la app en vez de usar los nodos públicos de internet.
//
// También anuncia el nodo por mDNS (ver src/p2p/lan-discovery.js) para que
// los demás peers lo encuentren solos con `?bootstrap=auto` en vez de tener
// que escribir la IP:puerto a mano.
//
// Uso: node scripts/lan-bootstrap.js [puerto]
import HyperDHT from 'hyperdht'
import os from 'os'
import { announceLanBootstrap } from '../src/p2p/lan-discovery.js'

const PORT = Number(process.argv[2]) || 49737

function localLanIPv4() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    if (/tailscale|vpn/i.test(name)) continue
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return null
}

async function main() {
  const host = localLanIPv4()
  if (!host) {
    console.error('[lan-bootstrap] No se encontró una IP de red local (Wi-Fi/Ethernet). ¿Estás conectado a una red?')
    process.exit(1)
  }

  const node = HyperDHT.bootstrapper(PORT, host)
  await node.ready()

  const announcement = announceLanBootstrap({ host, port: PORT })

  console.log(`[lan-bootstrap] Nodo bootstrap propio activo en ${host}:${PORT}`)
  console.log(`[lan-bootstrap] Anunciado por mDNS — en los demás dispositivos (misma red, internet apagado), abrí la app con:`)
  console.log(`[lan-bootstrap]   ?bootstrap=auto#<codigo-de-sala>  (autodescubre este nodo)`)
  console.log(`[lan-bootstrap] o, si el mDNS no llega a esa red:`)
  console.log(`[lan-bootstrap]   ?bootstrap=${host}:${PORT}#<codigo-de-sala>`)

  process.once('SIGINT', () => {
    console.log('\n[lan-bootstrap] Cerrando nodo bootstrap...')
    announcement.destroy()
    node.destroy()
  })
}

main().catch((err) => {
  console.error('[lan-bootstrap] FAIL', err.message)
  process.exit(1)
})
