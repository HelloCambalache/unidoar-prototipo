import Image from "next/image";
import Link from "next/link";
import { BarraProgreso } from "@/components/onboarding/barra-progreso";
import { BotonEnvio } from "@/components/onboarding/boton-envio";
import { PORTADA_ONBOARDING, type PasoMarco, type RolAlta } from "@/lib/onboarding";

/**
 * Marco del alta: foto a la izquierda con la bajada de la marca, a la derecha el encabezado
 * (paso + "Guardar y salir"), la barra de progreso y el formulario. En ≤ 900 px la foto pasa
 * arriba con 190 px de alto. Con `formId`, "Guardar y salir" envía ese formulario (`destino=salir`)
 * para guardar lo escrito antes de salir; sin él es un link al inicio.
 */
export function MarcoOnboarding({
  rol,
  paso,
  formId,
  children,
}: {
  rol: RolAlta;
  paso: PasoMarco;
  formId?: string;
  children: React.ReactNode;
}) {
  const portada = PORTADA_ONBOARDING[rol];
  const claseSalir = "text-xs leading-none font-medium text-sutil transition-colors hover:text-tinta";

  return (
    <div className="flex min-h-screen max-[900px]:flex-col">
      <div className="relative flex min-w-0 flex-1 flex-col justify-end max-[900px]:h-[190px] max-[900px]:flex-none">
        <Image src={paso.fondo} alt="" fill priority sizes="(max-width: 900px) 100vw, 50vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(22,33,79,.15),rgba(22,33,79,.8))]" />
        <div className="relative z-[1] p-12 text-white max-[640px]:p-6">
          <div className="mb-2.5 font-display text-[26px] leading-[1.25] font-bold tracking-[-0.02em] max-[900px]:text-xl">
            {portada.titulo}
          </div>
          <div className="max-w-[34ch] text-[15px] leading-normal text-white/80 max-[900px]:hidden">{portada.bajada}</div>
        </div>
      </div>

      <div className="flex min-w-[380px] max-w-[720px] flex-1 flex-col bg-app max-[900px]:max-w-none max-[900px]:min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-borde px-10 py-5 max-[640px]:px-6">
          <span className="text-[13px] leading-none font-semibold text-tinta">{paso.etiqueta}</span>
          {formId ? (
            <BotonEnvio plano campo="destino" valor="salir" formId={formId} className={claseSalir}>
              Guardar y salir
            </BotonEnvio>
          ) : (
            <Link href="/" className={claseSalir}>
              Guardar y salir
            </Link>
          )}
        </div>
        <BarraProgreso progreso={paso.progreso} rol={rol} />
        <main className="flex flex-1 flex-col overflow-auto p-10 max-[640px]:p-6">
          <div className="my-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
