import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { AvisoEmailConfirmado } from "@/components/cuenta/aviso-email";
import { CuentaAvisos } from "@/components/cuenta/cuenta-avisos";
import { CuentaContrasena } from "@/components/cuenta/cuenta-contrasena";
import { CuentaEmail } from "@/components/cuenta/cuenta-email";
import { CuentaBajaDocente } from "@/components/docente/cuenta-baja-docente";
import { requerirDocente } from "@/lib/auth";
import { fechaCorta } from "@/lib/fechas";
import { datosDeCuentaDocente } from "@/lib/queries/cuenta";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function MiCuentaDocente({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { usuario, docente } = await requerirDocente();
  const cuenta = await datosDeCuentaDocente(docente);
  const { email: avisoEmail } = await searchParams;

  return (
    <>
      <EncabezadoPagina
        titulo="Mi cuenta"
        bajada="Tus datos de acceso a UNIDOAR. Lo que ven las instituciones (tu experiencia, tus zonas y tu CV) se edita en Mi perfil."
      />
      <div className="flex max-w-[980px] flex-col gap-4">
        {avisoEmail === "confirmado" && <AvisoEmailConfirmado email={usuario.email} />}
        <CuentaEmail email={usuario.email} tieneContrasena={cuenta.tieneContrasena} />
        <CuentaContrasena tieneContrasena={cuenta.tieneContrasena} />
        <CuentaAvisos rol="docente" inicial={usuario.avisosPorCorreo} />
        <CuentaBajaDocente
          email={usuario.email}
          solicitadaEl={cuenta.bajaSolicitadaEn ? fechaCorta(cuenta.bajaSolicitadaEn) : null}
        />
      </div>
    </>
  );
}
