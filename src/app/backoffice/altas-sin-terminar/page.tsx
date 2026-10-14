import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { CuentaSinTerminarBorrar } from "@/components/backoffice/cuenta-sin-terminar-borrar";
import { Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { EtiquetaSeccion } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/auth";
import { HORAS_MINIMAS_SIN_TERMINAR, etapaDeAltaSinTerminar } from "@/lib/cuentas-sin-terminar";
import { fechaCorta, haceTiempo } from "@/lib/fechas";
import { listarCuentasSinTerminar, type CuentaSinTerminar } from "@/lib/queries/cuentas-sin-terminar";

export const metadata: Metadata = { title: "Altas sin terminar · Backoffice" };
export const dynamic = "force-dynamic";

const ROL = { docente: "Profesional", institucion: "Institución" } as const;

function TablaDeCuentas({ cuentas, ahora }: { cuentas: CuentaSinTerminar[]; ahora: Date }) {
  return (
    <Tabla>
      <thead>
        <tr>
          <th>Email</th>
          <th>Quién</th>
          <th>Se registró</th>
          <th>Dónde se quedó</th>
          <th aria-label="Acciones" />
        </tr>
      </thead>
      <tbody>
        {cuentas.map((c) => (
          <tr key={c.id}>
            <td className="font-semibold [overflow-wrap:anywhere]">{c.email}</td>
            <td>{c.rol ? <Insignia tono="azul">{ROL[c.rol]}</Insignia> : <span className="text-sutil">—</span>}</td>
            <td className="whitespace-nowrap text-apagado">
              {fechaCorta(c.creadaEn)}
              <span className="block text-xs text-sutil">{haceTiempo(c.creadaEn, ahora)}</span>
            </td>
            <td className="text-apagado">{etapaDeAltaSinTerminar(c)}</td>
            <td className="text-right">
              <CuentaSinTerminarBorrar cuentaId={c.id} email={c.email} perfilEmpezado={c.perfilEmpezado} />
            </td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

/**
 * Cuentas que se registraron y nunca terminaron el alta. No tienen "Mi cuenta" desde donde pedir la baja y la lista de profesionales
 * solo muestra altas completas, así que se ven y se borran desde acá. Solo aparecen las que se registraron hace más de un día.
 */
export default async function AltasSinTerminar() {
  // El layout ya lo exige, pero acá se leen datos personales y se borran cuentas: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const lista = await listarCuentasSinTerminar();
  const ahora = new Date();

  return (
    <>
      <EncabezadoPagina
        titulo="Altas sin terminar"
        bajada={`Personas que se registraron hace más de ${HORAS_MINIMAS_SIN_TERMINAR} horas y no terminaron el alta. Podés borrar su registro: por ejemplo, si lo pidieron por mail o si es una cuenta abandonada.`}
      />

      <section aria-labelledby="con-usuario" className="mb-8">
        <EtiquetaSeccion className="mb-3" id="con-usuario">
          Eligieron un rol y no siguieron ({lista.totalConUsuario})
        </EtiquetaSeccion>
        {lista.conUsuario.length === 0 ? (
          <EstadoVacio titulo="No hay altas a medias" texto="Todas las cuentas que eligieron un rol lo terminaron o son de hace menos de un día." />
        ) : (
          <TablaDeCuentas cuentas={lista.conUsuario} ahora={ahora} />
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
          <TablaDeCuentas cuentas={lista.soloAcceso} ahora={ahora} />
        )}
        {lista.totalSoloAcceso > lista.soloAcceso.length && (
          <p className="mt-2 mb-0 text-xs text-sutil">Se muestran los {lista.soloAcceso.length} más nuevos.</p>
        )}
      </section>
    </>
  );
}
