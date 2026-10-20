import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { CuentaBaja } from "@/components/institucion/cuenta-baja";
import { CuentaEquipo } from "@/components/institucion/cuenta-equipo";
import { CuentaAvisos } from "@/components/cuenta/cuenta-avisos";
import { CuentaContrasena } from "@/components/cuenta/cuenta-contrasena";
import { CuentaEmail } from "@/components/cuenta/cuenta-email";
import { CuentaDatos } from "@/components/institucion/cuenta-datos";
import { requerirInstitucion } from "@/lib/auth";
import { infoDeRol } from "@/lib/equipo";
import { fechaCorta } from "@/lib/fechas";
import { datosDeCuenta } from "@/lib/queries/cuenta";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function MiCuenta() {
  const { usuario, institucion } = await requerirInstitucion();
  const cuenta = await datosDeCuenta(institucion, usuario);

  return (
    <>
      <EncabezadoPagina
        titulo="Mi cuenta"
        bajada="Tus datos personales como responsable de la institución. No se muestran en la vitrina pública."
      />
      <div className="flex max-w-[980px] flex-col gap-4">
        <CuentaDatos
          inicial={{ nombre: cuenta.nombre, apellido: cuenta.apellido, telefono: cuenta.telefono }}
          email={cuenta.email}
          rolEtiqueta={infoDeRol(cuenta.rol).label}
        />
        <CuentaEmail email={cuenta.email} />
        <CuentaContrasena tieneContrasena={cuenta.tieneContrasena} />
        <CuentaAvisos rol="institucion" inicial={usuario.avisosPorCorreo} />
        {!cuenta.esDueno && <CuentaEquipo nombreInstitucion={institucion.nombre} />}
        <CuentaBaja
          nombreInstitucion={institucion.nombre}
          email={cuenta.email}
          esDueno={cuenta.esDueno}
          solicitadaEl={cuenta.bajaSolicitadaEn ? fechaCorta(cuenta.bajaSolicitadaEn) : null}
        />
      </div>
    </>
  );
}
