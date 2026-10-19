import Link from "next/link";
import { BarraProgreso } from "@/components/onboarding/barra-progreso";
import { BotonEnvio } from "@/components/onboarding/boton-envio";
import { PanelDeFoto } from "@/components/onboarding/marco-acceso";
import { PORTADA_ONBOARDING, type PasoMarco, type RolAlta } from "@/lib/onboarding";

/**
 * Marco del alta (pasos 2 en adelante), con la misma identidad que el ingreso (`MarcoAcceso`): a la izquierda la foto del
 * paso con la bajada de la marca, que queda a la vista mientras se desplaza el formulario; a la derecha una tarjeta blanca con
 * el encabezado (paso + "Guardar y salir"), la barra de progreso y el formulario. En ≤ 860 px la foto pasa arriba. Con
 * `formId`, "Guardar y salir" envía ese formulario (`destino=salir`) para guardar lo escrito antes de salir; sin él es un link
 * al inicio.
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
  const claseSalir =
    "inline-flex min-h-9 flex-none items-center rounded-full bg-lienzo px-4 text-[13px] leading-none font-semibold text-tinta-2 transition-colors hover:bg-linea hover:text-tinta";

  return (
    <div className="flex min-h-screen gap-4 bg-lienzo p-4 max-[860px]:flex-col max-[860px]:gap-0 max-[860px]:p-0">
      <PanelDeFoto
        foto={paso.fondo}
        titulo={portada.titulo}
        bajada={portada.bajada}
        className="sticky top-4 h-[calc(100dvh-2rem)] self-start max-[860px]:relative max-[860px]:top-auto max-[860px]:self-auto"
      />

      <div className="flex min-w-[380px] max-w-[720px] flex-1 flex-col rounded-marco bg-white shadow-tarjeta max-[860px]:max-w-none max-[860px]:min-w-0 max-[860px]:rounded-none max-[860px]:shadow-none">
        <div className="flex items-center justify-between gap-3 px-10 py-5 max-[640px]:px-6">
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
        <main className="flex flex-1 flex-col p-10 max-[640px]:p-6">
          <div className="my-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
