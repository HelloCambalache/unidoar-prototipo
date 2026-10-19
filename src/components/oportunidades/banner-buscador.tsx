import { NodosMarca } from "@/components/app/nodos-marca";

/**
 * Banner azul con que abre la pantalla de búsqueda de trabajo, la de adentro (Buscar trabajo y Búsquedas rápidas) y la pública
 * (/buscar-trabajo): se ven igual. Las `acciones` (por ejemplo, ingresar o crear la cuenta) van debajo de la bajada.
 */
export function BannerBuscador({
  titulo,
  bajada,
  acciones,
}: {
  titulo: string;
  bajada: string;
  acciones?: React.ReactNode;
}) {
  return (
    <section className="relative mb-5 overflow-hidden rounded-marco bg-navy-900 px-7 py-7 text-white min-[700px]:px-9">
      <NodosMarca className="absolute -top-10 -right-10 w-[240px] max-[700px]:w-[160px] max-[700px]:opacity-60" />
      <h1 className="font-display relative m-0 max-w-[620px] text-[30px] leading-[1.12] font-semibold tracking-[-0.025em] text-white max-[700px]:text-[24px]">
        {titulo}
      </h1>
      <p className="relative mt-2 mb-0 max-w-[620px] text-[15px] leading-[1.55] text-[#C9CCE0]">{bajada}</p>
      {acciones && (
        <div className="relative mt-5 flex flex-wrap gap-2.5 max-[560px]:[&>a]:flex-1">{acciones}</div>
      )}
    </section>
  );
}
