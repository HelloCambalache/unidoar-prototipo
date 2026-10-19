import Image from "next/image";
import Link from "next/link";
import { NodosMarca } from "@/components/app/nodos-marca";
import { Icono, type IconoClave } from "@/components/icons";
import { BotonLink } from "@/components/ui/button";
import type { CategoriaDocente } from "@/db/schema";
import { CATEGORIAS, CATEGORIA_INFO } from "@/lib/catalogo";
import { focoDeFoto } from "@/lib/fotos";
import { num, PAGINA_TESTIMONIOS, RUTA_REGISTRO_DOCENTE } from "@/lib/publico";
import { RUTA_PUBLICAR_BUSQUEDA, RUTA_PUBLICAR_URGENTE } from "@/lib/publicar-busqueda";
import {
  busquedasUrgentes,
  cuposFundadorRestantes,
  resumenPublico,
  testimoniosDe,
} from "@/lib/queries/publico";
import { BandaFundador } from "./banda-fundador";
import { CarruselTestimonios } from "./carrusel-testimonios";
import { CATEGORIAS_PUBLICAS, estiloBotonAcento, estiloCategoria } from "./categorias";
import { ListaUrgentes } from "./lista-urgentes";
import { sesionPublica } from "./sesion";

const TILE_DATO = "flex flex-col justify-center rounded-tarjeta p-[22px]";
const CIFRA = "font-display text-[32px] leading-none font-semibold tracking-[-0.03em]";
const ETIQUETA_SECCION = "text-xs leading-none font-semibold tracking-[.09em] uppercase";

/** Lo que se dice en la sección "Por qué UNIDOAR" cuando la categoría no trae sus propios puntos. */
const PUNTOS_POR_DEFECTO = [
  "Catálogo propio de tu zona con perfiles verificados.",
  "Suscripción mensual: todas las búsquedas del año.",
];

/** Columnas del escritorio según cuántos puntos hay (Tailwind necesita las clases escritas completas). */
const COLUMNAS_PUNTOS: Record<number, string> = { 1: "min-[901px]:grid-cols-1", 2: "min-[901px]:grid-cols-2", 3: "min-[901px]:grid-cols-3" };

/** Landing de una categoría (/educadores, /entrenadores, /guardavidas): mismo molde, distinto color y copy. */
export async function LandingCategoria({ categoria }: { categoria: CategoriaDocente }) {
  const pub = CATEGORIAS_PUBLICAS[categoria];
  const info = CATEGORIA_INFO[categoria];

  const [resumen, urgentes, testimonios, cupos, sesion] = await Promise.all([
    resumenPublico(),
    busquedasUrgentes({ categoria, limite: 3 }),
    testimoniosDe(PAGINA_TESTIMONIOS[categoria]),
    cuposFundadorRestantes(),
    sesionPublica(),
  ]);
  const n = resumen.categorias[categoria];
  const puntos = pub.bandaPuntos ?? PUNTOS_POR_DEFECTO;

  const cifras: { valor: string; etiqueta: string; icono: IconoClave }[] = [
    { valor: num(n.verificados), etiqueta: n.verificados === 1 ? pub.verificados[0] : pub.verificados[1], icono: "equipo" },
    {
      valor: num(n.busquedasActivas),
      etiqueta: n.busquedasActivas === 1 ? "búsqueda activa ahora" : "búsquedas activas ahora",
      icono: "reloj",
    },
    {
      valor: num(n.institucionesBuscando),
      etiqueta: n.institucionesBuscando === 1 ? "institución buscando" : "instituciones buscando",
      icono: "instituciones",
    },
  ];

  return (
    <div style={estiloCategoria(categoria)}>
      {/* 1296 = los 1200 de contenido de la banda final + sus 48 px de borde a cada lado: todo queda alineado. */}
      <div className="mx-auto flex w-full max-w-[1296px] flex-col gap-6 px-12 pt-8 max-[900px]:px-6 max-[560px]:gap-5 max-[560px]:px-4 max-[560px]:pt-5">
        <nav aria-label="Categorías" className="flex flex-wrap gap-2.5">
          {CATEGORIAS.map((c) => {
            const activa = c === categoria;
            return (
              <Link
                key={c}
                href={CATEGORIAS_PUBLICAS[c].ruta}
                aria-current={activa ? "page" : undefined}
                style={activa ? estiloBotonAcento(c) : undefined}
                className={
                  "rounded-full px-[18px] py-2.5 text-[13px] leading-none font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none " +
                  (activa ? "" : "bg-white text-tinta-2 shadow-tarjeta hover:bg-navy-50 hover:text-navy-700")
                }
              >
                {CATEGORIAS_PUBLICAS[c].nombre}
              </Link>
            );
          })}
        </nav>

        {/* Hero */}
        <section className="relative isolate overflow-hidden rounded-marco bg-navy-900 text-white">
          <Image
            src={pub.fotoHero}
            alt=""
            fill
            priority
            sizes="(max-width: 1200px) 100vw, 1200px"
            style={{ objectPosition: focoDeFoto(pub.fotoHero) }}
            className="-z-10 object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(4,11,53,.95)_0%,rgba(4,11,53,.86)_36%,rgba(4,11,53,.5)_64%,rgba(4,11,53,.28)_100%)] max-[900px]:bg-[linear-gradient(180deg,rgba(4,11,53,.8),rgba(4,11,53,.96))]"
          />
          <NodosMarca className="absolute -top-14 -right-12 -z-10 w-[250px] opacity-70 max-[900px]:w-[150px] max-[900px]:opacity-40 max-[560px]:hidden" />

          <div className="grid grid-cols-[minmax(0,1fr)_340px] items-center gap-12 px-12 py-14 max-[960px]:grid-cols-1 max-[960px]:gap-9 max-[900px]:px-6 max-[900px]:py-10">
            <div>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5">
                <span aria-hidden className="size-[7px] flex-none rounded-full bg-(--acento)" />
                <span className="text-xs leading-[1.4] font-semibold tracking-[.06em] text-white/90 uppercase">{pub.eyebrow}</span>
              </span>
              <h1 className="font-display m-0 mb-[18px] text-[44px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance max-[900px]:text-[34px] max-[560px]:text-[28px]">
                {pub.titular}
              </h1>
              <p className="m-0 mb-6 max-w-[52ch] text-[17px] leading-[1.6] text-white/80 max-[560px]:text-[16px]">{pub.bajada}</p>
              <ul className="m-0 mb-7 flex list-none flex-wrap gap-2 p-0">
                {pub.chips.map((chip) => (
                  <li
                    key={chip}
                    className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs leading-none font-semibold text-white/90"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 max-[560px]:[&>a]:w-full">
                <BotonLink
                  href={RUTA_PUBLICAR_BUSQUEDA}
                  variante="cta"
                  tamano="lg"
                  style={estiloBotonAcento(categoria)}
                  className="hover:brightness-95 max-[560px]:py-3.5 max-[560px]:leading-snug max-[560px]:whitespace-normal max-[560px]:text-center"
                >
                  {pub.cta}
                </BotonLink>
                <BotonLink
                  href="/contacto"
                  variante="secundario"
                  tamano="lg"
                  className="border-white/35 bg-transparent text-white hover:border-white/60 hover:bg-white/10 hover:text-white"
                >
                  Hablar con un socio
                </BotonLink>
              </div>
            </div>

            <aside aria-label="La red en números" className="rounded-tarjeta bg-white p-6 text-tinta shadow-[0_18px_44px_rgba(2,4,45,.35)]">
              <ul className="m-0 flex list-none flex-col p-0">
                {cifras.map((c, i) => (
                  <li key={c.etiqueta} className={"flex items-center gap-4 py-4 first:pt-0 " + (i > 0 ? "border-t border-linea" : "")}>
                    <span
                      aria-hidden
                      style={{ background: info.tint, color: info.ink }}
                      className="flex size-12 flex-none items-center justify-center rounded-caja"
                    >
                      <Icono nombre={c.icono} tamano={20} trazo={2} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-[30px] leading-none font-semibold tracking-[-0.03em] text-navy-900">{c.valor}</div>
                      <p className="m-0 mt-1 text-[13.5px] leading-snug text-apagado">{c.etiqueta}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {/* No se muestran personas: nadie aceptó aparecer en una página pública. Solo se cuenta cuántas hay. */}
              <p className="m-0 border-t border-linea pt-4 text-[13px] leading-normal text-apagado">
                Las instituciones con cuenta ven los perfiles verificados: identidad y título revisados por el equipo.{" "}
                <Link href={RUTA_REGISTRO_DOCENTE} className="font-semibold text-navy-700 underline">
                  Sumate como profesional
                </Link>
                .
              </p>
            </aside>
          </div>
        </section>

        {/* Por qué UNIDOAR */}
        <section aria-labelledby="por-que" className="rounded-tarjeta bg-white p-10 shadow-tarjeta max-[560px]:p-6">
          <span className={`${ETIQUETA_SECCION} mb-3.5 block text-(color:--acento-tinta)`}>Por qué UNIDOAR</span>
          <h2
            id="por-que"
            className="font-display m-0 mb-7 max-w-[36ch] text-[28px] leading-[1.2] font-semibold tracking-[-0.02em] text-balance text-tinta max-[560px]:text-[23px]"
          >
            {pub.bandaTitulo}
          </h2>
          <ul className={`m-0 grid list-none grid-cols-1 gap-3 p-0 ${COLUMNAS_PUNTOS[puntos.length] ?? "min-[901px]:grid-cols-3"}`}>
            {puntos.map((punto) => (
              <li key={punto} className="flex items-start gap-3 rounded-interno bg-lienzo px-[18px] py-4 text-[15px] leading-[1.55] text-tinta-2">
                <span
                  aria-hidden
                  style={{ background: info.tint, color: info.ink }}
                  className="mt-px flex size-6 flex-none items-center justify-center rounded-full"
                >
                  <Icono nombre="tilde" tamano={14} trazo={2.8} />
                </span>
                {punto}
              </li>
            ))}
          </ul>
        </section>

        {/* Búsquedas urgentes */}
        <section aria-labelledby="urgentes" className="pt-6 max-[560px]:pt-3">
          <div className="mb-3.5 flex items-center gap-[9px]">
            <span aria-hidden className="pub-pulso size-[9px] rounded-full bg-(--acento)" />
            <span className={`${ETIQUETA_SECCION} text-(color:--acento-tinta)`}>Búsquedas urgentes</span>
          </div>
          <h2
            id="urgentes"
            className="font-display m-0 mb-3 max-w-[22ch] text-[34px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance text-navy-900 max-[900px]:max-w-none max-[560px]:text-[26px]"
          >
            {pub.urgente.titulo}
          </h2>
          <p className="m-0 mb-7 max-w-[620px] text-base leading-[1.6] text-apagado">{pub.urgente.bajada}</p>

          <div className="grid auto-rows-[150px] grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1 max-[560px]:gap-3">
            <div
              style={{ background: info.color, color: pub.sobreAcento.texto }}
              className="relative col-span-2 row-span-2 flex flex-col justify-between overflow-hidden rounded-tarjeta p-8 max-[560px]:col-span-1 max-[560px]:p-6"
            >
              <span
                aria-hidden
                style={{ backgroundImage: `url(${pub.fotoUrgente})`, backgroundPosition: focoDeFoto(pub.fotoUrgente) }}
                className="absolute inset-0 bg-cover opacity-[.22]"
              />
              <div className="relative">
                <span className="inline-flex rounded-full bg-white/30 px-2.5 py-[5px] text-[11px] leading-none font-semibold">
                  Suplencia rápida
                </span>
                <div className="font-display mt-3.5 text-2xl leading-[1.2] font-semibold tracking-[-0.02em]">
                  {pub.urgente.tarjetaTitulo}
                </div>
                <p className="mt-2 max-w-[32ch] text-[14.5px] leading-[1.55] opacity-90">{pub.urgente.tarjetaTexto}</p>
              </div>
              <Link
                href={RUTA_PUBLICAR_URGENTE}
                style={{ background: pub.sobreAcento.botonFondo, color: pub.sobreAcento.botonTexto }}
                className="relative inline-flex h-11 min-h-11 items-center self-start rounded-full px-6 text-sm leading-none font-semibold transition-[filter] hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-white/60 focus-visible:outline-none"
              >
                Publicar una suplencia
              </Link>
            </div>

            <div className={`${TILE_DATO} bg-white shadow-tarjeta`}>
              <div className={`${CIFRA} text-navy-900`}>2 min</div>
              <div className="mt-[7px] text-[13px] leading-[1.4] font-medium text-apagado">publicar la búsqueda</div>
            </div>
            <div style={{ background: info.color, color: pub.sobreAcento.texto }} className={TILE_DATO}>
              <div className={CIFRA}>{num(n.urgentes)}</div>
              <div className="mt-[7px] text-[13px] leading-[1.4] font-medium opacity-90">
                {n.urgentes === 1 ? "urgente abierta ahora" : "urgentes abiertas ahora"}
              </div>
            </div>
            <div className={`${TILE_DATO} bg-white shadow-tarjeta`}>
              <div className={`${CIFRA} text-navy-900`}>24/7</div>
              <div className="mt-[7px] text-[13px] leading-[1.4] font-medium text-apagado">catálogo activo</div>
            </div>
            <div className={`${TILE_DATO} bg-navy-900`}>
              <div className={`${CIFRA} text-white`}>0</div>
              <div className="mt-[7px] text-[13px] leading-[1.4] font-medium text-white/70">comisión por contratar</div>
            </div>
          </div>

          <h3 className="font-display mt-10 mb-4 text-xl leading-tight font-semibold tracking-[-0.015em] text-tinta">Abiertas ahora</h3>
          <ListaUrgentes busquedas={urgentes} sesion={sesion} />
        </section>
      </div>

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
