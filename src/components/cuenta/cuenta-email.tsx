import Link from "next/link";
import { Tarjeta } from "@/components/ui/tarjeta";

/**
 * Email de acceso, solo lectura: no se puede cambiar desde la app (ni con contraseña ni con Google). Quien necesite usar otro
 * escribe por Contacto y lo resuelve el equipo.
 */
export function CuentaEmail({ email }: { email: string }) {
  return (
    <Tarjeta como="section" className="p-[22px]">
      <h2 className="m-0 mb-1.5 text-base leading-none font-semibold">Email de acceso</h2>
      <p className="m-0 text-sm leading-normal text-apagado">
        Ingresás con <strong className="text-tinta">{email}</strong>. Este email no se puede cambiar. Si necesitás usar otro,{" "}
        <Link href="/contacto" className="font-semibold text-navy-700 underline">
          escribinos desde Contacto
        </Link>{" "}
        y lo resolvemos.
      </p>
    </Tarjeta>
  );
}
