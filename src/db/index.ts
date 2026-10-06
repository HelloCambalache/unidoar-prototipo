import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { after } from "next/server";
import postgres from "postgres";
import { urlApp, usaPoolerDeTransacciones } from "./conexion";
import * as schema from "./schema";

/*
 * Inicialización perezosa: Next evalúa el código de módulo al hacer `next build`,
 * y ahí todavía puede no existir la URL de la base (por ejemplo antes de provisionar Supabase).
 * No envolver en un Proxy: rompe librerías que inspeccionan el objeto.
 */
/**
 * Conexiones por instancia. El pooler de sesión de Supabase tiene un tope total (`pool_size`, 15 por defecto)
 * y cada instancia de Vercel guarda su propio pool, aun inactiva: con 5 por instancia, unos pocos redeploys
 * seguidos agotan el tope y las páginas con varias consultas a la vez fallan con EMAXCONNSESSION. En Vercel
 * alcanzan 2 (las consultas extra esperan unos milisegundos). `DB_POOL_MAX` lo pisa sin tocar código.
 */
function maxConexiones() {
  const configurado = Number.parseInt(process.env.DB_POOL_MAX ?? "", 10);
  if (configurado > 0) return configurado;
  return process.env.VERCEL ? 2 : 5;
}

/** Segundos sin usar una conexión antes de cerrarla. En Vercel es corto: así se liberan lugares del pooler enseguida. */
const IDLE_SEGUNDOS = process.env.VERCEL ? 2 : 10;

// Cuándo se hizo la última consulta (cualquier consulta, de cualquier pedido de esta instancia).
let ultimoUso = Date.now();

function crearDb() {
  const url = urlApp();
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL (pooler de sesión de Supabase, puerto 5432). Ver .env.example.",
    );
  }
  const cliente = postgres(url, {
    // Pooler de transacciones de Supabase: sin prepared statements.
    prepare: !usaPoolerDeTransacciones(url),
    max: maxConexiones(),
    // Se reciclan las conexiones en reposo antes de que el pooler las cierre por su cuenta: una conexión
    // cerrada del otro lado hace fallar la próxima escritura con CONNECTION_CLOSED.
    idle_timeout: IDLE_SEGUNDOS,
    max_lifetime: 60 * 15,
    connect_timeout: 15,
    // Se llama en cada consulta: alcanza para saber hasta cuándo hay que mantener viva la instancia.
    debug: () => {
      ultimoUso = Date.now();
    },
  });
  return drizzle(cliente, { schema });
}

type Db = ReturnType<typeof crearDb>;

// En desarrollo, el hot reload re-evalúa este módulo: se guarda la instancia para no abrir conexiones de más.
const global = globalThis as unknown as { __unidoarDb?: Db };

let esperando: Promise<void> | null = null;

/**
 * En Vercel, terminada la respuesta la instancia se congela con sus conexiones abiertas: los temporizadores
 * que las cierran por inactividad no corren, y cada instancia vieja o nueva sigue ocupando lugares del
 * pooler de Supabase durante minutos (llegó a agotar el tope con EMAXCONNSESSION). `after()` mantiene viva
 * la instancia hasta que pasó el tiempo de inactividad sin consultas, así postgres-js las cierra solo.
 * Una sola espera por instancia: se extiende sola mientras siga habiendo consultas.
 */
function mantenerVivaHastaSoltarConexiones() {
  try {
    after(() => {
      esperando ??= (async () => {
        const inicio = Date.now();
        const quietud = (IDLE_SEGUNDOS + 1) * 1000;
        try {
          while (Date.now() - ultimoUso < quietud && Date.now() - inicio < 30_000) {
            await new Promise((r) => setTimeout(r, 250));
          }
        } finally {
          esperando = null;
        }
      })();
      return esperando;
    });
  } catch {
    // Fuera de un pedido (build, scripts): no hay instancia que mantener viva.
  }
}

export function getDb(): Db {
  global.__unidoarDb ??= crearDb();
  ultimoUso = Date.now();
  if (process.env.VERCEL) mantenerVivaHastaSoltarConexiones();
  return global.__unidoarDb;
}

/** Transacción de Drizzle: el parámetro que recibe la función de `transaccion`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Transacción con límites de tiempo propios. Usar siempre esto en lugar de `getDb().transaction`.
 *
 * Si la conexión se corta a mitad de una transacción (pasa a veces a través del pooler de Supabase), el
 * servidor la deja abierta reteniendo sus bloqueos y todo lo que toque esas filas se cuelga. Estos límites
 * hacen que el servidor la cancele solo en segundos. Van acá y no en el rol de la base ni en la conexión
 * porque el pooler ignora esos ajustes; `set_config(…, true)` equivale a `SET LOCAL` y sí se respeta.
 */
export function transaccion<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('lock_timeout', '8s', true), set_config('statement_timeout', '25s', true), set_config('idle_in_transaction_session_timeout', '30s', true)`,
    );
    return fn(tx);
  });
}

export { schema };
