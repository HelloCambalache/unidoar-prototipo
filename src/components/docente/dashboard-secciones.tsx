import Link from "next/link";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { InstitucionLogo } from "@/components/docente/instituciones-logo";
import { CursoFoto } from "@/components/docente/curso-foto";
import { AnilloMatch } from "@/components/app/anillo-match";
import { Icono } from "@/components/icons";
import { kmLegible } from "@/lib/geo";
import type { pendientesDePerfil } from "@/lib/perfil";
import type {
  FilaPostulacion,
  TarjetaCursoDestacado,
  TarjetaInstitucionDestacada,
  TarjetaOferta,
} from "@/lib/queries/docente";
import { cn } from "@/lib/utils";

const CUADRICULA =
  "grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 max-[560px]:grid-cols-1";

const TARJETA_ENLACE =
  "group flex flex-col rounded-tarjeta bg-white shadow-tarjeta transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-tarjeta-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30";

/** Pie de las tarjetas: la acción en negrita, el dato debajo y el cuadradito con la flecha. */
function PieTarjeta({ accion, dato }: { accion: string; dato: string }) {
  return (
    <div className="mt-auto flex items-center gap-3 px-3.5 pt-3.5 pb-2">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-display text-[15px] leading-tight font-semibold text-tinta">{accion}</span>
        <span className="truncate text-[12.5px] leading-tight text-apagado">{dato}</span>
      </span>
      <span
        aria-hidden
        className="inline-flex size-11 flex-none items-center justify-center rounded-xl bg-lienzo text-tinta transition-colors group-hover:bg-navy-900 group-hover:text-white"
      >
        <Icono nombre="flecha" tamano={18} trazo={2} />
      </span>
    </div>
  );
}

/** Título de sección del tablero con su "Ver todas" a la derecha y una bajada. */
export function SeccionTablero({
  titulo,
  bajada,
  enlace,
  children,
  className,
}: {
  titulo: string;
  bajada: string;
  enlace?: { href: string; texto: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)}>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-1.5">
        <h2 className="font-display m-0 text-[22px] leading-[1.2] font-semibold tracking-[-0.015em] text-navy-900">
          {titulo}
        </h2>
        {enlace && (
          <Link href={enlace.href} className="text-sm leading-none font-semibold text-rosa hover:underline">
            {enlace.texto}
          </Link>
        )}
      </div>
      <p className="mb-4 text-sm leading-normal text-apagado">{bajada}</p>
      {children}
    </section>
  );
}

export function CuadriculaTarjetas({ children }: { children: React.ReactNode }) {
  return <div className={CUADRICULA}>{children}</div>;
}

export function TarjetaOfertaRecomendada({ o }: { o: TarjetaOferta }) {
  const lugar = [o.zona, kmLegible(o.km)].filter(Boolean).join(" · ");
  return (
    <Link href={`/docente/oferta/${o.id}`} className={cn(TARJETA_ENLACE, "p-2")}>
      <div className="flex flex-1 flex-col gap-4 rounded-interno bg-lienzo p-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <InstitucionLogo nombre={o.institucion} logoUrl={o.logoUrl} />
            <div className="font-display text-[18px] leading-[1.25] font-semibold tracking-[-0.01em] text-tinta">
              {o.puesto}
            </div>
            <div className="text-[13px] leading-[1.35] text-tinta-2">{o.institucion}</div>
          </div>
          <AnilloMatch porcentaje={o.porcentaje} />
        </div>
        {o.motivos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {o.motivos.map((m) => (
              <span
                key={m}
                className="inline-flex h-8 items-center rounded-full border border-linea bg-white px-3 text-[12.5px] font-medium text-tinta-2"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
      <PieTarjeta accion="Ver oferta" dato={lugar || "Zona a confirmar"} />
    </Link>
  );
}

export function TarjetaInstitucionDestacada({ i }: { i: TarjetaInstitucionDestacada }) {
  return (
    <Link href={`/docente/instituciones/${i.slug}`} className={cn(TARJETA_ENLACE, "p-2")}>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center gap-3">
          <InstitucionLogo nombre={i.nombre} logoUrl={i.logoUrl} tamano={44} />
          <div className="min-w-0">
            <div className="font-display text-[15.5px] leading-[1.3] font-semibold text-tinta">{i.nombre}</div>
            <div className="text-[12.5px] leading-[1.35] text-apagado">{[i.tipo, i.zona].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        {i.resumen && <div className="text-[13px] leading-normal text-tinta-2">{i.resumen}</div>}
        <Insignia tono="verde" className="self-start text-[11.5px]">
          {i.busquedasActivas === 1 ? "1 búsqueda abierta" : `${i.busquedasActivas} búsquedas abiertas`}
        </Insignia>
      </div>
      <PieTarjeta accion="Ver perfil" dato={i.zona ?? i.tipo} />
    </Link>
  );
}

export function TarjetaCursoDestacado({ c }: { c: TarjetaCursoDestacado }) {
  return (
    <Link href={`/docente/cursos?curso=${c.id}`} className={cn(TARJETA_ENLACE, "p-2")}>
      <div className="relative overflow-hidden rounded-interno">
        <CursoFoto url={c.fotoUrl} altura={128} />
        <Insignia tono={c.modalidad === "Online" ? "azul" : "neutro"} className="absolute top-2.5 left-2.5">
          {c.modalidad}
        </Insignia>
      </div>
      <div className="flex flex-col gap-0.5 px-3 pt-3">
        <div className="font-display text-[15.5px] leading-[1.3] font-semibold text-tinta">{c.titulo}</div>
        {c.subtitulo && <div className="text-[12.5px] leading-[1.35] text-apagado">{c.subtitulo}</div>}
      </div>
      <PieTarjeta accion="Ver curso" dato={c.fechas} />
    </Link>
  );
}

/** "Tus postulaciones": las últimas tres, con el estado como lo ve el docente. */
export function ResumenPostulaciones({ filas }: { filas: FilaPostulacion[] }) {
  return (
    <section className="mt-8 rounded-panel bg-white p-6 shadow-tarjeta">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <h2 className="font-display m-0 text-[18px] leading-[1.2] font-semibold text-navy-900">Tus postulaciones</h2>
        <Link href="/docente/postulaciones" className="text-[13px] leading-none font-medium text-rosa hover:underline">
          Ver todas
        </Link>
      </div>
      <ul className="m-0 list-none p-0">
        {filas.map((f) => (
          <li key={f.id} className="flex items-center gap-3.5 border-b border-borde py-3.5 last:border-b-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="text-sm leading-[1.3] font-semibold">{f.puesto}</div>
              <div className="mt-0.5 text-[12.5px] leading-[1.4] text-apagado">
                {f.institucion} · {f.invitada ? "invitada" : "postulada"} el {f.creadaEl}
              </div>
            </div>
            <Insignia tono={f.estado.tono}>{f.estado.texto}</Insignia>
            <Link
              href={`/docente/postulaciones?abrir=${f.id}`}
              className="text-[13px] leading-none font-medium whitespace-nowrap text-rosa hover:underline"
            >
              Ver
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function minuscula(t: string) {
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** La tarjeta rosa "Completá tu perfil" con el porcentaje y lo que falta de verdad. */
export function TarjetaCompletaPerfil({ perfil }: { perfil: ReturnType<typeof pendientesDePerfil> }) {
  const { pendientes, porcentaje } = perfil;
  if (pendientes.length === 0) return null;

  const faltan = pendientes.map((p) => minuscula(p.etiqueta));
  const texto =
    faltan.length === 1
      ? `Te falta ${faltan[0]}.`
      : faltan.length === 2
        ? `Te faltan dos cosas: ${faltan[0]} y ${faltan[1]}.`
        : `Te faltan ${faltan.length} cosas: ${faltan[0]}, ${faltan[1]} y ${faltan.length - 2 === 1 ? "1 más" : `${faltan.length - 2} más`}.`;
  const sinFoto = pendientes.some((p) => p.clave === "foto");

  return (
    <div className="mb-8 flex flex-wrap items-center gap-6 rounded-panel bg-white px-7 py-6 shadow-tarjeta">
      <AnilloMatch porcentaje={porcentaje} tamano={84} fondo="var(--color-rosa-tint)" className="[&>span]:text-[18px]" />
      <div className="min-w-0 flex-[1_1_320px]">
        <div className="font-display mb-1.5 text-[19px] leading-tight font-semibold text-navy-900">Completá tu perfil</div>
        <div
          role="progressbar"
          aria-label="Perfil completo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentaje}
          className="mb-2.5 h-1.5 max-w-[420px] overflow-hidden rounded-full bg-rosa-suave"
        >
          <div className="h-1.5 rounded-full bg-rosa" style={{ width: `${porcentaje}%` }} />
        </div>
        <div className="text-sm leading-normal text-apagado">
          {texto}
          {sinFoto && " Los perfiles con foto reciben el doble de invitaciones."}
        </div>
      </div>
      <BotonLink href="/docente/perfil" className="flex-none rounded-full bg-rosa hover:bg-[#7A0F4D]">
        Completar perfil
      </BotonLink>
    </div>
  );
}
