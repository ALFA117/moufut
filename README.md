# ⚽ MouFut

**El compañero de partido que funciona sin servidor central.**

> *El partido pasa, no la conexión.*

MouFut conecta a la hinchada de alrededor por una **malla peer-to-peer** (sin servidor),
narra y traduce el partido con **IA que corre en tu propio teléfono** (sin nube), y
liquida la **quiniela del grupo en USDt** sin intermediarios. Pensado para estadios
llenos y bares a reventar durante el Mundial, donde la señal celular se satura.

Proyecto para la **Tether Developers Cup**.
Pista: **QVAC (IA local)**, apoyada en **Pears (P2P)** y **WDK (carteras)**.

🔗 **Página de presentación:** https://moufut.vercel.app *(landing estática — MouFut en sí es una app de escritorio P2P, no un sitio web; ver "Instalación paso a paso" abajo)*

---

## Por qué MouFut

En un estadio lleno la red celular se satura y casi todas las apps de fútbol mueren
porque dependen de un backend inalcanzable. MouFut vive justo ahí: no depende de un
servidor propio que se pueda caer, saturar o censurar.

- **Sin servidor central, resistente a censura** gracias a la malla P2P de Pears — por
  defecto el descubrimiento de peers usa la DHT pública de Hyperswarm, que sí
  necesita algo de conexión. Para el caso de uso real de un estadio o bar sin señal,
  MouFut también soporta un **modo LAN 100% sin internet**: un dispositivo levanta su
  propio nodo bootstrap de HyperDHT en la red local y los demás se conectan ahí en vez
  de a internet (ver "Paso 6b" más abajo).
- **Privado por diseño**: la IA corre en el dispositivo (QVAC). Tus datos nunca salen.
- **Dinero entre amigos sin intermediarios**: quinielas autocustodiales en USDt (WDK).

## Las tres capas

| Capa | Stack de Tether | Qué hace |
|------|-----------------|----------|
| **P2P** | Pears (Holepunch) | Descubrimiento de peers, chat de hinchada, reacciones a las jugadas, tablón de predicciones. Sin servidor. |
| **IA** | QVAC SDK | Comentarista/analista táctico y **traducción de voz en vivo**, todo **on-device**. |
| **Dinero** | WDK | Cartera autocustodial y quiniela en USDt liquidada peer-to-peer. |

> **Regla de la pista QVAC:** toda la IA (inferencia, voz, traducción) corre en el
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
│ tablón         │ traductor      │ quiniela USDt  │
└───────────────┴───────────────┴───────────────┘
     Todo corre en el teléfono. Sin backend propio.
```

## Estructura del repo

```
moufut/
├── app.js                 # entry point legacy (CLI/Bare, no lo usa la UI desktop)
├── package.json
├── qvac.config.json        # plugins nativos de QVAC (completion, whisper, NMT)
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

- **Node.js** 18+ (se probó con Node 22) — verifica con `node -v`.
- **npm** (viene con Node).
- **Pears / Bare runtime** — se instala en el Paso 1 de abajo. Doc oficial: https://docs.pears.com/
- Salida **UDP** sin bloquear en tu red/firewall — Hyperswarm necesita UDP para el DHT (ver "Solución de problemas" si la malla no conecta).
- Dos dispositivos (o dos terminales en la misma máquina) si quieres probar la malla P2P con más de un peer.
- ~1–2 GB libres de disco para los modelos de IA de QVAC (se descargan la primera vez que arranca la app).

---

## Instalación paso a paso

Sigue los pasos en orden. Cada uno indica qué deberías ver si salió bien, y a
qué sección de "Solución de problemas" saltar si no.

### Paso 1 — Instalar el runtime Pear (una sola vez por máquina)

```bash
npm install -g pear
pear --version
```

Debería imprimir un número de versión. Si el comando `pear` no se reconoce
después de instalarlo, cierra y vuelve a abrir la terminal (o revisa que la
carpeta global de npm esté en tu `PATH`).

### Paso 2 — Obtener el código

**Opción A — con git:**

```bash
git clone https://github.com/ALFA117/moufut.git
cd moufut
```

**Opción B — sin git:** descarga el [ZIP del código](https://github.com/ALFA117/moufut/archive/refs/heads/master.zip),
descomprímelo y abre una terminal dentro de esa carpeta.

### Paso 3 — Instalar dependencias

```bash
npm install
```

Esto instala Hyperswarm/Hypercore (P2P), `@qvac/sdk` (IA) y `@tetherto/wdk`
+ `wdk-wallet-evm` (cartera). Puede tardar unos minutos la primera vez porque
`@qvac/sdk` trae binarios nativos.

> Si falla resolviendo `@qvac/sdk` o `@tetherto/wdk`, instala cada uno por
> separado con `@latest` (`npm install @qvac/sdk@latest`) — estos SDKs siguen
> en beta y cambian de versión seguido.

### Paso 4 — Arrancar la app

```bash
npm start
# equivalente a: pear run --dev .
```

Debería abrirse una ventana de escritorio con la interfaz de MouFut. La
primera vez verás una barra de progreso ("Descargando modelo... X%") mientras
QVAC baja los modelos de IA (comentarista, Whisper, traductor) — es normal
que tarde uno o dos minutos según tu conexión. Cuando termine, el estado de
IA debe decir **"Listo"**.

Si la ventana no abre o se queda en blanco, revisa "El comentarista responde
`[Stub] ...`" en Solución de problemas — a veces indica que el runtime no
cargó bien los plugins nativos.

### Paso 5 — Crear o importar tu cartera

Dentro de la app, ve a la pestaña de **Cartera** y pulsa **"Nueva cartera"**.

> ℹ️ **Por defecto la cartera arranca en MODO DEMO — no toca fondos reales.**
> La dirección que ves se deriva de verdad de tu frase semilla BIP-39 (para
> que la demo se vea auténtica), pero el balance y cualquier envío son
> **simulados**: no hay conexión a Ethereum mainnet ni a ningún RPC. La frase
> semilla (12 palabras) se genera con `bip39` y se guarda solo en el
> `localStorage` de tu dispositivo — nunca sale de ahí ni se comparte con
> nadie, pero en modo demo tampoco protege fondos reales porque no los hay.
>
> **Solo si sabes lo que haces:** puedes activar el modo mainnet real desde
> la consola de devtools de Pear con
> `localStorage.setItem('moufut_real_mainnet', '1')` y recargando la ventana.
> Ahí sí la cartera opera contra el contrato real de USDt (ERC-20) en
> Ethereum mainnet vía un RPC público — usa montos pequeños y bajo tu propio
> riesgo; no es una testnet.

Si ya tienes una cartera con una frase semilla existente, usa **"Importar
cartera"** en vez de crear una nueva.

### Paso 6 — Unirte a una sala P2P

Cada sala es un código en la URL (`location.hash`). Por defecto todos caen en
`moufut-default`; para una sala privada con tus amigos, arranca con un
nombre propio:

```bash
pear run --dev . #mundial-mx-2026
```

Dentro de la app, el botón **"Copiar código de sala"** copia ese identificador
para que lo compartas. Cualquiera que arranque MouFut con el mismo código de
sala (mismo hash) entra a la misma malla P2P — no hace falta estar en la
misma red local, Hyperswarm los encuentra vía DHT (necesita internet).

### Paso 6b — Modo LAN sin internet (opcional)

Para operar 100% sin internet (modo avión real, útil en un estadio sin señal),
un dispositivo de la sala levanta su propio nodo bootstrap de HyperDHT en la
red local — el mecanismo `DHT.bootstrapper()` documentado en
[docs.pears.com](https://docs.pears.com/reference/building-blocks/hyperdht)
para "redes aisladas o auto-alojadas" — y los demás peers apuntan ahí en vez
de a los nodos públicos de internet.

1. En **un** dispositivo (el "anfitrión" de la sala), con internet apagado o no:

   ```bash
   npm run lan-bootstrap
   ```

   Esto imprime la IP:puerto local, por ejemplo `192.168.1.75:49737`, y la URL
   lista para copiar: `?bootstrap=192.168.1.75:49737#mundial-mx-2026`.

2. En los **demás** dispositivos (misma red Wi-Fi/hotspot, internet apagado),
   arrancá la app agregando ese parámetro a la URL/hash:

   ```bash
   pear run --dev . ?bootstrap=192.168.1.75:49737#mundial-mx-2026
   ```

3. El indicador de conexión muestra **"P2P · LAN sin internet"** en vez de
   "P2P" cuando la sala está usando el bootstrap propio.

Reproducido y verificado con `scripts/test-lan-offline.js` (dos peers se
descubren y mandan un mensaje usando solo un bootstrap aislado en loopback,
sin tocar la DHT pública). Pendiente repetir en dos dispositivos físicos
reales con el internet apagado de verdad (dato del móvil apagado, sin Wi-Fi
con salida a internet) — ver checklist en `TAREAS.md`.

### Paso 7 — Probar con un segundo peer

En otra terminal, otro dispositivo, o incluso otra ventana en la misma
máquina, repite el Paso 4 con el mismo código de sala:

```bash
pear run --dev . #mundial-mx-2026
```

En unos segundos el indicador de conexión debe pasar de "Buscando..." a
**"P2P · 1 peer"**. Prueba mandar un mensaje de chat o una reacción (⚽ GOL,
falta, VAR) — debe aparecer del otro lado casi al instante.

### Paso 8 — Probar la quiniela

Con al menos una cartera creada (Paso 5), ve a la pestaña de **Quiniela**,
ingresa un marcador predicho y un monto en USDt, y pulsa **"Apostar"**. Cada
apuesta se firma con tu identidad Ed25519 y se transmite a todos los peers de
la sala; verás el ✓ verde de "firma verificada" junto a cada participante.
Cuando termine el partido, cualquier peer reporta el marcador final y, si hay
consenso por mayoría, el botón **"Liquidar pozo"** reparte el bote entre
quienes acertaron.

Con esto ya tienes el flujo completo funcionando: P2P + IA + quiniela USDt,
todo sin servidor y sin salir del dispositivo.

---

### Distribución nativa vía Pear (`pear://`)

Pear no genera instaladores tradicionales (`.exe`/`.dmg`) — su forma nativa de
distribuir una app es un link `pear://<key>`, que funciona como un torrent: solo
está disponible mientras alguien lo esté *sembrando* (`pear seed`). Si quieres
publicar MouFut así:

```bash
npm install -g pear
pear touch                                      # genera tu propio link pear://<key>
pear stage --no-pre pear://<tu-key> .           # sube el código a ese link
pear seed pear://<tu-key>                       # déjalo corriendo para que otros puedan instalarlo
```

Quien quiera instalarlo entonces corre `pear run pear://<tu-key>` (con el runtime
Pear ya instalado) y la app se sincroniza directo, sin pasar por GitHub. El
`--no-pre` salta el pre-script de `@qvac/sdk` durante el stage (falla en algunos
entornos de CI/sandbox); quítalo si tu máquina lo soporta.

> Este camino se evaluó como reemplazo del ZIP y se descartó por ahora: el
> stage completo falla con `ASSET_NOT_FOUND` (bug de resolución de rutas de
> `@qvac/sdk` dentro de Pear) y, aunque funcionara, pesaría ~15 GB por
> bundlear binarios nativos de todas las plataformas a la vez. Detalle
> completo en `TAREAS.md`.

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
- **El balance de la cartera se queda en `—`**: en modo demo (el default) el
  balance es simulado y no debería fallar; si igual se queda en `—`, revisa
  que la cartera tenga una dirección (`wallet.address`). Si activaste el modo
  mainnet real (`moufut_real_mainnet`), la app consulta el saldo de USDt vía
  un RPC público (`eth.llamarpc.com`) y ese `—` puede ser el RPC caído o lento.
- **Perdiste la frase semilla**: no hay forma de recuperarla — no queda
  guardada en ningún servidor, solo en el `localStorage` del dispositivo
  donde se creó. Crea una cartera nueva y, si tenía fondos reales, muévelos
  antes de perder el acceso.

## Estado actual (roadmap por rondas del hackathon)

- [x] **Ronda X** — andamiaje del repo, estructura y stubs comentados.
- [x] **Octavos** — P2P real (Hyperswarm) + comentarista QVAC on-device, verificado con `scripts/test-p2p-local.js`.
- [x] **Cuartos** — reacciones a jugadas, tablón de predicciones, traducción de voz on-device, UI desktop completa.
- [x] **Semis** — WDK integrado: quiniela de USDt con firmas Ed25519, consenso por mayoría, sync de estado para peers que se unen tarde.
- [ ] **Final** — demo en vivo sobre un partido real del Mundial. Ya resuelto: mensaje "sin internet" corregido para no contradecir la DHT, cartera en modo demo por defecto, imagen de preview (OG) a 1200×630, placeholder de video en la landing. Falta: probar en 2+ dispositivos físicos, probar con red congestionada/sin internet, grabar el video final (<3 min, ver `demo/guion.md`), y publicar el release `v1.0` en GitHub. Ver `TAREAS.md` para el detalle completo.

## Servicios de terceros / divulgación

- **QVAC SDK** (`@qvac/sdk`) — IA on-device. Sin APIs de IA en la nube.
- **WDK** (`@tetherto/wdk`) — cartera autocustodial; las llaves nunca salen del dispositivo. Por defecto corre en **modo demo** (dirección real, balance/envíos simulados); el modo mainnet real (opt-in, ver Paso 5) opera con el contrato oficial de USDt en Ethereum mainnet y un RPC público (`eth.llamarpc.com`) — no es una testnet.
- **Pears / Holepunch** (`hyperswarm`, `hypercore`, `autobase`) — transporte P2P.
- No se usan backends propios ni servicios de IA en la nube.

## Documentación oficial de las plataformas

- Pears (P2P): https://docs.pears.com/
- QVAC (IA local): https://docs.qvac.tether.io/
- WDK (carteras): https://docs.wdk.tether.io/

## Licencia

Apache 2.0 — ver [LICENSE](./LICENSE).

---

*MouFut — Tether Developers Cup 2026.*
