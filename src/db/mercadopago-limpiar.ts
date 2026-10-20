/*
 * Limpia las pruebas de Mercado Pago antes de salir a producción: borra los planes (`planes_mp`), las suscripciones (`suscripciones_mp`) y
 * los cobros (`cobros_mp`) de las instituciones DE EJEMPLO (`es_demo`). Las filas de las pruebas apuntan a suscripciones del sandbox, que el
 * token de producción no conoce: si quedaran, la revisión diaria les preguntaría por ellas a Mercado Pago y llenaría los logs de errores.
 *
 * Nunca toca instituciones reales, ni las facturas (una factura marcada paga por una prueba se deshace desde "Anular pago" en Cobros).
 *
 * Por defecto solo MUESTRA qué borraría. Con `--borrar` borra, y se niega si alguna suscripción de ejemplo sigue viva (pendiente, activa o en
 * pausa): primero hay que cancelarla desde la tarjeta de la institución mientras el token de prueba siga cargado, para que Mercado Pago deje de
 * cobrarla. `--forzar` salta esa traba.
 *
 * Uso: pnpm db:mercadopago-limpiar [--borrar] [--forzar]
 */
import postgres from "postgres";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:mercadopago-limpiar).");
  process.exit(1);
}

const argumentos = process.argv.slice(2);
const borrar = argumentos.includes("--borrar");
const forzar = argumentos.includes("--forzar");

const sql = postgres(url, { max: 1 });

async function main() {
  const [{ planes }] = await sql`select count(*)::int as planes from planes_mp p join instituciones i on i.id = p.institucion_id where i.es_demo`;
  const [{ suscripciones }] = await sql`select count(*)::int as suscripciones from suscripciones_mp s join instituciones i on i.id = s.institucion_id where i.es_demo`;
  const [{ cobros }] = await sql`select count(*)::int as cobros from cobros_mp c join instituciones i on i.id = c.institucion_id where i.es_demo`;
  const vivas = await sql`
    select i.nombre, s.estado
    from suscripciones_mp s join instituciones i on i.id = s.institucion_id
    where i.es_demo and s.estado in ('pendiente', 'autorizada', 'pausada')`;
  const [{ reales }] = await sql`
    select (
      (select count(*) from planes_mp p join instituciones i on i.id = p.institucion_id where not i.es_demo) +
      (select count(*) from suscripciones_mp s join instituciones i on i.id = s.institucion_id where not i.es_demo) +
      (select count(*) from cobros_mp c join instituciones i on i.id = c.institucion_id where not i.es_demo)
    )::int as reales`;

  console.log(`De instituciones de ejemplo: ${planes} plan(es), ${suscripciones} suscripción(es), ${cobros} cobro(s).`);
  if (vivas.length > 0) {
    console.log(`Suscripciones de ejemplo que siguen vivas (${vivas.length}):`);
    for (const v of vivas) console.log(`  - ${v.nombre} (${v.estado})`);
  }
  if (reales > 0) console.log(`De instituciones REALES hay ${reales} fila(s): no se tocan.`);

  if (!borrar) {
    console.log("Solo se mostró qué se borraría. Para borrar: pnpm db:mercadopago-limpiar --borrar");
    return;
  }
  if (vivas.length > 0 && !forzar) {
    console.error(
      "No se borró nada: hay suscripciones de ejemplo vivas. Cancelalas primero desde Plan y facturación de cada institución (con el token de prueba todavía cargado) o usá --forzar.",
    );
    process.exitCode = 1;
    return;
  }

  await sql.begin(async (tx) => {
    await tx`delete from cobros_mp where institucion_id in (select id from instituciones where es_demo)`;
    await tx`delete from suscripciones_mp where institucion_id in (select id from instituciones where es_demo)`;
    await tx`delete from planes_mp where institucion_id in (select id from instituciones where es_demo)`;
  });
  console.log("Listo: se borraron los planes, las suscripciones y los cobros de prueba de las instituciones de ejemplo.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
