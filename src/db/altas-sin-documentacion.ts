/*
 * Da por completa el alta de los profesionales que se quedaron en el último paso, «Documentación» (pedido del cliente, 2026-11-25: «muchos
 * profesionales no terminan de completar la documentación»). Hasta ese día el alta se cerraba recién en ese paso, aunque subir documentos es
 * opcional, y quien dejaba la pestaña ahí —con todos sus datos cargados— no figuraba en el buscador de las instituciones. Ahora el alta se
 * cierra al terminar «Niveles y horarios» (ver `src/lib/alta-completa.ts`); este script hace lo mismo con los que ya estaban frenados.
 *
 * Marca como completos a los perfiles que tienen todo lo obligatorio (teléfono, niveles, horarios y número de DNI), con cuenta de acceso, que no son
 * de ejemplo, ni están suspendidos ni rechazados, y les deja el subtítulo por defecto si no tenían uno. La verificación no cambia: figuran como
 * «Sin verificar». No toca a quien le falta algo de los pasos anteriores.
 *
 * Sin cambios de esquema: se puede correr antes o después de desplegar. Es idempotente (sin candidatos no hace nada).
 * Por defecto solo MUESTRA a quiénes marcaría; con `--aplicar` lo hace, todo en una transacción.
 *
 * Uso: pnpm db:altas-sin-documentacion [--aplicar]
 */
import postgres from "postgres";
import { subtituloDeAlta } from "@/lib/alta-completa";
import { urlMigraciones } from "./conexion";

const url = urlMigraciones();
if (!url) {
  console.error("Falta la URL de la base (corré el script con dotenv: pnpm db:altas-sin-documentacion).");
  process.exit(1);
}

const aplicar = process.argv.slice(2).includes("--aplicar");
const sql = postgres(url, { max: 1, onnotice: () => {} });

async function main() {
  const [{ total }] = await sql`select count(*)::int as total from docentes where not onboarding_completo and not es_demo and not suspendido`;
  const candidatos = await sql`
    select d.id, d.nombre, d.apellido, d.categoria::text as categoria, d.categorias_extra::text[] as categorias_extra,
           d.asignaturas, d.subtitulo, d.verificacion::text as verificacion
    from docentes d
    join docente_detalle dd on dd.docente_id = d.id
    where not d.onboarding_completo and not d.es_demo and not d.suspendido
      and d.usuario_id is not null
      and d.verificacion <> 'rechazado'
      and d.telefono is not null
      and cardinality(d.niveles) > 0 and cardinality(d.disponibilidad) > 0
      and coalesce(dd.dni, '') <> ''
    order by d.creado_en`;
  console.log(`Perfiles con el alta sin terminar (no de ejemplo ni suspendidos): ${total}`);
  console.log(`De esos, con todo lo obligatorio cargado y frenados en la documentación: ${candidatos.length}`);
  if (candidatos.length > 0) {
    console.table(candidatos.map((d) => ({ nombre: `${d.nombre} ${d.apellido}`.trim(), categoria: d.categoria, verificacion: d.verificacion, subtitulo: d.subtitulo ?? "(se completa)" })));
  }

  if (candidatos.length === 0) {
    console.log("\nNada para hacer.");
    return;
  }
  if (!aplicar) {
    console.log("\nNo se cambió nada. Para hacerlo: pnpm db:altas-sin-documentacion --aplicar");
    return;
  }

  await sql.begin(async (tx) => {
    for (const d of candidatos) {
      const subtitulo = subtituloDeAlta({
        categoria: d.categoria,
        categoriasExtra: d.categorias_extra,
        asignaturas: d.asignaturas,
        subtitulo: d.subtitulo,
      });
      await tx`update docentes set onboarding_completo = true, subtitulo = ${subtitulo} where id = ${d.id} and not onboarding_completo`;
    }
  });
  console.log(`\nListo: ${candidatos.length} perfiles con el alta completa (figuran como «Sin verificar»).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
