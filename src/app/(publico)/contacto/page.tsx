import type { Metadata } from "next";
import { FormularioContacto } from "@/components/publico/formulario-contacto";
import { CONTACTO_SITIO } from "@/lib/publico";

export const metadata: Metadata = {
  title: "Contacto",
  description: "¿Tenés dudas sobre tu institución, tu perfil profesional o algo puntual? Escribinos y te respondemos en el día.",
};

export default function Contacto() {
  return (
    <div className="mx-auto w-full max-w-[900px] flex-1 px-12 py-14 max-[560px]:px-6 max-[560px]:py-10">
      <h1 className="mb-2 text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta">Contacto</h1>
      <p className="mb-9 max-w-[56ch] text-[15px] leading-[1.6] text-apagado">
        ¿Tenés dudas sobre tu institución, tu perfil profesional o algo puntual? Escribinos y te respondemos en el día.
      </p>
      <div className="flex flex-wrap gap-10">
        <div className="min-w-0 flex-[1_1_280px]">
          <FormularioContacto />
        </div>
        <aside className="flex w-[280px] flex-none flex-col gap-5 max-[700px]:w-full">
          <div className="rounded-lg bg-[#F5F4F0] p-5">
            <h2 className="mb-1.5 text-[13px] leading-none font-semibold text-tinta">Email</h2>
            <a href={`mailto:${CONTACTO_SITIO.email}`} className="text-sm leading-normal text-apagado hover:text-naranja">
              {CONTACTO_SITIO.email}
            </a>
          </div>
          <div className="rounded-lg bg-[#F5F4F0] p-5">
            <h2 className="mb-1.5 text-[13px] leading-none font-semibold text-tinta">WhatsApp</h2>
            <p className="text-sm leading-normal text-apagado">{CONTACTO_SITIO.whatsapp}</p>
          </div>
          <div className="rounded-lg bg-[#F5F4F0] p-5">
            <h2 className="mb-1.5 text-[13px] leading-none font-semibold text-tinta">Horario de atención</h2>
            <p className="text-sm leading-normal text-apagado">{CONTACTO_SITIO.horario}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
