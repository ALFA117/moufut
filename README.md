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
├── app.js                 # punto de entrada (Bare/Pears)
├── package.json
├── README.md
├── LICENSE                # Apache 2.0
├── src/
│   ├── p2p/               # capa Pears: swarm, chat, board
│   ├── ai/                # capa QVAC: commentator, translator (on-device)
│   ├── wallet/            # capa WDK: wallet, pool (quiniela USDt)
│   └── ui/                # interfaz (pendiente)
└── demo/                  # guion del video de 3 min
```

## Requisitos

- **Node.js** 18+ (o el runtime que indique Pears).
- **Pears / Bare runtime**. Instalacion: ver https://docs.pears.com/
- Dos dispositivos (o dos terminales) para probar la malla P2P.

## Instalacion y ejecucion

```bash
# 1. Clonar
git clone https://github.com/<tu-usuario>/moufut.git
cd moufut

# 2. Instalar dependencias
npm install

# 3. Arrancar (runtime Pears)
pear run --dev .            # o:  npm start

# 4. Probar la malla: en otra terminal / otro dispositivo, mismo codigo de sala
pear run --dev . mi-sala-de-prueba
```

> Si `npm install` falla con `@qvac/sdk` o `@tetherto/wdk`, instala cada uno con
> `@latest` y confirma la version segun la doc oficial (enlaces abajo). Estos SDKs
> evolucionan rapido.

## Estado actual (roadmap por rondas del hackathon)

- [x] **Ronda X** — andamiaje del repo, estructura y stubs comentados.
- [ ] **Octavos** — prototipo: dos dispositivos chatean por P2P sin internet + 1 respuesta del comentarista IA.
- [ ] **Cuartos** — reacciones a jugadas + traduccion de voz on-device. Video de 3 min.
- [ ] **Semis** — integracion de WDK: quiniela de USDt que se liquida sola.
- [ ] **Final** — demo en vivo sobre un partido real del Mundial.

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
