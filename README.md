# ⚽ MouFut

**El companero de partido que funciona aunque se caiga el internet.**

> *El partido pasa, no la conexion.*

MouFut conecta a la hinchada de alrededor por una **malla peer-to-peer** (sin servidor),
narra y traduce el partido con **IA que corre en tu propio telefono** (sin nube), y
liquida la **quiniela del grupo en USDt** sin intermediarios. Pensado para estadios
llenos y bares a reventar durante el Mundial, donde no hay senal.

Proyecto para la **Tether Developers Cup**.
Pista: **QVAC (IA local)**, apoyada en **Pears (P2P)** y **WDK (carteras)**.

---

## Por que MouFut

En un estadio lleno la red celular se satura y casi todas las apps de futbol mueren.
MouFut vive justo ahi: todo lo importante sobrevive **sin internet**.

- **Offline-first y resistente a censura** gracias a la malla P2P de Pears.
- **Privado por diseno**: la IA corre en el dispositivo (QVAC). Tus datos nunca salen.
- **Dinero entre amigos sin intermediarios**: quinielas autocustodiales en USDt (WDK).

## Las tres capas

| Capa | Stack de Tether | Que hace |
|------|-----------------|----------|
| **P2P** | Pears (Holepunch) | Descubrimiento de peers, chat de hinchada, reacciones a las jugadas, tablon de predicciones. Sin servidor. |
| **IA** | QVAC SDK | Comentarista/analista tactico y **traduccion de voz en vivo**, todo **on-device**. |
| **Dinero** | WDK | Cartera autocustodial y quiniela en USDt liquidada peer-to-peer. |

> **Regla de la pista QVAC:** toda la IA (inferencia, voz, traduccion) corre en el
> dispositivo mediante el SDK de QVAC. **Cero APIs de IA en la nube.**

## Arquitectura

```
┌─────────────────────────────────────────────┐
│                  MouFut                        │
│        (Bare / Pears runtime, multiplataforma) │
├───────────────┬───────────────┬───────────────┤
│   CAPA P2P     │   CAPA IA      │  CAPA DINERO   │
│   (Pears)      │   (QVAC)       │   (WDK)        │
│ swarm/chat/    │ comentarista/  │ cartera +      │
│ tablon         │ traductor      │ quiniela USDt  │
└───────────────┴───────────────┴───────────────┘
     Todo corre en el telefono. Sin backend propio.
```

## Estructura del repo

```
moufut/
├── app.js                 # entry point legacy (CLI/Bare, no lo usa la UI desktop)
├── package.json
├── README.md
├── LICENSE                # Apache 2.0
├── scripts/                # pruebas de P2P/quiniela/IA (ver "Pruebas")
├── src/
│   ├── p2p/               # capa Pears: swarm, chat, board, schema, identity
│   ├── ai/                # capa QVAC: commentator, translator (on-device)
│   ├── wallet/            # capa WDK: wallet, pool (quiniela USDt)
│   └── ui/                # interfaz desktop (index.html + app.js) — esto es lo que abre `pear run --dev .`
└── demo/                  # guion del video de 3 min
```

## Requisitos

- **Node.js** 18+ (se probó con Node 22).
- **Pears / Bare runtime**. Instalación: ver https://docs.pears.com/
- Salida **UDP** sin bloquear en tu red/firewall — Hyperswarm necesita UDP para el DHT (ver "Solución de problemas" si la malla no conecta).
- Dos dispositivos (o dos terminales) para probar la malla P2P.

## Instalación y ejecución

```bash
# 1. Clonar
git clone https://github.com/<tu-usuario>/moufut.git
cd moufut

# 2. Instalar dependencias
npm install

# 3. Arrancar (abre la ventana desktop: src/ui/index.html + src/ui/app.js)
pear run --dev .            # o:  npm start

# 4. Probar la malla: en otra terminal / otro dispositivo, mismo código de sala
pear run --dev . mi-sala-de-prueba
```

> Si `npm install` falla con `@qvac/sdk` o `@tetherto/wdk`, instala cada uno con
> `@latest` y confirma la versión según la doc oficial (enlaces abajo). Estos SDKs
> evolucionan rápido.

## Pruebas

No hace falta tener dos dispositivos físicos para validar la capa P2P — `scripts/`
levanta varias instancias locales dentro del mismo proceso:

```bash
node scripts/test-p2p-local.js        # 2 peers, chat P2P
node scripts/test-pool-sync.js        # un peer que se une tarde sincroniza la quiniela
node scripts/test-stress-peers.js 12  # N peers en la misma sala (default 12)
node scripts/test-ai-commentator.js   # comentarista QVAC (requiere runtime Bare/Pear, ver abajo)
```

## Solución de problemas

- **La malla no conecta / "0 peers" para siempre**: revisa que el tráfico UDP
  saliente no esté bloqueado (firewall, VPN, sandbox corporativo). Hyperswarm
  necesita UDP para el DHT; TCP/HTTPS funcionando no es suficiente.
- **Un peer recién conectado no recibe el primer mensaje**: la conexión puede
  tardar ~1-3s en estabilizarse (hole-punching). El sync de estado de la
  quiniela ya reintenta con backoff por esto; para tus propios mensajes,
  no asumas entrega instantánea apenas dispara `onPeerJoin`.
- **El comentarista responde `[Stub] ...` en vez de texto generado**: el SDK de
  QVAC carga sus plugins nativos (`llamacpp-completion`, etc.) dentro del
  runtime Bare/Pear — correr con `node` en vez de `pear run --dev .` hace que
  el worker no arranque y cae al stub de respaldo (funciona como está
  diseñado, pero no es inferencia real).

## Estado actual (roadmap por rondas del hackathon)

- [x] **Ronda X** — andamiaje del repo, estructura y stubs comentados.
- [x] **Octavos** — P2P real (Hyperswarm) + comentarista QVAC on-device, verificado con `scripts/test-p2p-local.js`.
- [x] **Cuartos** — reacciones a jugadas, tablón de predicciones, traducción de voz on-device, UI desktop completa. Video de 3 min pendiente de grabar (ver `demo/guion.md`).
- [x] **Semis** — WDK integrado: quiniela de USDt con firmas Ed25519, consenso por mayoría, sync de estado para peers que se unen tarde.
- [ ] **Final** — demo en vivo sobre un partido real del Mundial (ver `TAREAS.md` para el detalle de lo que falta).

## Servicios de terceros / divulgacion

- **QVAC SDK** (`@qvac/sdk`) — IA on-device. Sin APIs de IA en la nube.
- **WDK** (`@tetherto/wdk`) — cartera autocustodial; las llaves nunca salen del dispositivo.
- **Pears / Holepunch** (`hyperswarm`, `hypercore`, `autobase`) — transporte P2P.
- No se usan backends propios ni servicios de IA en la nube.

## Documentacion oficial de las plataformas

- Pears (P2P): https://docs.pears.com/
- QVAC (IA local): https://docs.qvac.tether.io/
- WDK (carteras): https://docs.wdk.tether.io/

## Licencia

Apache 2.0 — ver [LICENSE](./LICENSE).

---

*MouFut — Tether Developers Cup 2026.*
