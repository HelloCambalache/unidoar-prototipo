import type { Metadata } from "next";
import Link from "next/link";
import { FormularioBajaAvisos } from "@/components/publico/formulario-baja-avisos";
import { firmaDeBajaValida } from "@/lib/correo/baja";
import { recibeAvisosPorCorreo } from "@/lib/queries/correo";

export const metadata: Metadata = {
  title: "Avisos por mail",
  robots: { index: false, follow: false },
};

// Depende del enlace de cada mail y de la base: no se genera de antemano.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ u?: string; t?: string }> };

export default async function BajaDeAvisos({ searchParams }: Props) {
  const { u, t } = await searchParams;
  const valido = typeof u === "string" && typeof t === "string" && firmaDeBajaValida(u, t);
  const activos = valido ? await recibeAvisosPorCorreo(u.toLowerCase()) : null;

  return (
    <div className="mx-auto w-full max-w-[640px] flex-1 px-12 py-14 max-[560px]:px-6 max-[560px]:py-10">
      <h1 className="mb-2 text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta">Avisos por mail</h1>

      {activos === null ? (
        <>
          <p className="mb-6 text-[15px] leading-[1.6] text-apagado">
            Este enlace no es válido o ya no corresponde a una cuenta. Si querés dejar de recibir avisos por mail, entrá a tu cuenta y
            desactivalos desde «Mi cuenta».
          </p>
          <Link href="/ingresar" className="text-sm font-medium text-navy-700 underline">
            Ingresar a mi cuenta
          </Link>
        </>
      ) : activos === false ? (
        <p className="m-0 text-[15px] leading-[1.6] text-apagado">
          Ya no recibís avisos por mail. Los seguís viendo en la campanita de UNIDOAR. Si querés volver a recibirlos, activalos desde «Mi
          cuenta».
        </p>
      ) : (
        <FormularioBajaAvisos usuarioId={u!} firma={t!}>
          <p className="m-0 text-[15px] leading-[1.6] text-apagado">
            Vas a dejar de recibir por mail los avisos de búsquedas, postulaciones y entrevistas. Los seguís viendo en la campanita de
            UNIDOAR.
          </p>
          <p className="m-0 text-[15px] leading-[1.6] text-apagado">
            Los mails de tu cuenta (verificación, seguridad) y de facturación no se pueden desactivar: son parte del funcionamiento del
            servicio.
          </p>
        </FormularioBajaAvisos>
      )}
    </div>
  );
}
