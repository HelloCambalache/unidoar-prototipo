import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { CuentaBaja } from "@/components/institucion/cuenta-baja";
import { CuentaContrasena } from "@/components/institucion/cuenta-contrasena";
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
        <CuentaContrasena tieneContrasena={cuenta.tieneContrasena} />
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
