import { Imagen } from "@/components/publico/imagen";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { focoDeFoto } from "@/lib/fotos";
import { cn } from "@/lib/utils";
import { fechaNovedad, fechaNovedadLarga, type VitrinaFotoVista, type VitrinaNovedadVista } from "@/lib/vitrina";

/*
 * Bloques de la vitrina de una institución tal como los ven docentes y visitantes: misión, visión y valores,
 * galería de instalaciones y novedades. Los comparten el perfil público (/instituciones/[slug]) y el que ve el
 * docente dentro de la app. Cada uno no muestra nada si la institución no cargó ese dato.
 */

export function VitrinaMisionVision({
  mision,
  vision,
  valores,
  className,
}: {
  mision: string | null;
  vision: string | null;
  valores: string[];
  className?: string;
}) {
  if (!mision && !vision && valores.length === 0) return null;
  return (
    <Tarjeta como="section" className={cn("mb-4", className)}>
      {(mision || vision) && (
        <div className={cn("grid gap-5", mision && vision ? "grid-cols-2 max-[700px]:grid-cols-1" : "grid-cols-1")}>
          {mision && (
            <div>
              <EtiquetaSeccion>Misión</EtiquetaSeccion>
              <p className="m-0 text-sm leading-[1.6] text-tinta-2">{mision}</p>
            </div>
          )}
          {vision && (
            <div>
              <EtiquetaSeccion>Visión</EtiquetaSeccion>
              <p className="m-0 text-sm leading-[1.6] text-tinta-2">{vision}</p>
            </div>
          )}
        </div>
      )}
      {valores.length > 0 && (
        <div className={cn((mision || vision) && "mt-[18px] border-t border-borde pt-4")}>
          <EtiquetaSeccion>Valores</EtiquetaSeccion>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {valores.map((v) => (
              <li key={v} className="rounded-full bg-navy-50 px-2.5 py-[5px] text-xs leading-none font-semibold text-navy-700">
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Tarjeta>
  );
}

export function VitrinaInstalaciones({ fotos, nombre, className }: { fotos: VitrinaFotoVista[]; nombre: string; className?: string }) {
  if (fotos.length === 0) return null;
  // Con tres fotos o más, la primera ocupa el doble de ancho y de alto (el mosaico del prototipo).
  const mosaico = fotos.length >= 3;
  return (
    <Tarjeta como="section" className={cn("mb-4", className)}>
      <EtiquetaSeccion>Instalaciones</EtiquetaSeccion>
      <ul
        className={cn(
          "m-0 grid list-none gap-2.5 p-0",
          mosaico
            ? "auto-rows-[110px] grid-cols-3 max-[560px]:auto-rows-[96px] max-[560px]:grid-cols-2"
            : "grid-cols-2 max-[560px]:grid-cols-1",
        )}
      >
        {fotos.map((f, i) => (
          <li
            key={f.id}
            className={cn(
              "relative min-h-0 min-w-0 overflow-hidden rounded-lg bg-[#F0EFEA]",
              mosaico ? (i === 0 ? "col-span-2 row-span-2 max-[560px]:col-span-2" : "") : "aspect-[4/3]",
            )}
          >
            <Imagen
              src={f.url}
              alt={f.etiqueta || `Instalaciones de ${nombre}`}
              style={{ objectPosition: focoDeFoto(f.url) }}
              className="size-full object-cover"
            />
            {f.etiqueta && (
              <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] truncate rounded-full bg-black/60 px-2 py-[3px] text-[11px] leading-none font-semibold text-white">
                {f.etiqueta}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

export function VitrinaNovedadesLista({ novedades, className }: { novedades: VitrinaNovedadVista[]; className?: string }) {
  if (novedades.length === 0) return null;
  return (
    <Tarjeta como="section" className={cn("mb-4", className)}>
      <EtiquetaSeccion>Novedades</EtiquetaSeccion>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {novedades.map((n) => (
          <li key={n.id} className="flex gap-3.5 border-b border-borde pb-3.5 last:border-b-0 last:pb-0">
            <time dateTime={n.fecha} className="w-11 flex-none text-center text-[11px] leading-[1.3] font-semibold text-sutil">
              <span aria-hidden>{fechaNovedad(n.fecha)}</span>
              <span className="sr-only">{fechaNovedadLarga(n.fecha)}</span>
            </time>
            <div className="min-w-0">
              <h3 className="m-0 text-sm leading-[1.3] font-semibold text-tinta">{n.titulo}</h3>
              <p className="m-0 mt-1 text-[13px] leading-normal text-apagado">{n.texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}
