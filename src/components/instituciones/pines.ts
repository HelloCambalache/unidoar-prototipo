import type { PinInstitucion } from "@/components/docente/instituciones-mapa";
import type { InstitucionCatalogo } from "@/lib/queries/instituciones";

/**
 * Los pines del mapa de instituciones: uno por cada sede ubicada (una institución con una sola sede tiene un solo pin). `hrefDe`
 * arma la dirección de su perfil: la del panel del profesional o la del sitio público.
 */
export function pinesDeInstituciones(instituciones: InstitucionCatalogo[], hrefDe: (i: InstitucionCatalogo) => string): PinInstitucion[] {
  return instituciones.flatMap((i) => {
    const lugares = i.sedes.length > 0 ? i.sedes : [{ nombre: i.nombre, zona: i.zona, lat: i.lat, lng: i.lng }];
    return lugares.flatMap((s) =>
      s.lat != null && s.lng != null
        ? [
            {
              id: i.id,
              slug: i.slug,
              href: hrefDe(i),
              nombre: i.nombre,
              sede: i.sedes.length > 1 ? s.nombre : null,
              tipo: i.tipo,
              zona: s.zona ?? i.zona,
              logoUrl: i.logoUrl,
              lat: s.lat,
              lng: s.lng,
              busquedasActivas: i.busquedasActivas,
              favorita: i.favorita,
              verificada: i.verificada,
            },
          ]
        : [],
    );
  });
}
