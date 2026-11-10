import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { CuentaAvisos } from "@/components/cuenta/cuenta-avisos";
import { CuentaContrasena } from "@/components/cuenta/cuenta-contrasena";
import { CuentaEmail } from "@/components/cuenta/cuenta-email";
import { CuentaWhatsapp } from "@/components/cuenta/cuenta-whatsapp";
import { CuentaBajaDocente } from "@/components/docente/cuenta-baja-docente";
import { requerirDocente } from "@/lib/auth";
import { fechaCorta } from "@/lib/fechas";
import { datosDeCuentaDocente } from "@/lib/queries/cuenta";
import { avisosPorWhatsappDe } from "@/lib/queries/whatsapp";
import { whatsappActivo } from "@/lib/whatsapp/config";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function MiCuentaDocente() {
  const { usuario, docente } = await requerirDocente();
  const cuenta = await datosDeCuentaDocente(docente);
  const whatsapp = whatsappActivo() ? await avisosPorWhatsappDe(usuario.id) : { activos: false, numeroEnmascarado: null };

  return (
    <>
      <EncabezadoPagina
        titulo="Mi cuenta"
        bajada="Tus datos de acceso a UNIDOAR. Lo que ven las instituciones (tu experiencia, tus zonas y tu CV) se edita en Mi perfil."
      />
      <div className="flex max-w-[980px] flex-col gap-4">
        <CuentaEmail email={usuario.email} />
        <CuentaContrasena tieneContrasena={cuenta.tieneContrasena} />
        <CuentaAvisos rol="docente" inicial={usuario.avisosPorCorreo} />
        {whatsappActivo() && (
          <CuentaWhatsapp rol="docente" activos={whatsapp.activos} numeroEnmascarado={whatsapp.numeroEnmascarado} telefonoSugerido={docente.telefono ?? ""} />
        )}
        <CuentaBajaDocente
          email={usuario.email}
          solicitadaEl={cuenta.bajaSolicitadaEn ? fechaCorta(cuenta.bajaSolicitadaEn) : null}
        />
      </div>
    </>
  );
}
