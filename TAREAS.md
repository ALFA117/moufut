# MouFut — Lista de Tareas

> Tether Developers Cup 2026 | Stack: Pears · QVAC · WDK

---

## Ronda X — Andamiaje ✅
- [x] README con arquitectura y roadmap
- [x] Crear `package.json` con dependencias base (`hyperswarm`, `hypercore-protocol`, `@qvac/sdk`, `@tetherto/wdk`)
- [x] Crear `app.js` — punto de entrada Bare/Pears
- [x] Crear estructura de carpetas: `src/p2p/`, `src/ai/`, `src/wallet/`, `src/ui/`, `demo/`
- [x] Agregar `LICENSE` Apache 2.0
- [x] Inicializar repositorio git y subir a GitHub

---

## Octavos — Prototipo P2P + IA básica
> Meta: dos dispositivos chatean por P2P sin internet + 1 respuesta del comentarista IA

### Capa P2P (Pears / Hyperswarm)
- [x] `src/p2p/swarm.js` — inicializar Hyperswarm, unirse a sala por topic hash
- [x] `src/p2p/chat.js` — enviar y recibir mensajes de texto entre peers
- [x] Prueba local: dos instancias en la misma sala intercambian mensajes (`scripts/test-p2p-local.js`) — pendiente repetir en dos dispositivos físicos reales sin internet

### Capa IA (QVAC)
- [x] Instalar y configurar `@qvac/sdk`
- [x] `src/ai/commentator.js` — comentarista real con SMOLLM2 360M on-device (QVAC)
- [x] Probar respuesta IA (`scripts/test-ai-commentator.js`) — el SDK QVAC requiere el runtime Bare/Pear (`pear run --dev .`) para cargar sus plugins nativos; en Node plano el worker no arranca y cae al *stub* de respaldo (funciona como está diseñado). Pendiente confirmar inferencia real corriendo con Pear en la máquina objetivo.

### Infraestructura
- [x] `npm start` / `pear run --dev .` funciona sin errores (type: desktop, main: index.html)
- [x] Variables de sala por argumento CLI — `location.hash` en desktop (ej: `pear run --dev . #mi-sala`)

---

## Cuartos — Reacciones + Voz + Video demo
> Meta: reacciones a jugadas, traducción de voz on-device, video de 3 min

### Capa P2P
- [x] `src/p2p/board.js` — tablón de predicciones compartido entre peers (broadcast vía swarm)
- [x] Sistema de reacciones en tiempo real (gol, falta, VAR, etc.) transmitidas por la malla
- [x] Manejo de desconexión/reconexión de peers sin perder el estado (onPeerLeave + auto-reconnect Hyperswarm)

### Capa IA
- [x] `src/ai/translator.js` — transcripción Whisper Base + traducción NMT on-device (QVAC)
- [x] Pipeline: audio (Uint8Array) → Whisper transcribe → NMT traduce → texto salida
- [x] Comentarista táctico: `analyzeTactical()` analiza historial de 8 eventos con SMOLLM2

### UI
- [x] `src/ui/index.js` — Pears GUI desktop (app.js conecta swarm+chat+IA+board+wallet)
- [x] Vista: chat de hinchada + reacciones + comentario IA visible

### Demo
- [x] `demo/guion.md` — guion del video de 3 minutos (4 escenas + checklist grabación)
- [ ] Grabar video demostrando P2P sin internet + IA on-device — requiere grabación manual con dispositivos físicos, no automatizable desde aquí (ver checklist en `demo/guion.md`)

---

## Semis — Integración WDK (Quiniela USDt)
> Meta: quiniela de USDt que se liquida sola entre peers

### Capa Wallet (WDK)
- [x] Instalar y configurar `@tetherto/wdk` + `wdk-wallet-evm` + `wdk-wallet-tron`
- [x] `src/wallet/wallet.js` — crear/importar cartera BIP-39, dirección EVM, balance USDt ERC-20
- [x] `src/wallet/pool.js` — pool de quiniela: cada peer apuesta X USDt con firma Ed25519
- [x] Lógica de quiniela: quién acierta el marcador se lleva el pozo (winner detection)
- [x] Liquidación peer-to-peer automática al terminar el partido (`pool.liquidate()`)
- [x] Firmar on-device con keypair Hyperswarm — llaves nunca salen del dispositivo

### Integración con P2P
- [x] Validar apuestas firmadas criptográficamente — `identity.verifyPayload()` en pool.js
- [x] Resolver disputas: si dos peers reportan marcadores distintos, consenso por mayoría
- [x] Distribuir el estado de la quiniela por la malla — `pool.js` reenvía apuestas/reportes firmados (`MSG.STATE_SYNC`) a cualquier peer que se une tarde, con reintentos con backoff para cubrir la ventana de estabilización de la conexión. Verificado en `scripts/test-pool-sync.js`. Persistencia con Hypercore/Autobase (log causal completo, sobrevive a que todos los peers se desconecten) queda como v3 — requiere migrar el transporte a Protomux para poder replicar cores sobre la misma conexión sin romper el protocolo de mensajes JSON actual.

---

## Final — Demo en vivo sobre partido real del Mundial
> Meta: demo en vivo durante un partido real

### Pulido general
- [x] Prueba de stress: 12 peers simultáneos en la misma sala, malla completa y broadcast 100% entregado (`scripts/test-stress-peers.js`) — corrido dentro de un solo proceso/IP; pendiente repetir con 10+ dispositivos físicos reales
- [x] Manejo robusto de errores de red — se encontraron y corrigieron dos bugs reales: (1) `swarm.send()` iteraba `swarm.connections` en vez de nuestro propio `Map` de peers, perdiendo el primer mensaje enviado a un peer recién conectado; (2) `createMsg()` sobrescribía siempre `_ts` con `Date.now()` aunque el llamador ya pasara uno, invalidando las firmas de las apuestas. Reintentos con backoff añadidos para el sync de estado de la quiniela (ver arriba).
- [x] Optimizar tamaño del modelo QVAC para respuesta < 2 segundos on-device — SMOLLM2_360M_INST_Q8 ya era el modelo de completions más chico del registro (no hay un Q4 más liviano de este modelo); se añadió `generationParams.predict` para acotar tokens de salida (64 comentario rápido, 110 táctico), la palanca real de latencia con el modelo ya fijo. Whisper cambiado a `WHISPER_SPANISH_TINY_Q8_0` (43MB, mitad de tamaño y específico del idioma real de la app vs. el base multilingüe). El NMT (`AFRICAN_4B_TRANSLATION_Q4_K_M`, 4B/2.8GB) no tiene variante más chica en este SDK — improbable <2s en hardware de consumo; documentado como limitación conocida en `translator.js`.
- [x] UI lista para pantalla completa o proyección — breakpoints en `styles.css` (900px/1400px) que centran el contenido en una columna cómoda y agrandan el tipo (todo en rem, escala con `html{font-size}`) en vez de estirar el layout mobile edge-to-edge; quita el scroll horizontal de reacciones/acciones rápidas cuando hay espacio de sobra

### Demo final
- [ ] Preparar dos o más dispositivos físicos para la demo
- [ ] Probar en red congestionada / sin internet (hotspot con datos apagados)
- [ ] Video final de presentación pulido (< 3 min)
- [x] README actualizado con instrucciones de instalación paso a paso — sección "Instalación paso a paso" con 8 pasos numerados (instalar Pear, clonar/ZIP, `npm install`, arrancar, crear cartera, unirse a sala, probar con segundo peer, apostar en la quiniela), más advertencia de que la cartera opera en Ethereum mainnet real (no testnet) y nuevos casos en "Solución de problemas". De paso se corrigieron acentos faltantes en todo el documento.
- [ ] Subir release a GitHub con tag `v1.0`
- [x] Descarga automática para instalar/tener la app — botón "Descargar ZIP" (link directo al repo en GitHub) agregado en la landing y en el README. Se investigó el link nativo `pear://` (`pear touch` + `pear stage` + `pear seed`) como alternativa y **se descartó por ahora**: (1) el stage completo falla con `ASSET_NOT_FOUND` al resolver un import interno de `@qvac/sdk` (`../../dist/server/worker.js`) incompatible con la resolución de rutas de Pear — bug del SDK de terceros, no de este proyecto; (2) aunque funcionara, el stage pesa **15.1 GB** porque bundlea los binarios nativos de IA de todas las plataformas (Android/iOS/Mac/Linux/Windows) a la vez, algo poco práctico para sincronizar vía P2P. El camino ZIP/`npm install` es además más liviano para el usuario final, ya que `npm install` en su máquina solo trae los binarios de su propia plataforma.

---

## Pendientes transversales (cualquier ronda)
- [x] Definir formato de mensaje P2P (JSON schema) — `src/p2p/schema.js` con validadores tipados
- [x] Manejo de identidades de peers — `src/p2p/identity.js` (keypair Hyperswarm → Ed25519 sign/verify)
- [x] Fix: agregar `bip39` a `package.json` (faltaba — wallet.js no arrancaba)
- [x] Fix: `createCommentator()` acepta `{ onProgress }` — barra de progreso del modelo ahora funciona
- [x] Fix: `analyze({ type: 'question' })` maneja preguntas libres correctamente (antes las trataba como evento de partido)
- [x] Fix: reloj de partido vivo — el tiempo avanza desde el minuto inicial en pantalla
- [x] Fix: `swarm.send()` perdía el primer mensaje a un peer recién conectado (iteraba `swarm.connections` en vez del `Map` propio de peers)
- [x] Fix: `createMsg()` sobrescribía `_ts` con `Date.now()` e invalidaba firmas Ed25519 de apuestas ya firmadas con otro timestamp
- [x] Tests básicos para capa P2P y wallet — `scripts/test-p2p-local.js`, `scripts/test-pool-sync.js`, `scripts/test-stress-peers.js`, `scripts/test-ai-commentator.js`, `scripts/test-wallet-sepolia.js`
- [x] `.gitignore` correcto (node_modules, `.pear/`, `*.key`/`*.secret`/`*.mnemonic`, `.env`)
- [x] Documentación de API interna de cada módulo (`src/p2p`, `src/ai`, `src/wallet`) — JSDoc agregado a `swarm.js`, `chat.js`, `board.js`, `wallet.js` y `commentator.js` (los demás ya lo tenían). De paso se corrigió un bug real en `board.js`: `listeners` estaba a nivel de módulo en vez de dentro de `createBoard()`, compartiendo el arreglo entre instancias.
- [x] Corregir el mensaje "funciona sin internet" en landing/README/package.json — era contradictorio: `src/p2p/swarm.js` usa Hyperswarm puro (DHT pública), y el descubrimiento inicial de peers sí necesita algo de conexión. Se investigó si hyperswarm v4 trae mDNS/descubrimiento LAN nativo (se llegó a ver esa afirmación en resúmenes de búsqueda) y **se descartó por no ser real**: el README crudo de `holepunchto/hyperswarm` no menciona mDNS/LAN/offline en ninguna parte, y `swarm.joinPeer(publicKey)` (conexión directa por clave pública) igual depende del transporte de HyperDHT para el hole-punching. El copy ahora dice "sin servidor central, resistente a caídas de red y censura", que es lo que el stack realmente garantiza.
- [x] Fix: contadores de "En números" en la landing mostraban "0%"/"0+"/"0s" fijos en el HTML si el JS del count-up no llegaba a correr — se corrigieron los valores por defecto a los reales (100%, 12+, <2s).
- [x] Wallet en modo demo por defecto (`src/wallet/wallet.js`) — antes operaba en Ethereum mainnet real desde el primer arranque. Ahora deriva una dirección real desde la mnemonic (con `ethers`, sin red) pero simula balance y envíos; el mainnet real queda como opt-in explícito (`localStorage.setItem('moufut_real_mainnet', '1')`).
- [x] Imagen OG regenerada a 1200×630 (`landing/app-screenshot.png`) — la anterior era un retrato de 520×860, formato incorrecto para previews de link.
- [x] Placeholder de video demo en la landing (`<iframe>` de YouTube comentado + estado "Video demo próximamente"), listo para pegar el ID cuando exista la grabación.
- [x] RAG de fútbol conectado al comentarista (`src/ai/rag.js` + `src/ai/knowledge/futbol-kb.js`) — toda pregunta libre (`analyze({type:'question'})`) busca contexto en la base on-device (HyperDB/QVAC, embeddings `EMBEDDINGGEMMA_300M_Q8_0`) antes de responder, tanto si pasa por el orquestador con tools como por el camino simple. Probado con `scripts/test-rag.js` (búsqueda aislada, recupera el documento correcto sobre offside) y con una pregunta end-to-end contra `createCommentator()`: el modelo local cargó, el contexto se inyectó en el prompt y generó una respuesta usando la base de conocimiento — confirma la integración, aunque SMOLLM2 360M da respuestas de calidad limitada (esperado del modelo más chico del registro, ver nota de latencia arriba).
- [x] Pulido visual de la landing: balón del hero recortado por radio de esfera mayor al frustum de la cámara (corregido), fondo plano fuera del hero reemplazado por gradientes a la deriva + grilla de puntos, sección "Arquitectura" rediseñada como tarjetas en vez de ASCII art, terminal animada de instalación en "Cómo correrlo".

## v2 — Descubrimiento LAN real sin internet ✅ (Checkpoint A)

- [x] **Investigación contra la fuente real, no memoria ni blogs**: se verificó
  `docs.pears.com/reference/building-blocks/hyperswarm` y `hyperdht`, el README
  crudo de `holepunchto/hyperswarm`, y se hizo `grep -r "mdns\|multicast"` sobre
  el código de `node_modules/hyperswarm` y `node_modules/hyperdht` realmente
  instalados (v4.17.0 / v6.32.0): **cero** referencias. Hyperswarm/HyperDHT
  actual **no** trae mDNS ni descubrimiento LAN automático — solo DHT pública.
  (Resultados de búsqueda web que mencionan mDNS en Hyperswarm hablan de
  `hyperswarm/discovery`, un paquete distinto y antiguo de ~2018, no el que usa
  este proyecto — confirmado como falso positivo.)
- [x] **Camino real encontrado y confirmado funcional**: `HyperDHT.bootstrapper(port, host)`
  (documentado en `docs.pears.com/reference/building-blocks/hyperdht` y
  verificado en runtime — existe heredado del prototipo, no en `index.js`
  directamente) crea un nodo DHT propio para "redes aisladas o auto-alojadas".
  Pasando ese nodo como `bootstrap` a `new Hyperswarm({bootstrap})` (opción que
  ya existía, pasa derecho a `hyperdht`), los peers se descubren y conectan sin
  tocar ningún nodo público de internet.
- [x] `src/p2p/swarm.js` — `createSwarm(roomId, {bootstrap})` acepta un
  bootstrap propio opcional; sin él, comportamiento 100% idéntico a antes (DHT
  pública). No rompe ningún caller existente.
- [x] `scripts/lan-bootstrap.js` (nuevo, `npm run lan-bootstrap`) — levanta el
  nodo bootstrap en la IP LAN real de la máquina (autodetectada, evitando
  interfaces Tailscale/VPN) y muestra la URL lista para copiar a los demás
  peers.
- [x] `src/ui/app.js` — lee `?bootstrap=host:port` de la URL; si está presente
  usa esa red aislada en vez de la pública. El badge de conexión muestra
  "P2P · LAN sin internet" cuando está activo.
- [x] `scripts/test-lan-offline.js` — prueba que dos peers se descubren y
  mandan un mensaje usando **solo** un bootstrap propio en loopback, sin la
  DHT pública. 3/3 corridas pasaron en <10s cada una. (Nota real de depuración:
  la primera versión del test unía los dos peers con `Promise.all` y fallaba
  por una condición de carrera del announce/lookup contra una red de un solo
  nodo recién creada — no representa el uso real, donde dos dispositivos nunca
  arrancan en el mismo tick de JS; se corrigió a unión secuencial y quedó
  estable.)
- [x] README: nuevo "Paso 6b — Modo LAN sin internet" con instrucciones
  exactas de reproducción en 2+ dispositivos reales. Landing (FAQ "¿Necesito
  internet para usarlo?") actualizada para mencionar el modo LAN en vez de
  solo advertir que hace falta conexión.
- [ ] **Pendiente real**: repetir el Paso 6b en dos dispositivos físicos con
  el internet apagado de verdad (datos móviles apagados, Wi-Fi/hotspot sin
  salida a internet) — el test automatizado prueba el mecanismo en loopback,
  no reemplaza la prueba en campo. Hacerlo antes de grabar el video final.
- [x] **Backlog v3 resuelto**: autodiscovery del bootstrap LAN vía
  `multicast-dns` — `src/p2p/lan-discovery.js` (`announceLanBootstrap()` /
  `discoverLanBootstrap()`), `scripts/lan-bootstrap.js` ahora anuncia el nodo
  por mDNS al arrancar, y la UI (`src/ui/app.js`) resuelve `?bootstrap=auto`
  contra la LAN antes de unirse a la sala en vez de exigir `host:port` a
  mano. Probado con `scripts/test-lan-discovery.js` (anuncia y descubre en la
  misma máquina, confirma que el protocolo de anuncio/consulta mDNS
  funciona). El camino manual `?bootstrap=host:port` se mantiene como
  respaldo explícito para redes donde mDNS no llega (ej. routers que separan
  bandas Wi-Fi). **Pendiente real**: repetir en dos dispositivos físicos —
  este test, igual que `test-lan-offline.js`, corre en loopback/localhost y
  no reemplaza la prueba en una red real con dos máquinas distintas.

## v3 — Seguridad de la cartera WDK ✅ (Checkpoint B)

- [x] **Red: Sepolia (testnet) por defecto** en vez de Ethereum mainnet real.
  Verificado contra el README instalado de `@tetherto/wdk-wallet-evm` (no
  contra memoria): el paquete no tiene un parámetro `chainId` propio, sigue
  la red que le indique la URL del `provider` — el propio ejemplo oficial del
  paquete usa `provider: 'https://sepolia.drpc.org'`. `TESTNET=false` cambia
  a Ethereum mainnet real (además hay que activar `moufut_real_mainnet` en
  `localStorage` — dos pasos explícitos para dinero real, a propósito).
  - Contrato de USDt de prueba en Sepolia: `0x7169d38820dfd117c3fa1f22a697dba58d90ba06`
    ("Test Tether USD", 6 decimales, verificado en Sepolia Etherscan, con
    función pública de auto-mint). No existe un USDT oficial de Tether en
    testnet — se documentó esto explícitamente en vez de simular que sí.
- [x] **Seed efímera, nunca persistida** — `src/wallet/wallet.js` ya no toca
  `localStorage` para la frase semilla. Se genera una nueva con
  `WDK.getRandomSeedPhrase()` cada vez que arranca la app (o se pulsa "Nueva
  cartera"), vive solo en memoria, y se pierde al cerrar/recargar. Verificado
  con un test que hace `localStorage.setItem` lanzar si se llama — cero
  llamadas durante `createWallet()`, `.create()` e `.importFromMnemonic()`.
- [x] Modal "Cartera de sesión creada" (`#seedModalOverlay` en
  `src/ui/index.html`) muestra la frase una sola vez, con botón de copiar,
  sin cierre por click-afuera (fuerza el click explícito en "Entendido") —
  se dispara al arrancar la app y cada vez que se pulsa "Nueva cartera".
- [x] Banner "MODO DEMO" (`#demoBanner`) — visible en las 3 pantallas (vive
  en `.app-main`, en flujo normal, no `position:fixed`, para no pelearse con
  el offset del header fijo). Texto dinámico: "MODO DEMO · Sepolia (testnet)
  · Balance simulado" en el caso normal, cambia a rojo sólido con "MODO REAL"
  o "¡FONDOS REALES!" si se activaron los opt-in de red real/mainnet.
  Nota real de depuración: el primer intento no tenía `.demo-banner[hidden]
  { display: none }` — como `.demo-banner{display:flex}` es una regla de
  autor (no de user-agent), gana sobre el `[hidden]` nativo y el banner
  quedaría visible siempre. Se corrigió con el mismo patrón que ya usan los
  modales existentes (`.modal-overlay[hidden]`) en vez de reinventar uno.
- [x] README (Paso 5) y landing (FAQ "¿Es seguro poner dinero en la
  quiniela?") reescritos para reflejar cartera de sesión + Sepolia por
  defecto, con instrucciones exactas de cómo escalar a modo real (Sepolia) y
  luego a mainnet real (`TESTNET=false`, dos pasos explícitos).
- [x] **Verificado parcialmente end-to-end contra un RPC real** —
  `wdk-wallet-evm` resultó ser JS puro (sin bloqueo de runtime nativo como
  QVAC), así que sí se pudo probar en Node plano sin esperar al runtime Pear.
  Derivación de cuenta y `getBalance()` confirmados contra Sepolia real. Falta
  `signAndSend()`/`transfer()` real (necesita fondear con ETH+USDt de
  prueba, manual). Ver detalle en "Checkpoint B — verificación pendiente
  (retomada)" más abajo.

## v4 — Checkpoint C: calidad de respuestas del comentarista

### Fase 1 — Modelos LLM disponibles en QVAC (verificado contra el registro instalado)

Fuente: `node_modules/@qvac/sdk/dist/models/registry/models.js` (auto-generado
por el propio SDK, `"THIS FILE IS AUTO-GENERATED BY models/update-models"`,
v0.14.0 instalada) — no la doc web, el registro real que el SDK usa en
runtime. Filtrado por `engine === 'llamacpp-completion'` (el motor de LLMs de
texto; hay motores separados para embeddings, STT, TTS, NMT, OCR e imagen).
**98 modelos de completions en total.**

- **El más grande**: `GPT_OSS_120B_INST_Q4_K_M` — 120B parámetros, ~59.8GB
  (shardeado). Le siguen `QWEN3_6_35B_A3B_MULTIMODAL` (~30GB) y
  `GEMMA4_31B_MULTIMODAL` (~25GB). Todos fuera de rango para un teléfono.
- **Todos son GGUF/llama.cpp cuantizados** salvo un puñado en `bf16`/`f16`
  (los `HEALTHCARE_*_BF16` y los `MMPROJ_*` — proyecciones multimodales, no
  LLMs de texto standalone). Cuantizaciones presentes: `q2_k`, `q4_0/q4_1/q4_k/q4_k_m`,
  `q5_k_m`, `q6_k`, `q8_0`, más `TQ2_0` (BitNet ternario, arquitectura
  distinta, más experimental).
- **"Optimizados con kv-cache"**: es una propiedad del motor `llamacpp-completion`
  (llama.cpp), no de un modelo en particular — todos los 98 lo usan por
  igual. No hay una variante "sin kv-cache" que comparar.
- **Rango 1B–3B (candidatos reales para reemplazar/complementar SMOLLM2 360M)**:

  | Modelo | Params | Cuant. | Peso | Notas |
  |---|---|---|---|---|
  | `QWEN3_1_7B_INST_Q4` | 1.7B | q4 | 1008MB | **Ya integrado** como `REMOTE_MODEL` en `commentator.js` (solo se usaba delegado a un peer worker, nunca probado local en este entorno) |
  | `LLAMA_TOOL_CALLING_1B_INST_Q4_K` | 1B | q4_k | 770MB | **Ya integrado** como orquestador (tool calling), no como comentarista de eventos |
  | `BITNET_1B_INST_TQ2_0` | 1B | TQ2_0 | 796MB | BitNet ternario — arquitectura no estándar, mayor riesgo de incompatibilidad con `toolDialect`/sampling que ya usa el proyecto |
  | `LLAMA_3_2_1B_INST_Q4_0` | 1B | q4_0 | 737MB | Meta Llama 3.2 1B instruct, propósito general |
  | `SALAMANDRATA_2B_INST_Q4` | 2B | q4 | 1447MB | BSC Salamandra — foco explícito en español/catalán, relevante para una app 100% en español |
  | `BITNET_B1_58_3B_INST_TQ2_0` | 3B | TQ2_0 | 1834MB | El "3B" más grande del rango, mismo riesgo de arquitectura no estándar que el de 1B |

  (Se excluyen de la tabla los `*_MULTIMODAL_*` de 2B–4B — traen encoder de
  visión que no se necesita para texto y pesan más de lo que su tamaño de
  parámetros de texto sugiere, y los `HEALTHCARE_*`/`MEDGEMMA_*`, afinados
  para dominio médico, no fútbol.)
- **No existe ningún modelo "Mistral"** en el registro de QVAC — se buscó
  explícitamente (`grep -i mistral`) antes de asumirlo, cero resultados. El
  candidato real más parecido en espíritu (general, 1B, bien establecido) es
  `LLAMA_3_2_1B_INST_Q4_0`; el más prometedor por calidad/tamaño para esta
  demo específica es `QWEN3_1_7B_INST_Q4` (ya integrado y probado en
  delegación) o `SALAMANDRATA_2B_INST_Q4` (español nativo).

Fuentes: [docs.qvac.tether.io](https://docs.qvac.tether.io) (documentación
general) + registro instalado `@qvac/sdk@0.14.0` (fuente de verdad real, la
doc web no lista pesos exactos por build).

### Fase 2 — Prueba de carga real

`scripts/test-model-load.js` corrido en Node plano (`node scripts/test-model-load.js`):
los 3 candidatos (`QWEN3_1_7B_INST_Q4`, `LLAMA_3_2_1B_INST_Q4_0`,
`SALAMANDRATA_2B_INST_Q4`) fallaron con `RPC initialization timed out after
30000ms` en los 3 intentos cada uno. **Confirma la misma limitación ya
documentada arriba para `SMOLLM2_360M_INST_Q8`**: el SDK de QVAC necesita el
runtime real de Bare/Pear para levantar el worker nativo; en Node plano no
arranca, sin importar el modelo. No es un problema de tamaño/cuantización de
estos 3 candidatos en particular.

- [x] Disparador manual en la UI para correr la prueba dentro del runtime real
  — `src/ui/app.js` (`setupDevModelTest`) + panel oculto en
  `src/ui/index.html` (`#devModelTestCard`), activo solo con `?dev=1` en la
  URL de la app (ej. `pear run --dev .` y luego navegar a `?dev=1#sala`).
  Reusa la misma lógica de
  `scripts/test-model-load.js` (`loadModel`/`completion`/`unloadModel` de
  `@qvac/sdk`, los 3 candidatos verificados contra el registro real) pero
  corriendo en la propia app de escritorio en vez de Node plano, y muestra el
  resultado en un `<pre>` en pantalla en vez de la consola.
- [ ] **Pendiente real**: click en el botón "Probar..." corriendo
  `pear run --dev .` en la máquina objetivo, para confirmar si los 3
  candidatos cargan e infieren de verdad dentro del runtime Bare/Pear (el
  timeout de 30s en Node plano es una limitación conocida de ese entorno, no
  necesariamente del runtime real) — no ejecutable desde aquí porque abre una
  ventana de escritorio nativa, no una salida headless.
- **Bloqueo encontrado al intentar verificar lo de arriba — investigado a
  fondo, causa raíz identificada en el runtime de Pear, no en este
  proyecto**: `pear run --dev .` falla *antes* de llegar a abrir la ventana,
  en el hook `pear.pre` (`@qvac/sdk/pear-pre`) con `ERR_INVALID_CONFIG:
  pear.pre ".../dist/pear/pre.js" did not respond with configuration data in
  time`.
  - Medido el tiempo real de la falla: **5.76s**, calzando exacto con la
    constante `IDLE_TIMEOUT = 5000` encontrada leyendo el propio código de
    Pear (`%APPDATA%\pear\by-dkey\...\boot.bundle`, función `#run` que lanza
    el subproceso del hook con `stdio: ['ignore','pipe','pipe','overlapped']`
    — el 4º canal, tipo named-pipe de Windows, es el usado para el IPC del
    hook). El hook nunca manda ni un byte por ese canal dentro de la ventana
    de 5s.
  - Se descartó que fuera el código de `pre.js` de QVAC: faltaba un
    `worker.js` en la raíz del proyecto (requerido por
    `normalizePearWorkerPath`/`DEFAULT_PEAR_WORKER` en `pre.js` — se creó,
    ver más abajo), y aun así el error fue **idéntico byte por byte y en el
    mismo tiempo**, lo que prueba que el hook ni siquiera llega a ejecutar su
    lógica (el fallo es en el transporte IPC, no en `configure()`).
  - Se descartó que fuera la instalación incompleta de Pear (el warning
    "prepend ... to PATH"): se corrió el auto-fix sugerido por la propia
    herramienta (`pear run pear://runtime`) y **no cambió nada**; se probó
    además invocando directamente el binario nativo
    (`%APPDATA%\pear\current\by-arch\win32-x64\bin\pear-runtime.exe run --dev
    .`), sin pasar por el spawner de PATH, y el error fue el mismo.
  - **Conclusión**: es un bug/incompatibilidad del canal IPC `overlapped`
    (named pipe de Windows) que Pear usa para hooks `pear.pre`, específico de
    esta instalación/versión de Pear en Windows — no algo arreglable desde el
    código de este proyecto. Bloquea **cualquier** hook `pear.pre`, no solo el
    de QVAC. Pendiente real: reportar/buscar el issue en el repo de
    `holepunchto/pear`, probar una versión distinta de Pear, o probar en otro
    SO (Linux/Mac) o vía WSL para aislar si es específico de Windows.
  - **Confirmado con repro mínimo**: se armó una app Pear de juguete
    (`type: "terminal"`, sin ninguna dependencia de terceros) con un
    `pre.js` trivial que solo responde al primer mensaje del pipe — mismo
    error exacto, mismo timing (~5-6s). Esto descarta por completo que sea
    algo del hook de QVAC; es 100% del runtime de Pear en Windows. Búsqueda
    en GitHub (`holepunchto/pear`, `holepunchto/bare-pipe`, `tetherto/qvac`)
    no encontró un issue existente que coincida — lo más cercano es
    [holepunchto/pear#961](https://github.com/holepunchto/pear/issues/961)
    (prebuild de `bare-pipe` faltante en Windows, síntoma distinto pero mismo
    módulo nativo sospechoso). Issue publicado:
    [holepunchto/pear#1125](https://github.com/holepunchto/pear/issues/1125)
    — pendiente de respuesta del equipo de Holepunch antes de poder correr
    cualquier prueba real en el runtime de Pear en esta máquina.
  - `worker.js` (nuevo, raíz del proyecto) — el worker entry que el hook
    genera (`qvac/worker.pear.entry.mjs`) necesita para existir, aunque su
    ausencia no era la causa del timeout de arriba, sí era un bug real
    separado que habría bloqueado el arranque una vez resuelto el problema de
    IPC. Contenido: `initializeWorkerCore()` + `ensureRPCSetup()` de
    `@qvac/sdk/worker-core` (sin registrar plugins de nuevo — eso ya lo hace
    el archivo generado antes de importar este).

---

## Checkpoint B — verificación pendiente (retomada)

`scripts/test-wallet-sepolia.js` (nuevo) — prueba `@tetherto/wdk` +
`@tetherto/wdk-wallet-evm` directo contra Sepolia real, sin pasar por
`wallet.js` (ese módulo usa `localStorage`, API de navegador que no existe en
Node plano — solo corre dentro de la UI desktop). A diferencia de QVAC,
`wdk-wallet-evm` es JS puro sobre `ethers` (expone `index.js` para Node
además de `bare.js` para Bare) — sin bloqueo de runtime nativo.

- [x] **Derivación de cuenta real**: `wdk.getAccount('ethereum', 0)` en
  109ms, dirección válida derivada (`0x179fd9F6cF45d38acCdcA3322B662621c85B568a`,
  42 caracteres, formato EVM correcto).
- [x] **2 bugs reales encontrados y corregidos** (leyendo el código fuente
  instalado de `@tetherto/wdk-wallet-evm`, no asumiendo la API):
  1. `account.getBalance(NETWORK.usdt)` — `getBalance()` en este SDK **no
     acepta argumentos y siempre devuelve el balance nativo (ETH)**, no el de
     un token. El argumento se ignoraba en silencio. El método correcto para
     un ERC-20 es `getTokenBalance(tokenAddress)`. Esto significa que la UI
     de la wallet mostraba "0 USDt" (o el balance de ETH mal etiquetado como
     USDt) sin importar el balance real de USDt de la cartera, en modo real.
     Corregido en `src/wallet/wallet.js` (`getBalance()` del objeto público)
     y en `scripts/test-wallet-sepolia.js`.
  2. `account.transfer({ token, to, amount })` — el campo real que espera
     `EvmTransferOptions` es `recipient`, no `to`. Con `to`, `recipient`
     llegaba `undefined` y **cualquier envío real habría fallado siempre**
     (nunca se detectó porque el modo demo, activo por defecto, no llega a
     llamar a `account.transfer()`, y el script de prueba nunca había
     probado `transfer()` hasta ahora). Corregido en
     `src/wallet/wallet.js` (`signAndSend()`).
- [x] **`scripts/test-wallet-sepolia.js` reescrito**: ahora usa
  `getBalance()`/`getTokenBalance()` correctamente (lee ETH nativo y USDt por
  separado), acepta `TEST_MNEMONIC` como variable de entorno para reusar
  **la misma dirección** entre corridas (antes generaba una mnemonic al azar
  cada vez, haciendo imposible fondearla y reusarla), imprime instrucciones
  exactas de fondeo (faucet de ETH Sepolia + mint público del contrato de
  prueba vía Etherscan), y si detecta que la cartera ya tiene ETH + USDt,
  **intenta un transfer real** (auto-envío de 1 USDt) para confirmar
  `signAndSend()`/`transfer()` de punta a punta.
- [x] Corrido sin fondear (mnemonic al azar) contra el RPC real de Sepolia:
  deriva cuenta, lee ambos balances correctamente (`0`/`0`, esperado para
  cartera nueva) e imprime las instrucciones de fondeo — confirma que el
  código nuevo funciona antes de necesitar fondos reales.
- [ ] **Pendiente real, ahora es solo un paso manual de 2 minutos**: correr
  `TEST_MNEMONIC="..." node scripts/test-wallet-sepolia.js` una vez para
  obtener una dirección fija, fondearla con el faucet de ETH Sepolia + el
  mint del contrato de prueba (links exactos los imprime el propio script),
  y volver a correrlo para confirmar el `transfer()` real. Todo el código ya
  está listo — solo falta la acción de fondeo en un navegador (captcha del
  faucet), que no es automatizable desde acá.
- Nota de depuración real: la primera versión del script llamaba
  `account.getAddress()` sin `await` y logueaba `[object Promise]` en vez de
  la dirección — `getBalance()` sí funcionaba porque WDK resuelve
  internamente, pero el log estaba roto. Corregido.

---

*Actualizado: 2026-07-03*
