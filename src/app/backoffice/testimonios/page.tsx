import type { Metadata } from "next";
import { TestimoniosEditor } from "@/components/backoffice/testimonios-editor";
import { requerirUsuario } from "@/lib/auth";
import { almacenamientoConfigurado } from "@/lib/almacenamiento";
import { testimoniosDelEquipo } from "@/lib/queries/backoffice-testimonios";

export const metadata: Metadata = { title: "Testimonios · Backoffice" };
export const dynamic = "force-dynamic";

export default async function TestimoniosBackoffice() {
  // El layout ya lo exige, pero acá se leen y se escriben datos: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const testimonios = await testimoniosDelEquipo();

  return (
    <>
      <div className="mb-5">
        <h1 className="m-0 mb-1.5 text-[24px] leading-[1.2] font-semibold tracking-[-0.018em] max-[860px]:text-[22px]">Testimonios</h1>
        <p className="m-0 text-sm leading-normal text-apagado">
          Lo que dicen las instituciones en la portada y en las páginas de docentes, entrenadores y guardavidas. Cargalos acá: solo se
          muestran los que están visibles.
        </p>
      </div>
      <TestimoniosEditor testimonios={testimonios} almacenamientoDisponible={almacenamientoConfigurado()} />
    </>
  );
}
