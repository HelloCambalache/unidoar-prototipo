/*
 * Retira los planes de antes del esquema de 2026-10 (Fundador, Estándar y Anual; **el Plan Fundador volvió el 2026-10-27 como un plan nuevo, con
 * su propia fila, y por eso ya no está en la lista de retirados: este script no lo toca**): pasa cada institución que los tenía al plan que le toca por su
 * tipo (Colegios o Clubes y academias, igual que una cuenta nueva), repunta lo que los referencia (facturas, planes y suscripciones de
 * Mercado Pago, pedidos de cambio de plan; los MONTOS de las facturas ya emitidas no se tocan), borra sus filas de `planes` y deja el plan por
 * defecto de las instituciones en `colegio` (antes era `fundador`).
 *
 * Correrlo ANTES de desplegar el código que ya no conoce esas claves. Es idempotente: sin nada que retirar no cambia nada.
 * Por defecto solo MUESTRA qué haría; con `--aplicar` lo hace, todo en una transacción.
 *
 * Uso: pnpm db:planes-retirar [--aplicar]
 */
import postgres from "postgres";
import { CONDICIONES_POR_DEFECTO } from "@/lib/planes";
import { urlMigraciones } from "./conexion";

const RETIRADOS = ["estandar", "anual"];

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:planes-retirar).");
  process.exit(1);
}

const aplicar = process.argv.slice(2).includes("--aplicar");
const sql = postgres(url, { max: 1, onnotice: () => {} });

async function main() {
  // Los tipos que pagan el arancel de colegios salen de lo que cargó el equipo en Planes (y, si falta, de los valores de lanzamiento).
  const [condiciones] = await sql`select tipos_colegio from planes_condiciones limit 1`;
  const tiposColegio: string[] = condiciones?.tipos_colegio?.length ? condiciones.tipos_colegio : CONDICIONES_POR_DEFECTO.tiposColegio;

  const instituciones = await sql`
    select nombre, tipo, plan, es_demo, baja_en is not null as de_baja,
           case when tipo = any(${tiposColegio}) then 'colegio' else 'deportiva' end as plan_nuevo
    from instituciones where plan = any(${RETIRADOS}) order by plan, nombre`;
  console.log(`Instituciones con un plan retirado: ${instituciones.length}`);
  if (instituciones.length > 0) console.table(instituciones.map((i) => ({ nombre: i.nombre, tipo: i.tipo, plan: i.plan, pasa_a: i.plan_nuevo, demo: i.es_demo, baja: i.de_baja })));

  const contar = async (tabla: string, columna: string) => {
    const [{ n }] = await sql`select count(*)::int as n from ${sql(tabla)} where ${sql(columna)} = any(${RETIRADOS})`;
    return n as number;
  };
  const resumen = {
    facturas: await contar("facturas", "plan"),
    planes_mp: await contar("planes_mp", "plan"),
    suscripciones_mp: await contar("suscripciones_mp", "plan"),
    pedidos_plan_actual: await contar("solicitudes_plan", "plan_actual"),
    pedidos_plan_solicitado: await contar("solicitudes_plan", "plan_solicitado"),
    filas_en_planes: await contar("planes", "clave"),
  };
  console.log("Lo que los referencia:", resumen);

  if (!aplicar) {
    console.log("\nNo se cambió nada. Para hacerlo: pnpm db:planes-retirar --aplicar");
    return;
  }

  await sql.begin(async (tx) => {
    await tx`
      update instituciones set plan = case when tipo = any(${tiposColegio}) then 'colegio' else 'deportiva' end
      where plan = any(${RETIRADOS})`;
    // Las facturas, los planes y las suscripciones de Mercado Pago y los pedidos pasan al plan actual de su institución. El `monto` de una
    // factura ya emitida no cambia: guarda lo que se cobró en su momento.
    await tx`update facturas f set plan = i.plan from instituciones i where i.id = f.institucion_id and f.plan = any(${RETIRADOS})`;
    await tx`update planes_mp p set plan = i.plan from instituciones i where i.id = p.institucion_id and p.plan = any(${RETIRADOS})`;
    await tx`update suscripciones_mp s set plan = i.plan from instituciones i where i.id = s.institucion_id and s.plan = any(${RETIRADOS})`;
    await tx`update solicitudes_plan s set plan_actual = i.plan from instituciones i where i.id = s.institucion_id and s.plan_actual = any(${RETIRADOS})`;
    await tx`update solicitudes_plan s set plan_solicitado = i.plan from instituciones i where i.id = s.institucion_id and s.plan_solicitado = any(${RETIRADOS})`;
    await tx`delete from planes where clave = any(${RETIRADOS})`;
    await tx`alter table instituciones alter column plan set default 'colegio'`;
  });

  const quedan = {
    instituciones: await contar("instituciones", "plan"),
    facturas: await contar("facturas", "plan"),
    planes_mp: await contar("planes_mp", "plan"),
    suscripciones_mp: await contar("suscripciones_mp", "plan"),
    pedidos_plan_actual: await contar("solicitudes_plan", "plan_actual"),
    pedidos_plan_solicitado: await contar("solicitudes_plan", "plan_solicitado"),
    filas_en_planes: await contar("planes", "clave"),
  };
  console.log("\n✓ Hecho. Quedan con un plan retirado:", quedan);
  const sinCero = Object.entries(quedan).filter(([, n]) => n !== 0);
  if (sinCero.length > 0) {
    console.error("Algo quedó sin repuntar:", sinCero);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
