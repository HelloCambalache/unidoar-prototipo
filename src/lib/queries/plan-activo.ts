import "server-only";
import { getDb } from "@/db";
import type { Institucion } from "@/db/schema";
import { hoyAR } from "@/lib/cobros";
import { puedePagarSemestre, resumenDeSemestre } from "@/lib/forma-de-pago";
import { moraDe } from "@/lib/mora";
import { enlaceWhatsapp } from "@/lib/pipeline";
import { errorDePlanInactivo, motivoDePlanInactivo, type DatosDelPopup, type MotivoDePlanInactivo } from "@/lib/plan-activo";
import { esClavePlan } from "@/lib/planes";
import { CONTACTO_SITIO } from "@/lib/publico";
import { acuerdoDe } from "@/lib/queries/acuerdos";
import { facturasParaMora } from "@/lib/queries/mora";
import { formaDePagoDeCobro } from "@/lib/queries/pago-manual";
import { planes } from "@/lib/queries/planes";
import { cantidadDeSedes } from "@/lib/queries/sedes";

/*
 * ¿Tiene la institución el plan activo? (reglas y textos en src/lib/plan-activo.ts). No se guarda nada: se calcula al mirar con sus facturas, así que
 * cuando el equipo registra el pago (o el de la factura vencida) se habilita solo.
 */

type DeLaInstitucion = Pick<Institucion, "id" | "esDemo" | "plan">;

/** Por qué el plan de la institución no está activo, o null si lo está. */
export async function motivoDelPlan(institucion: DeLaInstitucion): Promise<MotivoDePlanInactivo | null> {
  if (institucion.esDemo) return null;
  const [P, filas] = await Promise.all([planes(), facturasParaMora(institucion.id)]);
  const impagas = filas.filter((f) => f.estado !== "pagada");
  const facturasPagas = filas.length - impagas.length;
  const mora = moraDe(impagas, hoyAR());
  // El acuerdo de precio solo importa en dos casos: un plan por sede (Multisede) necesita un convenio para tener un precio, y una cuenta con un
  // abono que todavía no pagó nada puede estar sin cargo (precio acordado de $0). En los demás no se lee (esta consulta corre en cada pantalla).
  const porSede = P.planDe(institucion.plan).porSede;
  const puedeEstarSinCargo = !mora.limitada && !P.esPuntual(institucion.plan) && facturasPagas === 0;
  const acuerdo = porSede || puedeEstarSinCargo ? await acuerdoDe(getDb(), institucion.id) : null;
  const precioDefinido = porSede ? P.precioDefinido(institucion.plan, acuerdo) : true;
  const sinCargo = puedeEstarSinCargo && !!acuerdo && P.sinCargo(institucion.plan, (await cantidadDeSedes(getDb(), [institucion.id])).get(institucion.id) ?? 1, acuerdo);
  return motivoDePlanInactivo({
    esDemo: false,
    esPuntual: P.esPuntual(institucion.plan),
    precioDefinido,
    sinCargo,
    facturasPagas,
    mora,
  });
}

/**
 * Para una ACCIÓN que necesita el plan activo (publicar una búsqueda, invitar a postularse, publicar un curso, reabrir una búsqueda): el mensaje
 * para mostrarle, o null si puede. No alcanza con esconder el botón: la acción se puede llamar directo, así que se exige acá. Quien la llama
 * devuelve `fallo(mensaje, undefined, CODIGO_PLAN_INACTIVO)`: el código hace que la pantalla abra el popup de pago.
 */
export async function motivoDeLimiteDePlan(institucion: DeLaInstitucion): Promise<string | null> {
  const motivo = await motivoDelPlan(institucion);
  return motivo ? errorDePlanInactivo(motivo) : null;
}

/**
 * Lo que necesita el popup de pago del área de la institución: null si el plan está activo (no se arma nada ni se hacen más lecturas). Con el plan
 * inactivo suma lo que cuesta, con sus sedes y su precio acordado, y si puede pagar el semestre.
 */
export async function datosDelPopupDe(institucion: DeLaInstitucion): Promise<DatosDelPopup | null> {
  const motivo = await motivoDelPlan(institucion);
  if (!motivo) return null;
  const db = getDb();
  const [P, sedes, acuerdo, forma] = await Promise.all([planes(), cantidadDeSedes(db, [institucion.id]), acuerdoDe(db, institucion.id), formaDePagoDeCobro(institucion)]);
  const plan = esClavePlan(institucion.plan) ? institucion.plan : "colegio";
  const cantidad = sedes.get(institucion.id) ?? 1;
  return {
    motivo,
    planNombre: P.planDe(plan).label,
    mensual: P.esPuntual(plan) ? null : P.montoDePlan(plan, cantidad, acuerdo),
    semestre: puedePagarSemestre(P, plan) ? resumenDeSemestre(P, plan, cantidad, acuerdo) : null,
    forma,
    whatsapp: enlaceWhatsapp(CONTACTO_SITIO.whatsapp),
  };
}
