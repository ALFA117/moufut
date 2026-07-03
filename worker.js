// Worker entry requerido por el hook `pear.pre` de @qvac/sdk (ver
// node_modules/@qvac/sdk/dist/pear/pre.js). Pear genera
// qvac/worker.pear.entry.mjs, que registra los plugins de qvac.config.json y
// luego importa este archivo — por eso acá NO se registran plugins de nuevo,
// solo se arranca el core/RPC del worker (igual que la mitad final de
// @qvac/sdk/dist/server/worker.js, la plantilla genérica pensada para
// Node/Expo que sí registra todos los plugins ella misma).
import { initializeWorkerCore, ensureRPCSetup } from '@qvac/sdk/worker-core'

const { hasRPCConfig } = initializeWorkerCore()

if (hasRPCConfig) {
  ensureRPCSetup()
}
