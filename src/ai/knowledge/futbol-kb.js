/**
 * Base de conocimiento local para el RAG del orquestador (ver `ai/rag.js`).
 * Documentos cortos y autocontenidos — no hace falta chunking, cada uno ya es
 * del tamaño de una respuesta. Cada texto lleva su fuente entre corchetes al
 * inicio para que el modelo pueda citarla en la respuesta.
 *
 * Fuentes de confianza distinta:
 *  - Reglas del fútbol y formato del Mundial 2026: hechos estables y públicos.
 *  - Historial México-Argentina: marcadores según el conocimiento del autor
 *    al momento de escribir esto, NO verificados contra una fuente oficial en
 *    vivo — revisar las cifras exactas antes de una demo pública si la
 *    precisión importa (ver nota en `historialMxArg`).
 */

const reglas = [
  '[Reglas del fútbol] Fuera de lugar (offside): un jugador atacante está en posición adelantada si, en el momento en que un compañero le pasa el balón, está más cerca de la línea de meta rival que el balón y que el penúltimo defensor rival — salvo que esté en su propia mitad de cancha, o que reciba el balón directamente de un saque de meta, un saque de banda o un córner. Estar en posición adelantada no es falta por sí solo: solo se sanciona si el jugador participa activamente de la jugada.',
  '[Reglas del fútbol] Tarjeta amarilla: amonestación por falta imprudente o conducta antideportiva (una entrada fuerte, protestar, retrasar el juego, etc). Un jugador amonestado dos veces en el mismo partido recibe una segunda amarilla, que se convierte automáticamente en tarjeta roja y expulsión.',
  '[Reglas del fútbol] Tarjeta roja directa: expulsión inmediata por falta grave, conducta violenta, escupir a alguien, o impedir un gol claro con la mano. El equipo sancionado sigue el partido con un jugador menos y no puede reemplazar al expulsado.',
  '[Reglas del fútbol] VAR (asistencia arbitral por video): sistema que revisa por video cuatro tipos de jugadas — goles y su posible anulación, penales, tarjetas rojas directas, y confusión de identidad del jugador sancionado. El árbitro central tiene la decisión final tras consultar el video. Se usó por primera vez en un Mundial en Rusia 2018.',
  '[Reglas del fútbol] Tiro penal: se sanciona cuando un equipo comete una falta dentro de su propia área. Se ejecuta desde el punto de penal, a 11 metros de la línea de meta, solo el pateador y el portero rival frente a frente.',
  '[Reglas del fútbol] Duración del partido: 90 minutos regulares divididos en dos tiempos de 45, más el tiempo agregado que decide el árbitro por lesiones, sustituciones y demoras. En fases eliminatorias, si hay empate se juegan 30 minutos extra (dos tiempos de 15) y, si persiste el empate, se define por tanda de penales.',
]

const mundial2026 = [
  '[Mundial 2026] La Copa Mundial de la FIFA 2026 la organizan conjuntamente México, Estados Unidos y Canadá — es la primera edición con sede en tres países a la vez.',
  '[Mundial 2026] Es el primer Mundial con 48 selecciones participantes, ampliado desde el formato de 32 equipos que se usó de 1998 a 2022.',
  '[Mundial 2026] México se convierte en el primer país en ser sede de una Copa del Mundo en tres ocasiones distintas: 1970, 1986 y 2026.',
  '[Mundial 2026] El formato ampliado a 48 equipos organiza la fase de grupos en 12 grupos de 4 selecciones, y clasifican a la siguiente ronda los dos primeros de cada grupo más los mejores terceros lugares.',
]

const historialMxArg = [
  // Nota de confianza: estos tres resultados son de memoria del autor al
  // escribir esta base, no verificados contra una fuente oficial en el
  // momento de la carga — revisar antes de citarlos como dato duro en vivo.
  '[Historial México vs Argentina — verificar antes de una demo en vivo] Mundial de Alemania 2006, octavos de final: Argentina 2-1 México (tiempo extra), con gol decisivo de Maxi Rodríguez.',
  '[Historial México vs Argentina — verificar antes de una demo en vivo] Mundial de Sudáfrica 2010, octavos de final: Argentina 3-1 México, con goles de Carlos Tévez (doblete, el primero en un fuera de lugar no sancionado que generó polémica) y Gonzalo Higuaín.',
  '[Historial México vs Argentina — verificar antes de una demo en vivo] Mundial de Catar 2022, fase de grupos: Argentina 2-0 México, con goles de Lionel Messi y Enzo Fernández — resultado que mantuvo con vida a Argentina, que terminó siendo campeona de ese Mundial.',
]

const datosGenerales = [
  '[Datos generales] México ha participado en 17 Copas del Mundo y su mejor resultado histórico son los cuartos de final, alcanzados como anfitrión en 1970 y 1986.',
  '[Datos generales] Argentina ha ganado la Copa del Mundo en tres ocasiones: 1978 (como anfitriona), 1986 y 2022.',
  '[Datos generales] La selección mexicana suele vestir de verde como color principal de local, en referencia a la bandera nacional; Argentina viste la clásica camiseta a rayas celestes y blancas.',
]

export const FUTBOL_KB = [...reglas, ...mundial2026, ...historialMxArg, ...datosGenerales]
