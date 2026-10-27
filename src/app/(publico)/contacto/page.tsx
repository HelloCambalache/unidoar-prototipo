import type { Metadata } from "next";
import Link from "next/link";
import { NodosMarca } from "@/components/app/nodos-marca";
import { Icono } from "@/components/icons";
import { FormularioContacto } from "@/components/publico/formulario-contacto";
import { enlaceWhatsapp } from "@/lib/pipeline";
import { CONTACTO_SITIO } from "@/lib/publico";

export const metadata: Metadata = {
  title: "Contacto",
  description: "¿Tenés dudas sobre tu institución, tu perfil profesional o algo puntual? Escribinos y te respondemos en el día.",
};

/** Un dato de contacto en su tarjeta: ícono decorativo a la izquierda, título y valor a la derecha. */
function DatoDeContacto({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-tarjeta bg-white p-5 shadow-tarjeta">
      <span aria-hidden className="inline-flex size-11 flex-none items-center justify-center rounded-xl bg-navy-50 text-navy-700">
        {icono}
      </span>
      <div className="min-w-0">
        <h2 className="m-0 mb-1.5 text-[13px] leading-none font-semibold text-tinta">{titulo}</h2>
        <div className="text-sm leading-normal text-apagado [overflow-wrap:anywhere]">{children}</div>
      </div>
    </div>
  );
}

export default function Contacto() {
  return (
    <div className="mx-auto w-full max-w-[1100px] flex-1 px-12 pt-10 pb-14 max-[900px]:px-6 max-[560px]:pt-6 max-[560px]:pb-10">
      <section className="relative mb-6 overflow-hidden rounded-marco bg-navy-900 px-12 py-12 text-white max-[560px]:px-6 max-[560px]:py-9">
        <NodosMarca className="absolute -top-10 -right-8 w-[260px] opacity-90 max-[700px]:w-[170px] max-[700px]:opacity-60" />
        <h1 className="font-display relative m-0 mb-2.5 text-[40px] leading-[1.1] font-semibold tracking-[-0.025em] max-[560px]:text-[30px]">
          Contacto
        </h1>
        <p className="relative m-0 max-w-[46ch] text-[16px] leading-[1.6] text-white/75">
          ¿Tenés dudas sobre tu institución, tu perfil profesional o algo puntual? Escribinos y te respondemos en el día.
        </p>
        <p className="relative m-0 mt-3 max-w-[46ch] text-[14.5px] leading-[1.6] text-white/65">
          Antes de escribir, mirá si te lo resuelve el{" "}
          <Link href="/ayuda" className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
            centro de ayuda
          </Link>
          .
        </p>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 max-[900px]:grid-cols-1">
        <div className="rounded-tarjeta bg-white p-8 shadow-tarjeta max-[560px]:p-5">
          <FormularioContacto />
        </div>
        <aside className="flex flex-col gap-4">
          <DatoDeContacto
            titulo="Email"
            icono={
              <Icono nombre="mensaje" tamano={20} trazo={1.8} />
            }
          >
            <a href={`mailto:${CONTACTO_SITIO.email}`} className="hover:text-naranja">
              {CONTACTO_SITIO.email}
            </a>
          </DatoDeContacto>
          {CONTACTO_SITIO.whatsapp && (
            <DatoDeContacto
              titulo="WhatsApp"
              icono={
                <Icono nombre="whatsapp" tamano={20} trazo={1.8} />
              }
            >
              <a
                href={enlaceWhatsapp(CONTACTO_SITIO.whatsapp) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-naranja"
              >
                {CONTACTO_SITIO.whatsapp}
              </a>
            </DatoDeContacto>
          )}
          <DatoDeContacto titulo="Horario de atención" icono={<Icono nombre="reloj" tamano={20} trazo={1.8} />}>
            {CONTACTO_SITIO.horario}
          </DatoDeContacto>
        </aside>
      </div>
    </div>
  );
}
