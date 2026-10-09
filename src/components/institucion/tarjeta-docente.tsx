import Link from "next/link";
import { BotonLink } from "@/components/ui/button";
import { Avatar, Insignia, Verificado } from "@/components/ui/insignia";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { etiquetaDeEstudiante } from "@/lib/estudiantes";
import { kmLegible } from "@/lib/geo";
import { opcionesDeInvitacion } from "@/lib/invitaciones";
import type { BusquedaInvitable, DocenteTarjeta } from "@/lib/queries/profesionales";
import { cn, iniciales } from "@/lib/utils";
import { BotonFavoritoDocente } from "./boton-favorito-docente";
import { BotonInvitarDocente } from "./boton-invitar-docente";

/**
 * Tarjeta de un profesional en el buscador. Al pasar el mouse el borde toma el color de su categoría;
 * si cumple todo lo que pide una búsqueda rápida de contexto, queda con borde naranja; en la pantalla de
 * búsquedas rápidas lleva la insignia "Suplencia rápida".
 */
export function TarjetaDocente({
  docente: d,
  activas,
  contextoId,
  rapidas,
}: {
  docente: DocenteTarjeta;
  activas: BusquedaInvitable[];
  /** Búsqueda de contexto válida y activa: es a la que invita el botón. */
  contextoId: string | null;
  rapidas: boolean;
}) {
  const info = CATEGORIA_INFO[d.categoria];
  const nombreCompleto = `${d.nombre} ${d.apellido}`.trim();
  const perfilHref = `/institucion/docente/${d.id}?desde=buscador${contextoId ? `&busqueda=${contextoId}` : ""}`;
  const tags = [...d.asignaturas.slice(0, 3), ...d.niveles.slice(0, 1)];
  // "a 5 km" y, cuando la institución tiene varias sedes, de cuál: "a 5 km de Sede Pilar".
  const km = kmLegible(d.distanciaKm);
  const distancia = km && d.sedeCercana ? `${km} de ${d.sedeCercana}` : km;
  const zona = [d.zonas.join(" · "), distancia].filter(Boolean).join(" · ");
  const horario = [
    d.disponibilidad.join(" · "),
    d.aniosExperiencia != null ? `${d.aniosExperiencia} ${d.aniosExperiencia === 1 ? "año" : "años"} de experiencia` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const c = d.coincide;
  const casiTodo = c ? c.cumplidos / c.total >= 5 / 6 : false;

  return (
    <article
      style={{ "--cat": info.color } as React.CSSProperties}
      className={cn(
        "flex h-full flex-col rounded-ud border bg-white p-[18px] transition-[border-color,box-shadow] duration-150",
        "hover:shadow-[0_6px_18px_rgba(31,36,33,.10)]",
        d.urgente
          ? "border-[1.5px] border-naranja"
          : rapidas
            ? "border-[#F2C9BE] hover:border-[var(--cat)]"
            : "border-borde hover:border-[var(--cat)]",
      )}
    >
      {rapidas && (
        <Insignia tono="naranja" className="mb-2.5 gap-[5px] self-start">
          <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9.5V13l2.4 1.6" />
            <path d="M9.6 2.8h4.8" />
          </svg>
          Suplencia rápida
        </Insignia>
      )}

      <div className="mb-2.5 flex gap-3">
        <Avatar
          iniciales={iniciales(nombreCompleto)}
          fotoUrl={d.fotoUrl}
          tamano={44}
          fondo={info.tint}
          texto={info.ink}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[5px] text-sm leading-tight font-semibold">
            <Link href={perfilHref} className="min-w-0 truncate text-tinta hover:text-navy-700 hover:underline">
              {nombreCompleto}
            </Link>
            {d.verificado ? (
              <Verificado categoria={d.categoria} />
            ) : (
              <Insignia className="px-2 py-1 text-[10px]">Sin verificar</Insignia>
            )}
          </div>
          <div className="mt-0.5 text-xs leading-snug text-apagado">{d.subtitulo ?? info.label}</div>
        </div>
        <BotonFavoritoDocente docenteId={d.id} nombre={nombreCompleto} favorito={d.favorito} />
      </div>

      {(d.estudiante || tags.length > 0) && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {d.estudiante && <Insignia tono="azul">{etiquetaDeEstudiante(d.estudiante.porcentaje)}</Insignia>}
          {tags.map((t) => (
            <Insignia key={t}>{t}</Insignia>
          ))}
        </div>
      )}

      <div className="mb-2.5 text-xs leading-normal text-apagado">
        <div>{zona || "Zona sin declarar"}</div>
        <div>{horario || "Disponibilidad sin declarar"}</div>
      </div>

      {c && (
        <div
          title={c.detalle.map((x) => `${x.etiqueta}: ${x.cumple ? "sí" : "no"}`).join(" · ")}
          className={cn(
            "mb-3.5 flex items-center gap-1.5 rounded-lg bg-[#F5F5F1] px-2.5 py-2 text-xs leading-none font-medium",
            casiTodo ? "text-verde" : "text-apagado",
          )}
        >
          ★ Coincide en {c.cumplidos} de {c.total} criterios
        </div>
      )}

      <div className="mt-auto flex gap-2 max-[1100px]:flex-wrap">
        <BotonLink href={perfilHref} variante="secundario" tamano="sm" className="flex-1">
          Ver perfil
        </BotonLink>
        <BotonInvitarDocente
          docenteId={d.id}
          nombre={nombreCompleto}
          opciones={opcionesDeInvitacion(activas, d.relaciones)}
          contextoId={contextoId}
          className="flex-1"
        />
      </div>
    </article>
  );
}
