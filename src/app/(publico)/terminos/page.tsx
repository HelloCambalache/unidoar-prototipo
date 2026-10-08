import type { Metadata } from "next";
import Link from "next/link";
import { TERMINOS_ACTUALIZADOS } from "@/lib/terminos";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Las reglas de uso de UNIDOAR para instituciones, docentes, entrenadores y guardavidas.",
};

const SECCIONES = [
  {
    id: "que-es",
    titulo: "1. Qué es UNIDOAR",
    texto:
      "UNIDOAR es un catálogo que conecta instituciones educativas, deportivas y de natación con docentes, entrenadores y guardavidas de su zona. No somos empleadores ni intermediamos la relación laboral entre las partes.",
  },
  {
    id: "cuentas",
    titulo: "2. Cuentas y verificación",
    texto:
      "Los datos de identidad y formación que cargás pueden ser verificados por UNIDOAR antes de mostrarse a instituciones o docentes. Sos responsable de la veracidad de la información que subís.",
  },
  {
    id: "uso",
    titulo: "3. Uso del catálogo",
    texto:
      "Las instituciones se comprometen a usar el catálogo únicamente para búsquedas reales de personal. Los docentes se comprometen a mantener actualizada su disponibilidad y zonas de trabajo.",
  },
  {
    id: "planes",
    titulo: "4. Planes y pagos",
    texto:
      "Las instituciones acceden mediante una suscripción mensual. El uso del catálogo por parte de los docentes es y seguirá siendo gratuito.",
  },
  {
    id: "privacidad",
    titulo: "5. Privacidad",
    texto:
      "Tus datos se usan para operar el catálogo y no se comparten con terceros ajenos al proceso de búsqueda y contratación.",
  },
];

export default function Terminos() {
  return (
    <div className="mx-auto w-full max-w-[760px] flex-1 px-12 py-14 max-[560px]:px-6 max-[560px]:py-10">
      <h1 className="mb-2 text-[30px] leading-[1.2] font-semibold tracking-[-0.02em] text-tinta">
        Términos y condiciones
      </h1>
      <p className="mb-8 text-sm leading-normal text-sutil">Última actualización: {TERMINOS_ACTUALIZADOS}</p>
      <div className="flex flex-col gap-[26px] text-[15px] leading-[1.7] text-tinta-2">
        {SECCIONES.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <h2 className="mb-2 text-lg leading-[1.3] font-semibold text-tinta">{s.titulo}</h2>
            <p>{s.texto}</p>
            {s.id === "privacidad" && (
              <p className="mt-2">
                El detalle completo está en nuestra{" "}
                <Link href="/privacidad" className="font-semibold text-naranja">
                  política de privacidad
                </Link>
                .
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
