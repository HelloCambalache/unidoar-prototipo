import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { salir } from "@/app/actions/auth";
import { FormularioRegistro } from "@/components/onboarding/formulario-registro";
import { TituloPaso } from "@/components/onboarding/elementos";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { Boton, BotonLink } from "@/components/ui/button";
import { PRIMER_PASO_PROTEGIDO } from "@/lib/acceso";
import { sesionActual } from "@/lib/auth";
import { esUuid } from "@/lib/busquedas";
import { DIAS_DE_VIGENCIA_DE_INVITACION, infoDeRol } from "@/lib/equipo";
import { invitacionPendiente } from "@/lib/queries/equipo";

export const metadata: Metadata = { title: "Invitación al equipo" };

/**
 * Enlace del mail de una invitación al equipo de una institución (`/invitacion/<id>`). Lleva a la persona directo a esa
 * institución: sin elegir "Soy institución" y con el email de la invitación ya puesto. Al confirmar el mail, el paso 2 del alta le
 * muestra la invitación para aceptarla o rechazarla (`sumarseAlEquipo`: nunca se activa sola); quien ya tiene cuenta con ese email solo
 * ingresa. Una invitación vale `DIAS_DE_VIGENCIA_DE_INVITACION` días.
 */
export default async function PaginaInvitacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invitacion = esUuid(id) ? await invitacionPendiente(id) : null;
  const sesion = await sesionActual();

  if (!invitacion || invitacion.vencida) {
    return (
      <MarcoAcceso>
        <TituloPaso
          titulo={invitacion ? "Esta invitación venció" : "Esta invitación ya no está disponible"}
          bajada={
            invitacion
              ? `Pasaron más de ${DIAS_DE_VIGENCIA_DE_INVITACION} días desde que te invitaron. Pedile a quien te invitó que te mande otra. Si ya tenés cuenta, ingresá.`
              : "Puede que ya la hayas aceptado, que la hayas rechazado o que la institución la haya cancelado. Si ya tenés cuenta, ingresá. Si no, pedile a quien te invitó que te mande otra."
          }
        />
        <BotonLink href={sesion ? "/inicio" : "/ingresar"} variante="primario" bloque className="min-h-12 text-base">
          {sesion ? "Ir a mi cuenta" : "Ingresá"}
        </BotonLink>
      </MarcoAcceso>
    );
  }

  const nombre = invitacion.institucion.nombre;

  if (sesion) {
    // Con la sesión del email invitado alcanza: el paso 2 del alta le muestra la invitación para aceptarla o rechazarla.
    if (sesion.email?.toLowerCase() === invitacion.email.toLowerCase()) redirect(PRIMER_PASO_PROTEGIDO.institucion);
    return (
      <MarcoAcceso titulo={`Sumate al equipo de ${nombre}`}>
        <TituloPaso
          titulo="Esta invitación es para otro email"
          bajada={
            <>
              Estás conectado como <b className="font-semibold text-tinta">{sesion.email}</b>, pero te invitaron con{" "}
              <b className="font-semibold text-tinta">{invitacion.email}</b>. Cerrá sesión y entrá con ese email para sumarte.
            </>
          }
        />
        <form action={salir} className="flex flex-col gap-3.5">
          <Boton type="submit" variante="primario" bloque className="min-h-12 text-base">
            Cerrar sesión
          </Boton>
          <Link href="/inicio" className="text-center text-[13px] font-medium text-sutil hover:text-tinta">
            Volver a mi cuenta
          </Link>
        </form>
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso titulo={`Sumate al equipo de ${nombre}`} bajada="Buscá, entrevistá y contratá profesionales verificados, junto a tu equipo.">
      {/* Sin Google a propósito: tiene que ser la cuenta del email invitado y, con otra, se terminaría creando una institución nueva. */}
      <FormularioRegistro
        rol="institucion"
        conGoogle={false}
        invitacion={{ institucion: nombre, rol: infoDeRol(invitacion.rol).label, email: invitacion.email }}
      />
    </MarcoAcceso>
  );
}
