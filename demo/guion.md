# MouFut — Guion Video Demo (3 min)
> Tether Developers Cup 2026 | P2P · QVAC on-device · WDK USDt

---

## [0:00 – 0:20] GANCHO — El problema

**Narrador (en voz):**
> "Estás viendo el Mundial. El internet se cae. El grupo de WhatsApp muere.
> ¿Cómo sigues conectado con tu banda y tu quiniela?
> Con **MouFut** — el compañero de partido que funciona aunque se caiga el internet."

**Pantalla:** Animación de señal WiFi cortándose → logo MouFut aparece.

---

## [0:20 – 1:00] DEMO 1 — Chat P2P sin internet

**Narrador:**
> "Dos teléfonos. Sin router. Sin datos móviles. Solo un hotspot local."

**En pantalla (screen grab de dos dispositivos):**
1. Dispositivo A abre MouFut → sala `#mundial2026-final`
2. Dispositivo B escanea el código de sala y se une
3. El status dot se pone verde: "2 peers"
4. A escribe: "¡GOOOL de Mbappé! 🔥" → aparece en B en tiempo real
5. B presiona el botón **GOL** → aparece "GOL" como reacción en ambos

**Narrador:**
> "Hyperswarm conecta los dispositivos directo, peer-to-peer, sin pasar por ningún servidor."

---

## [1:00 – 1:40] DEMO 2 — Comentarista IA on-device

**Narrador:**
> "MouBot es el comentarista que vive en tu dispositivo.
> Sin llamadas a OpenAI. Sin internet. Solo el modelo corriendo localmente con QVAC."

**En pantalla:**
1. Usuario presiona **VAR** → reacción en chat
2. Cambia a tab **MouBot**
3. Presiona botón rápido: "¿Táctica México?" → MouBot responde en ~2s
4. Usuario escribe: "¿Cómo puede marcar Argentina?" → respuesta on-device
5. Se ve el badge "IA on-device · QVAC" confirmando inferencia local

**Narrador:**
> "SMOLLM2 360M corriendo directamente en el hardware. Sin latencia de red. Sin privacidad comprometida."

---

## [1:40 – 2:20] DEMO 3 — Quiniela USDt P2P

**Narrador:**
> "Ahora lo más interesante: apostar USDt sin ningún intermediario."

**En pantalla:**
1. Usuario va a tab **Quiniela**
2. Crea cartera → dirección EVM aparece
3. Introduce predicción: México 2 – Argentina 1 · 10 USDt → "Apostar"
4. En dispositivo B: aparece predicción de A en el tablón
5. B introduce su predicción: Argentina 1 – México 1 · 10 USDt
6. Tablón muestra: 2 jugadores · 20 USDt en el pozo
7. Leyenda: "Las llaves nunca salen de tu dispositivo"

**Narrador:**
> "WDK de Tether genera la cartera on-device con frase semilla BIP-39.
> La liquidación es P2P — quien acierte el marcador recibe el pozo automáticamente."

---

## [2:20 – 2:50] ARQUITECTURA — 30 segundos técnicos

**Pantalla:** Diagrama simple (puede ser slide):

```
[Peer A]                    [Peer B]
   │                            │
   └──── Hyperswarm DHT ────────┘
            sin servidor

   ┌─────────────────────────┐
   │  QVAC on-device         │
   │  SMOLLM2 360M (LLM)     │
   │  Whisper Base (voz→txt) │
   │  NMT (traducción)       │
   └─────────────────────────┘

   ┌─────────────────────────┐
   │  WDK (Tether)           │
   │  BIP-39 · ERC-20 USDt  │
   │  Firma on-device        │
   └─────────────────────────┘
```

**Narrador:**
> "Todo corre en tu dispositivo. La malla es Hyperswarm.
> La IA es QVAC. La cartera es WDK de Tether.
> Stack completo del Tether Developers Cup."

---

## [2:50 – 3:00] CTA

**Pantalla:** Logo MouFut + repo GitHub

**Narrador:**
> "MouFut — P2P, privado, on-device. Para los que se la saben aunque se caiga el internet."

---

## Checklist de grabación

- [ ] Dos dispositivos físicos con Pear instalado
- [ ] Hotspot local sin conexión a internet (verificar con `ping google.com` → falla)
- [ ] Modelo QVAC descargado previamente (primera descarga necesita internet)
- [ ] Cartera de prueba con USDt de testnet
- [ ] OBS o QuickTime para captura de pantalla
- [ ] Voz en off grabada por separado y sincronizada en edición
- [ ] Subtítulos en español e inglés
- [ ] Duración final: ≤ 3:00 minutos

---

*Actualizado: 2026-06-29*
