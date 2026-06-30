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
- [ ] Prueba local: dos terminales en la misma red, sin internet

### Capa IA (QVAC)
- [x] Instalar y configurar `@qvac/sdk`
- [x] `src/ai/commentator.js` — comentarista real con SMOLLM2 360M on-device (QVAC)
- [ ] Probar una respuesta de IA on-device sin llamar a ninguna API externa

### Infraestructura
- [ ] `npm start` / `pear run --dev .` funciona sin errores
- [ ] Variables de sala por argumento CLI (`process.argv`)

---

## Cuartos — Reacciones + Voz + Video demo
> Meta: reacciones a jugadas, traducción de voz on-device, video de 3 min

### Capa P2P
- [ ] `src/p2p/board.js` — tablón de predicciones compartido entre peers (Autobase o Hypercore)
- [ ] Sistema de reacciones en tiempo real (gol, falta, VAR, etc.) transmitidas por la malla
- [ ] Manejo de desconexión/reconexión de peers sin perder el estado

### Capa IA
- [ ] `src/ai/translator.js` — traducción de voz on-device con QVAC (español ↔ otro idioma)
- [ ] Pipeline: audio entrada → QVAC transcribe → QVAC traduce → audio o texto salida
- [ ] Comentarista táctico: analiza secuencia de eventos y genera análisis breve

### UI
- [ ] `src/ui/index.js` — interfaz mínima en terminal o Pears GUI
- [ ] Vista: chat de hinchada + reacciones + comentario IA visible

### Demo
- [ ] `demo/guion.md` — guion del video de 3 minutos
- [ ] Grabar video demostrando P2P sin internet + IA on-device

---

## Semis — Integración WDK (Quiniela USDt)
> Meta: quiniela de USDt que se liquida sola entre peers

### Capa Wallet (WDK)
- [ ] Instalar y configurar `@tetherto/wdk`
- [ ] `src/wallet/wallet.js` — crear/importar cartera autocustodial, mostrar balance USDt
- [ ] `src/wallet/pool.js` — crear pool de quiniela: cada peer apuesta X USDt
- [ ] Lógica de quiniela: quién acierta el marcador se lleva el pozo
- [ ] Liquidación peer-to-peer automática al terminar el partido (sin intermediario)
- [ ] Firmar transacciones on-device (llaves nunca salen del dispositivo)

### Integración con P2P
- [ ] Distribuir el estado de la quiniela por la malla (Hypercore / Autobase)
- [ ] Validar apuestas firmadas criptográficamente antes de aceptarlas
- [ ] Resolver disputas: si dos peers reportan marcadores distintos, consenso por mayoría

---

## Final — Demo en vivo sobre partido real del Mundial
> Meta: demo en vivo durante un partido real

### Pulido general
- [ ] Prueba de stress: 10+ peers simultáneos en la misma sala
- [ ] Manejo robusto de errores de red (timeouts, peers caídos, reconexión)
- [ ] Optimizar tamaño del modelo QVAC para respuesta < 2 segundos on-device
- [ ] UI lista para pantalla completa o proyección

### Demo final
- [ ] Preparar dos o más dispositivos físicos para la demo
- [ ] Probar en red congestionada / sin internet (hotspot con datos apagados)
- [ ] Video final de presentación pulido (< 3 min)
- [ ] README actualizado con instrucciones de instalación paso a paso
- [ ] Subir release a GitHub con tag `v1.0`

---

## Pendientes transversales (cualquier ronda)
- [ ] Definir formato de mensaje P2P (JSON schema para eventos de partido)
- [ ] Manejo de identidades de peers (keypair Hyperswarm como identidad)
- [ ] Tests básicos para capa P2P y wallet
- [ ] `.gitignore` correcto (node_modules, llaves privadas, etc.)
- [ ] Documentación de API interna de cada módulo (`src/p2p`, `src/ai`, `src/wallet`)

---

*Actualizado: 2026-06-29*
