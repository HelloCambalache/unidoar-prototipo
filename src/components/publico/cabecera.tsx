import Link from "next/link";
import { BotonLink } from "@/components/ui/button";
import { CATEGORIAS } from "@/lib/catalogo";
import { CATEGORIAS_PUBLICAS, estiloCategoria } from "./categorias";
import { MenuMovil } from "./menu-movil";
import { ENLACES_PRINCIPALES } from "./navegacion";
import { sesionPublica } from "./sesion";

const ENLACE =
  "rounded-md text-sm font-medium text-white/75 transition-colors hover:text-celeste focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste";

/** Cabecera del sitio público: navegación, categorías en desplegable y acceso según haya sesión o no. */
export async function CabeceraPublica() {
  const conSesion = (await sesionPublica()).rol !== null;

  return (
    <header className="relative z-40 flex h-[72px] items-center justify-between bg-navy-900 px-12 max-[760px]:px-6">
      <Link
        href="/"
        aria-label="UNIDOAR, ir al inicio"
        className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- logo fijo, el ancho depende de la proporción */}
        <img src="/assets/unidoar-logo-horizontal.png" alt="UNIDOAR" className="h-14 w-auto object-contain max-[560px]:h-10" />
      </Link>

      <nav aria-label="Principal" className="hidden items-center gap-7 min-[761px]:flex">
        <div className="group relative -mb-3.5 pb-3.5">
          <Link href="/categorias" className={ENLACE}>
            Buscá profesionales
          </Link>
          <div className="invisible absolute top-full left-1/2 z-50 min-w-[190px] -translate-x-1/2 rounded-[10px] border border-borde bg-white p-2 opacity-0 shadow-dropdown transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
            {CATEGORIAS.map((c) => (
              <Link
                key={c}
                href={CATEGORIAS_PUBLICAS[c].ruta}
                style={estiloCategoria(c)}
                className="block rounded-[7px] px-3.5 py-2.5 text-sm leading-none font-medium text-tinta transition-colors hover:bg-(--acento-claro) hover:text-(color:--acento-tinta) focus-visible:bg-(--acento-claro) focus-visible:outline-none"
              >
                {CATEGORIAS_PUBLICAS[c].nombre}
              </Link>
            ))}
          </div>
        </div>
        {ENLACES_PRINCIPALES.map((e) => (
          <Link key={e.href} href={e.href} className={ENLACE}>
            {e.etiqueta}
          </Link>
        ))}
      </nav>

      <div className="hidden items-center gap-2.5 min-[761px]:flex">
        {conSesion ? (
          <BotonLink href="/inicio" variante="cta">
            Ir a mi panel
          </BotonLink>
        ) : (
          <>
            <Link href="/ingresar" className={`${ENLACE} px-3 py-2 hover:text-white`}>
              Ingresar
            </Link>
            <BotonLink href="/registro" variante="cta">
              Crear cuenta
            </BotonLink>
          </>
        )}
      </div>

      <MenuMovil conSesion={conSesion} />
    </header>
  );
}
