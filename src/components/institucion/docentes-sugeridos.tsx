import { BotonLink } from "@/components/ui/button";
import { Avatar, Insignia, Verificado } from "@/components/ui/insignia";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { focoDeFoto } from "@/lib/fotos";
import type { DocenteRecomendado } from "@/lib/queries/coincidencias";

/** El perfil del docente es donde vive "Invitar": desde el dashboard solo se llega hasta ahí. */
const hrefPerfil = (id: string, busquedaId?: string) =>
  `/institucion/docente/${id}${busquedaId ? `?busqueda=${busquedaId}` : ""}`;

/** Columna "Docentes recomendados para vos" del dashboard. */
export function RecomendadosLateral({
  docentes,
  busquedaId,
}: {
  docentes: DocenteRecomendado[];
  /** Búsqueda a la que se invitaría (la más reciente), para que el perfil la traiga preseleccionada. */
  busquedaId?: string;
}) {
  return (
    <section aria-label="Profesionales recomendados" className="w-[300px] flex-none rounded-ud border border-borde bg-white p-5 max-[760px]:w-full">
      <h2 className="m-0 mb-1 text-[15px] leading-tight font-semibold">Profesionales recomendados para vos</h2>
      <p className="m-0 mb-4 text-[13px] leading-snug text-apagado">De tu zona y de tus búsquedas abiertas</p>
      {docentes.length === 0 ? (
        <p className="m-0 text-[13px] leading-normal text-sutil">
          Todavía no hay profesionales verificados que coincidan con tu zona y tus búsquedas.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {docentes.map((d) => (
            <li key={d.id}>
              <div className="mb-2 flex items-center gap-2.5">
                <Avatar
                  iniciales={d.iniciales}
                  fotoUrl={d.fotoUrl}
                  tamano={40}
                  fondo={CATEGORIA_INFO[d.categoria].tint}
                  texto={CATEGORIA_INFO[d.categoria].ink}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm leading-tight font-semibold">
                    <span className="truncate">{d.nombre}</span>
                    <Verificado categoria={d.categoria} tamano={14} />
                  </div>
                  <div className="mt-0.5 truncate text-xs leading-snug text-apagado">{d.detalle}</div>
                </div>
              </div>
              {d.motivos.length > 0 && (
                <ul aria-label="Por qué te lo recomendamos" className="m-0 mb-2 flex list-none flex-col gap-0.5 p-0">
                  {d.motivos.slice(0, 2).map((m) => (
                    <li key={m} className="flex items-start gap-1.5 text-[12px] leading-snug text-tinta-2">
                      <span aria-hidden className="mt-px text-verde">✓</span>
                      {m}
                    </li>
                  ))}
                </ul>
              )}
              <BotonLink href={hrefPerfil(d.id, busquedaId)} variante="secundario" tamano="sm" bloque>
                Invitar a postularse
              </BotonLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Grilla "Mientras tanto, mirá quién hay cerca" de la primera vez. */
export function GrillaCercanos({ docentes }: { docentes: DocenteRecomendado[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-4 gap-4 p-0 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1">
      {docentes.map((d) => {
        const info = CATEGORIA_INFO[d.categoria];
        return (
          <li key={d.id} className="flex flex-col overflow-hidden rounded-[14px] border border-borde bg-white transition-[transform,box-shadow] duration-150 hover:-translate-y-[3px] hover:shadow-[0_14px_32px_rgba(31,36,33,.12)]">
            {d.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- fotos de perfil de tamaño desconocido
              <img src={d.fotoUrl} alt="" style={{ objectPosition: focoDeFoto(d.fotoUrl) }} className="h-[104px] w-full object-cover" />
            ) : (
              <span
                aria-hidden
                style={{ background: info.tint, color: info.ink }}
                className="inline-flex h-[104px] items-center justify-center font-display text-[28px] font-bold"
              >
                {d.iniciales}
              </span>
            )}
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-[3px] flex items-center gap-1.5 text-[14.5px] leading-tight font-semibold">
                <span className="truncate">{d.nombre}</span>
                <Verificado categoria={d.categoria} tamano={14} />
              </div>
              <div className="mb-2.5 text-[12.5px] leading-snug text-apagado">{d.detalle}</div>
              <div className="mb-3.5 flex flex-wrap gap-1.5">
                {d.etiquetas.map((e) => (
                  <Insignia key={e}>{e}</Insignia>
                ))}
              </div>
              <BotonLink href={hrefPerfil(d.id)} variante="secundario" tamano="sm" bloque className="mt-auto">
                Invitar a postularse
              </BotonLink>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
