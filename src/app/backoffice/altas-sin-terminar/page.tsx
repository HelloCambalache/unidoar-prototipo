import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { AltasSinTerminarTabla, type FilaDeAltaSinTerminar } from "@/components/backoffice/altas-sin-terminar-tabla";
import { EtiquetaSeccion } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/auth";
import { HORAS_MINIMAS_SIN_TERMINAR, etapaDeAltaSinTerminar, etiquetaDeAvisos, impedimentoDeAvisar, tipoDeAvisoDeAlta } from "@/lib/cuentas-sin-terminar";
import { fechaCorta, haceTiempo } from "@/lib/fechas";
import { listarCuentasSinTerminar, type CuentaSinTerminar } from "@/lib/queries/cuentas-sin-terminar";

export const metadata: Metadata = { title: "Altas sin terminar · Backoffice" };
export const dynamic = "force-dynamic";

/** Arma lo que la tabla necesita de cada cuenta: qué se le manda, cuántos avisos recibió y, si no se le puede avisar ahora, por qué. */
function filasDe(cuentas: CuentaSinTerminar[], ahora: Date, adminId: string): FilaDeAltaSinTerminar[] {
  return cuentas.map((c) => ({
    id: c.id,
    email: c.email,
    rol: c.rol,
    fecha: fechaCorta(c.creadaEn),
    haceTiempo: haceTiempo(c.creadaEn, ahora),
    etapa: etapaDeAltaSinTerminar(c),
    perfilEmpezado: c.perfilEmpezado,
    tipoDeAviso: tipoDeAvisoDeAlta(c),
    avisos: etiquetaDeAvisos(c.avisos, (f) => haceTiempo(f, ahora)),
    motivoNo: impedimentoDeAvisar(
      { rol: c.rol, tieneAltaCompleta: false, esDemo: false, creadaEn: c.creadaEn, ahora, esElMismoAdmin: c.id === adminId },
      c.avisos,
    ),
  }));
}

/**
 * Cuentas que se registraron y nunca terminaron el alta. No tienen "Mi cuenta" desde donde pedir la baja y la lista de profesionales
 * solo muestra altas completas, así que se ven y se borran desde acá. Solo aparecen las que se registraron hace más de un día.
 */
export default async function AltasSinTerminar() {
  // El layout ya lo exige, pero acá se leen datos personales y se borran cuentas: se vuelve a verificar en cada página.
  const admin = await requerirUsuario("admin");
  const lista = await listarCuentasSinTerminar();
  const ahora = new Date();

  return (
    <>
      <EncabezadoPagina
        titulo="Altas sin terminar"
        bajada={`Personas que se registraron hace más de ${HORAS_MINIMAS_SIN_TERMINAR} horas y no terminaron el alta. Podés elegirlas y mandarles un mail para que terminen (a quien no confirmó el mail se le reenvía la confirmación), o borrar su registro si lo pidieron o es una cuenta abandonada. A cada persona le escribimos como mucho 2 veces, con una semana entre una y otra.`}
      />

      <section aria-labelledby="con-usuario" className="mb-8">
        <EtiquetaSeccion className="mb-3" id="con-usuario">
          Eligieron un rol y no siguieron ({lista.totalConUsuario})
        </EtiquetaSeccion>
        {lista.conUsuario.length === 0 ? (
          <EstadoVacio titulo="No hay altas a medias" texto="Todas las cuentas que eligieron un rol lo terminaron o son de hace menos de un día." />
        ) : (
          <AltasSinTerminarTabla filas={filasDe(lista.conUsuario, ahora, admin.id)} />
        )}
        {lista.totalConUsuario > lista.conUsuario.length && (
          <p className="mt-2 mb-0 text-xs text-sutil">Se muestran las {lista.conUsuario.length} más nuevas.</p>
        )}
      </section>

      <section aria-labelledby="solo-acceso">
        <EtiquetaSeccion className="mb-3" id="solo-acceso">
          Se registraron y nunca entraron al alta ({lista.totalSoloAcceso})
        </EtiquetaSeccion>
        {lista.soloAcceso.length === 0 ? (
          <EstadoVacio titulo="No hay registros sin usar" texto="Todos los que se registraron llegaron al primer paso del alta o son de hace menos de un día." />
        ) : (
          <AltasSinTerminarTabla filas={filasDe(lista.soloAcceso, ahora, admin.id)} />
        )}
        {lista.totalSoloAcceso > lista.soloAcceso.length && (
          <p className="mt-2 mb-0 text-xs text-sutil">Se muestran los {lista.soloAcceso.length} más nuevos.</p>
        )}
      </section>
    </>
  );
}
