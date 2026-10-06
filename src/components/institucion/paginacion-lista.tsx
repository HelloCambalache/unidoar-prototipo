import { BotonLink } from "@/components/ui/button";

/** "Anterior / Siguiente" con links (la página vive en la URL). No se muestra si hay una sola página. */
export function PaginacionLista({
  pagina,
  paginas,
  hrefDe,
}: {
  pagina: number;
  paginas: number;
  hrefDe: (pagina: number) => string;
}) {
  if (paginas <= 1) return null;
  return (
    <nav aria-label="Páginas de resultados" className="mt-6 flex items-center justify-center gap-3">
      {pagina > 1 ? (
        <BotonLink href={hrefDe(pagina - 1)} variante="secundario" tamano="sm" scroll>
          ← Anterior
        </BotonLink>
      ) : (
        <span aria-hidden className="min-w-[96px]" />
      )}
      <span className="text-[13px] text-apagado">
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <BotonLink href={hrefDe(pagina + 1)} variante="secundario" tamano="sm" scroll>
          Siguiente →
        </BotonLink>
      ) : (
        <span aria-hidden className="min-w-[96px]" />
      )}
    </nav>
  );
}
