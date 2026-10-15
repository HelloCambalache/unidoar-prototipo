import type { SedePublica } from "@/lib/sedes";

/** Enlace al mapa de una sede: por coordenadas si las tiene y, si no, por el texto de la dirección. */
function enlaceAlMapa(s: SedePublica) {
  if (s.lat != null && s.lng != null) return `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=16/${s.lat}/${s.lng}`;
  const texto = [s.direccion, s.zona].filter(Boolean).join(", ");
  return texto ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}` : null;
}

/**
 * Las sedes de una institución con más de una (en la vitrina pública y en la del profesional): nombre, dirección, zona y un enlace al
 * mapa de cada una. Con una sola sede las páginas siguen mostrando su "Dónde queda" de siempre.
 */
export function ListaDeSedes({ sedes }: { sedes: SedePublica[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
      {sedes.map((s, n) => {
        const mapa = enlaceAlMapa(s);
        return (
          <li key={`${s.nombre}-${s.direccion ?? ""}`} className="flex items-start gap-3 text-sm leading-normal text-tinta-2">
            {/* Número de la sede (vienen ordenadas: la principal es la 1). */}
            <span
              aria-hidden
              className="mt-px inline-flex size-7 flex-none items-center justify-center rounded-full bg-navy-900 text-[12.5px] font-semibold text-white"
            >
              {n + 1}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-tinta">
                <span className="sr-only">Sede {n + 1}: </span>
                {s.nombre}
              </div>
              {s.direccion && <div>{s.direccion}</div>}
              {s.zona && <div className="text-apagado">{s.zona}</div>}
              {mapa && (
                <a
                  href={mapa}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver la sede ${s.nombre} en el mapa (se abre en otra pestaña)`}
                  className="mt-1 inline-block text-[13px] font-semibold text-navy-700 underline hover:text-naranja"
                >
                  Ver en el mapa
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
