import { BotonLink } from "@/components/ui/button";

export default function NoEncontrada() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-app px-6 py-20 text-center">
      <h1 className="mb-2 font-display text-[28px] leading-tight font-bold tracking-[-0.02em] text-tinta">
        No encontramos esa página
      </h1>
      <p className="mb-6 max-w-[46ch] text-[15px] leading-normal text-apagado">
        Puede que el enlace esté mal escrito o que la institución ya no esté publicada.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <BotonLink href="/" variante="primario">
          Ir al inicio
        </BotonLink>
        <BotonLink href="/instituciones" variante="secundario">
          Ver instituciones
        </BotonLink>
      </div>
    </div>
  );
}
