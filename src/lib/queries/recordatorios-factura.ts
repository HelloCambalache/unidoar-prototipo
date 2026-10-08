import "server-only";
import { and, between, eq, ne } from "drizzle-orm";
import { facturas, instituciones } from "@/db/schema";
import { hoyAR } from "@/lib/cobros";
import { DIAS_ANTES_DEL_VENCIMIENTO, DIAS_MAXIMOS_DE_ATRASO, planificarRecordatorios, sumarDias } from "@/lib/correo/claves";
import { correoDeRecordatorio } from "@/lib/correo/eventos";
import { destinatariosDeFacturacion, type EjecutorBo } from "@/lib/queries/backoffice-instituciones";

/**
 * Anota los recordatorios de factura que corresponden hoy: "vence pronto" (M51) y "está vencida" (M52). Mira las
 * facturas impagas de instituciones activas (ni suspendidas ni de demostración) cuyo vencimiento cae entre hace 30 días
 * y dentro de 3. Las reglas de cuándo toca cada uno están en `planificarRecordatorios`, y la clave de cada mail
 * garantiza que, aunque la tarea corra todos los días, cada aviso salga una sola vez.
 */
export async function encolarRecordatoriosDeFactura(ejecutor: EjecutorBo, ahora = new Date()) {
  const hoy = hoyAR(ahora);
  const filas = await ejecutor
    .select({
      id: facturas.id,
      institucionId: facturas.institucionId,
      institucion: instituciones.nombre,
      periodo: facturas.periodo,
      monto: facturas.monto,
      fechaCobro: facturas.fechaCobro,
      estado: facturas.estado,
    })
    .from(facturas)
    .innerJoin(instituciones, eq(instituciones.id, facturas.institucionId))
    .where(
      and(
        ne(facturas.estado, "pagada"),
        eq(instituciones.suspendida, false),
        eq(instituciones.esDemo, false),
        between(facturas.fechaCobro, sumarDias(hoy, -DIAS_MAXIMOS_DE_ATRASO), sumarDias(hoy, DIAS_ANTES_DEL_VENCIMIENTO)),
      ),
    );

  const recordatorios = planificarRecordatorios(filas, hoy);
  const destinatarios = new Map<string, string[]>();
  for (const r of recordatorios) {
    const f = filas.find((x) => x.id === r.facturaId)!;
    if (!destinatarios.has(f.institucionId)) destinatarios.set(f.institucionId, await destinatariosDeFacturacion(ejecutor, f.institucionId));
    await correoDeRecordatorio(ejecutor, r, {
      usuarioIds: destinatarios.get(f.institucionId)!,
      institucion: f.institucion,
      periodo: f.periodo,
      monto: f.monto,
      fechaCobro: f.fechaCobro,
    });
  }
  return { facturas: filas.length, recordatorios: recordatorios.length };
}
