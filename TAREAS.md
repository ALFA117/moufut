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
- [x] Tests básicos para capa P2P y wallet — `scripts/test-p2p-local.js`, `scripts/test-pool-sync.js`, `scripts/test-stress-peers.js`, `scripts/test-ai-commentator.js`
- [x] `.gitignore` correcto (node_modules, `.pear/`, `*.key`/`*.secret`/`*.mnemonic`, `.env`)
- [x] Documentación de API interna de cada módulo (`src/p2p`, `src/ai`, `src/wallet`) — JSDoc agregado a `swarm.js`, `chat.js`, `board.js`, `wallet.js` y `commentator.js` (los demás ya lo tenían). De paso se corrigió un bug real en `board.js`: `listeners` estaba a nivel de módulo en vez de dentro de `createBoard()`, compartiendo el arreglo entre instancias.

---

*Actualizado: 2026-06-30*
