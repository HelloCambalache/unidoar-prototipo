import Link from "next/link";
import { Icono } from "@/components/icons";
import { BotonLink } from "@/components/ui/button";
import { Avatar, Insignia } from "@/components/ui/insignia";
import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIAS, CATEGORIA_INFO } from "@/lib/catalogo";
import {
  num,
  PAGINA_TESTIMONIOS,
  RUTA_REGISTRO_DOCENTE,
  RUTA_REGISTRO_INSTITUCION,
} from "@/lib/publico";
import {
  busquedasUrgentes,
  cuposFundadorRestantes,
  perfilesDestacados,
  resumenPublico,
  testimoniosDe,
  type PerfilDestacado,
} from "@/lib/queries/publico";
import { iniciales } from "@/lib/utils";
import { BandaFundador } from "./banda-fundador";
import { CarruselTestimonios } from "./carrusel-testimonios";
import { CATEGORIAS_PUBLICAS, estiloBotonAcento, estiloCategoria } from "./categorias";
import { FilaEstadisticas } from "./fila-estadisticas";
import { Imagen } from "./imagen";
import { ListaUrgentes } from "./lista-urgentes";
import { sesionPublica } from "./sesion";

const TILE_DATO = "flex flex-col justify-center rounded-[18px] border p-[22px]";
const CIFRA = "font-display text-[32px] leading-none font-bold tracking-[-0.03em]";

/** Landing de una categoría (/educadores, /entrenadores, /guardavidas): mismo molde, distinto color y copy. */
export async function LandingCategoria({ categoria }: { categoria: CategoriaDocente }) {
  const pub = CATEGORIAS_PUBLICAS[categoria];
  const info = CATEGORIA_INFO[categoria];

  const [resumen, perfiles, urgentes, testimonios, cupos, sesion] = await Promise.all([
    resumenPublico(),
    perfilesDestacados(categoria, 2),
    busquedasUrgentes({ categoria, limite: 3 }),
    testimoniosDe(PAGINA_TESTIMONIOS[categoria]),
    cuposFundadorRestantes(),
    sesionPublica(),
  ]);
  const n = resumen.categorias[categoria];

  return (
    <div style={estiloCategoria(categoria)}>
      <nav
        aria-label="Categorías"
        className="flex flex-wrap gap-2.5 border-b border-borde bg-superficie px-10 py-3.5 max-[900px]:px-5 max-[900px]:py-3"
      >
        {CATEGORIAS.map((c) => {
          const activa = c === categoria;
          return (
            <Link
              key={c}
              href={CATEGORIAS_PUBLICAS[c].ruta}
              aria-current={activa ? "page" : undefined}
              style={activa ? estiloBotonAcento(c) : undefined}
              className={
                "rounded-full border px-4 py-2 text-[13px] leading-none font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none " +
                (activa
                  ? "border-transparent"
                  : "border-borde bg-white text-tinta-2 hover:bg-superficie hover:text-tinta")
              }
            >
              {CATEGORIAS_PUBLICAS[c].nombre}
            </Link>
          );
        })}
      </nav>

      {/* Hero */}
      <section className="relative min-h-[540px] overflow-hidden px-10 pt-[60px] pb-[90px] max-[900px]:min-h-0 max-[900px]:px-5 max-[900px]:pt-11 max-[900px]:pb-14">
        <div
          aria-hidden
          style={{ backgroundImage: `url("${pub.fotoHero}")` }}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#fff_0%,rgba(255,255,255,.88)_30%,rgba(255,255,255,.45)_52%,rgba(255,255,255,0)_78%)] max-[900px]:bg-[linear-gradient(180deg,rgba(255,255,255,.96)_0%,rgba(255,255,255,.93)_55%,rgba(255,255,255,.7)_100%)]"
        />
        <div className="relative z-[1] max-w-[calc(100%-460px)] max-[900px]:max-w-full">
          <div className="mb-5 flex items-center gap-[9px]">
            <span aria-hidden className="size-[7px] rounded-full bg-(--acento)" />
            <span className="text-xs leading-none font-semibold tracking-[.09em] text-(color:--acento-tinta) uppercase">
              {pub.eyebrow}
            </span>
          </div>
          <h1 className="mb-[18px] text-[46px] leading-[1.1] font-semibold tracking-[-0.026em] text-balance text-tinta max-[900px]:text-[34px] max-[560px]:text-[27px]">
            {pub.titular}
          </h1>
          <p className="mb-[22px] max-w-[50ch] text-[17px] leading-[1.6] text-tinta-2">{pub.bajada}</p>
          <ul className="mb-[26px] flex list-none flex-wrap gap-2 p-0">
            {pub.chips.map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-borde bg-white px-3.5 py-1.5 text-xs leading-none font-semibold text-tinta-2"
              >
                {chip}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 max-[900px]:[&>a]:min-w-[210px] max-[900px]:[&>a]:flex-1">
            <BotonLink
              href={RUTA_REGISTRO_INSTITUCION}
              variante="cta"
              tamano="lg"
              style={estiloBotonAcento(categoria)}
              className="hover:brightness-95"
            >
              {pub.cta}
            </BotonLink>
            <BotonLink href="/contacto" variante="secundario" tamano="lg">
              Hablar con un socio
            </BotonLink>
          </div>
        </div>

        <aside
          aria-label="Perfiles verificados"
          className="absolute top-1/2 right-10 z-[2] w-[380px] -translate-y-1/2 max-[900px]:relative max-[900px]:top-auto max-[900px]:right-auto max-[900px]:mt-[26px] max-[900px]:w-auto max-[900px]:translate-y-0"
        >
          <div className="rounded-lg border border-borde bg-superficie p-5 shadow-[0_6px_26px_rgba(31,36,33,.07)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-[9px] text-[13px] leading-none font-semibold text-navy-700">
                <Icono nombre="buscar" tamano={15} trazo={1.9} />
                Perfiles verificados
              </div>
              {n.verificados > 0 && (
                <Insignia tono="verde">
                  {num(n.verificados)} en la red
                </Insignia>
              )}
            </div>
            {perfiles.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {perfiles.map((p) => (
                  <PerfilTarjeta key={p.id} perfil={p} />
                ))}
              </ul>
            ) : (
              <p className="text-[13px] leading-normal text-apagado">
                Todavía no hay perfiles verificados en esta categoría.{" "}
                <Link href={RUTA_REGISTRO_DOCENTE} className="font-semibold text-navy-700 underline">
                  Sumate como profesional
                </Link>
                .
              </p>
            )}
          </div>
        </aside>
      </section>

      {/* Banda azul */}
      <section className="bg-navy-700 px-10 py-11 max-[900px]:px-5">
        <div className="mx-auto max-w-[900px]">
          <h2 className="mb-2 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-white max-[560px]:text-[22px]">
            {pub.bandaTitulo}
          </h2>
          <p className="text-[15px] leading-[1.6] text-white/85">
            Catálogo propio de tu zona con perfiles verificados. Suscripción mensual: todas las búsquedas del año.
          </p>
        </div>
      </section>

      <FilaEstadisticas
        items={[
          {
            valor: num(n.verificados),
            etiqueta: n.verificados === 1 ? pub.verificados[0] : pub.verificados[1],
            color: info.ink,
            icono: "equipo",
          },
          {
            valor: num(n.busquedasActivas),
            etiqueta: n.busquedasActivas === 1 ? "búsqueda activa ahora" : "búsquedas activas ahora",
            color: info.ink,
            icono: "reloj",
          },
          {
            valor: num(n.institucionesBuscando),
            etiqueta: n.institucionesBuscando === 1 ? "institución buscando" : "instituciones buscando",
            color: info.ink,
            icono: "instituciones",
          },
        ]}
      />

      {/* Búsquedas urgentes */}
      <section className="relative overflow-hidden border-b border-borde bg-superficie px-12 py-16 max-[900px]:px-6 max-[900px]:py-[52px]">
        <div aria-hidden className="pub-grid-claro pointer-events-none absolute inset-0 opacity-45" />
        <span
          aria-hidden
          style={{ background: `radial-gradient(circle, ${info.color}2e, transparent 70%)` }}
          className="pointer-events-none absolute -bottom-[120px] -left-20 size-[300px] rounded-full"
        />
        <div className="relative mx-auto max-w-[1160px]">
          <div className="mb-3.5 flex items-center gap-[9px]">
            <span aria-hidden className="pub-pulso size-[9px] rounded-full bg-(--acento)" />
            <span className="text-xs leading-none font-semibold tracking-[.09em] text-(color:--acento-tinta) uppercase">
              Búsquedas urgentes
            </span>
          </div>
          <h2 className="mb-3 max-w-[19ch] font-display text-[36px] leading-[1.12] font-bold tracking-[-0.03em] text-balance text-navy-700 max-[900px]:max-w-none max-[900px]:text-[30px]">
            {pub.urgente.titulo}
          </h2>
          <p className="mb-[26px] max-w-[620px] text-base leading-[1.6] text-apagado">{pub.urgente.bajada}</p>

          <div className="grid auto-rows-[150px] grid-cols-4 gap-3.5 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
            <div
              style={{ background: info.color, color: pub.sobreAcento.texto }}
              className="relative col-span-2 row-span-2 flex flex-col justify-between overflow-hidden rounded-[18px] p-7 max-[560px]:col-span-1"
            >
              <span
                aria-hidden
                style={{ backgroundImage: `url(${pub.fotoUrgente})`, backgroundPosition: pub.posicionUrgente }}
                className="absolute inset-0 bg-cover opacity-[.22]"
              />
              <div className="relative">
                <span className="inline-flex rounded-full bg-white/30 px-2.5 py-[5px] text-[11px] leading-none font-semibold">
                  Suplencia rápida
                </span>
                <div className="mt-3.5 font-display text-2xl leading-[1.2] font-bold tracking-[-0.02em]">
                  {pub.urgente.tarjetaTitulo}
                </div>
                <p className="mt-2 max-w-[32ch] text-[14.5px] leading-[1.55] opacity-90">{pub.urgente.tarjetaTexto}</p>
              </div>
              <Link
                href={RUTA_REGISTRO_INSTITUCION}
                style={{ background: pub.sobreAcento.botonFondo, color: pub.sobreAcento.botonTexto }}
                className="relative inline-flex h-10 min-h-10 items-center self-start rounded-full px-[22px] text-sm leading-none font-semibold transition-[filter] hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-white/60 focus-visible:outline-none"
              >
                Publicar una suplencia
              </Link>
            </div>

            <div className={`${TILE_DATO} border-borde bg-white`}>
              <div className={`${CIFRA} text-navy-700`}>2 min</div>
              <div className="mt-[7px] text-[13px] leading-[1.4] font-medium text-apagado">publicar la búsqueda</div>
            </div>
            <div
              style={{ background: info.color, color: pub.sobreAcento.texto }}
              className={`${TILE_DATO} border-transparent`}
            >
              <div className={CIFRA}>{num(n.urgentes)}</div>
              <div className="mt-[7px] text-[13px] leading-[1.4] font-medium opacity-90">
                {n.urgentes === 1 ? "urgente abierta ahora" : "urgentes abiertas ahora"}
              </div>
            </div>
            <div className={`${TILE_DATO} border-borde bg-white`}>
              <div className={`${CIFRA} text-navy-700`}>24/7</div>
              <div className="mt-[7px] text-[13px] leading-[1.4] font-medium text-apagado">catálogo activo</div>
            </div>
            <div className={`${TILE_DATO} border-transparent bg-navy-700`}>
              <div className={`${CIFRA} text-white`}>0</div>
              <div className="mt-[7px] text-[13px] leading-[1.4] font-medium text-white/70">comisión por contratar</div>
            </div>
          </div>

          <h3 className="mt-10 mb-4 text-lg leading-tight font-semibold text-tinta">Abiertas ahora</h3>
          <ListaUrgentes busquedas={urgentes} sesion={sesion} />
        </div>
      </section>

      <CarruselTestimonios
        testimonios={testimonios}
        colorAcento={info.color}
        colorSobreAcento={pub.sobreAcento.texto}
        colorNombre={info.ink}
      />

      <BandaFundador cupos={cupos} categoria={categoria} />
    </div>
  );
}

function PerfilTarjeta({ perfil: p }: { perfil: PerfilDestacado }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-borde bg-white p-3.5">
      {p.fotoUrl ? (
        <Imagen src={p.fotoUrl} alt="" className="size-[42px] flex-none rounded-full object-cover" />
      ) : (
        <Avatar iniciales={iniciales(p.nombre)} tamano={42} />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-tight font-semibold text-tinta">{p.nombre}</div>
        {p.detalle && <div className="mt-[3px] text-xs leading-[1.35] text-apagado">{p.detalle}</div>}
      </div>
    </li>
  );
}
