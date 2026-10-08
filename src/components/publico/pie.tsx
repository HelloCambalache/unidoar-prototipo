import Link from "next/link";
import { CATEGORIAS } from "@/lib/catalogo";
import { CATEGORIAS_PUBLICAS } from "./categorias";

const ENLACE =
  "rounded text-[13px] leading-none text-white/65 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste";

const TITULO = "mb-4 text-xs leading-none font-semibold tracking-[.08em] text-white/40 uppercase";

/** Pie del sitio público (port de Footer.dc.html). */
export function PiePublico() {
  return (
    <footer className="bg-tinta px-6 pt-14 pb-[26px]">
      <div className="mx-auto mb-9 grid max-w-[1200px] grid-cols-[1.4fr_1fr_1fr_1fr] gap-8 max-[760px]:grid-cols-2 max-[460px]:grid-cols-1">
        <div>
          <Link href="/" aria-label="UNIDOAR, ir al inicio" className="mb-3.5 inline-block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo fijo, el ancho depende de la proporción */}
            <img src="/assets/unidoar-logo-horizontal.png" alt="UNIDOAR" className="h-[34px] w-auto object-contain" />
          </Link>
          <p className="m-0 max-w-[26ch] text-[13px] leading-[1.6] text-white/55">
            Red y conexión educativa: docentes verificados de tu zona, sin comisión por contratación.
          </p>
        </div>
        <nav aria-label="Categorías">
          <div className={TITULO}>Categorías</div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {CATEGORIAS.map((c) => (
              <li key={c}>
                <Link href={CATEGORIAS_PUBLICAS[c].ruta} className={ENLACE}>
                  {CATEGORIAS_PUBLICAS[c].nombre}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Producto">
          <div className={TITULO}>Producto</div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            <li>
              <Link href="/#como-funciona" className={ENLACE}>
                Cómo funciona
              </Link>
            </li>
            <li>
              <Link href="/planes" className={ENLACE}>
                Planes
              </Link>
            </li>
            <li>
              <Link href="/quienes-somos" className={ENLACE}>
                Nosotros
              </Link>
            </li>
            <li>
              <Link href="/contacto" className={ENLACE}>
                Contacto
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Buscar">
          <div className={TITULO}>Explorar</div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            <li>
              <Link href="/buscar-trabajo" className={ENLACE}>
                Buscar trabajo
              </Link>
            </li>
            <li>
              <Link href="/instituciones" className={ENLACE}>
                Instituciones
              </Link>
            </li>
            <li>
              <Link href="/categorias" className={ENLACE}>
                Buscá profesionales
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-4 border-t border-white/12 pt-[18px] text-xs leading-none text-white/45">
        <span>© {new Date().getFullYear()} UNIDOAR. Todos los derechos reservados.</span>
        <div className="flex gap-5">
          <Link href="/terminos" className="hover:text-white focus-visible:text-white">
            Términos
          </Link>
          <Link href="/privacidad" className="hover:text-white focus-visible:text-white">
            Privacidad
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-[22px] max-w-[1200px] border-t border-white/8 pt-[18px] text-center">
        <a
          href="https://cambalache.studio"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 text-[12.5px] leading-none text-white/45 transition-colors hover:text-white/85"
        >
          Construido por Cambalache Studio
          <span aria-hidden className="text-[13px] text-naranja">
            ❤
          </span>
        </a>
      </div>
    </footer>
  );
}
