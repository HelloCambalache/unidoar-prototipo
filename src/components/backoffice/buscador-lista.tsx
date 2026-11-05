import Link from "next/link";
import { Icono } from "@/components/icons";
import { Input } from "@/components/ui/campos";

/**
 * La lupa de una lista del backoffice (verificación, cobros…): un formulario común (GET), así que funciona sin JavaScript, el texto queda en la
 * URL (`?q=`) y lo que ya estaba elegido (la pestaña, por ejemplo) se conserva en `conservar`.
 */
export function BuscadorLista({
  accion,
  q,
  conservar = {},
  etiqueta,
  placeholder,
}: {
  /** La ruta de la pantalla: a donde manda el formulario. */
  accion: string;
  q: string;
  /** Parámetros de la URL que no se pierden al buscar (con valor vacío no se mandan). */
  conservar?: Record<string, string>;
  /** Para lectores de pantalla. */
  etiqueta: string;
  placeholder: string;
}) {
  const fijos = Object.entries(conservar).filter(([, valor]) => valor !== "");
  const sinBuscar = fijos.length > 0 ? `${accion}?${new URLSearchParams(fijos).toString()}` : accion;
  return (
    <form
      role="search"
      method="get"
      action={accion}
      className="mb-4 flex flex-wrap items-center gap-2.5 rounded-tarjeta bg-white p-3 shadow-tarjeta"
    >
      {fijos.map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
      <div className="relative min-w-[220px] max-w-[420px] flex-1 max-[640px]:max-w-none">
        <Icono nombre="buscar" tamano={17} trazo={2} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sutil" />
        <Input type="search" name="q" defaultValue={q} maxLength={80} aria-label={etiqueta} placeholder={placeholder} className="pl-10" />
      </div>
      <button
        type="submit"
        className="inline-flex min-h-[42px] flex-none items-center gap-2 rounded-xl bg-navy-700 px-5 text-[13.5px] leading-none font-semibold text-white transition-colors hover:bg-navy-900 focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
      >
        <Icono nombre="buscar" tamano={15} trazo={2.2} />
        Buscar
      </button>
      {q && (
        <Link href={sinBuscar} className="text-[13px] leading-none font-medium text-naranja hover:underline">
          Quitar la búsqueda
        </Link>
      )}
    </form>
  );
}
