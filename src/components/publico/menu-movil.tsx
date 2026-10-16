"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icono } from "@/components/icons";
import { BotonLink } from "@/components/ui/button";
import { CATEGORIAS } from "@/lib/catalogo";
import { CATEGORIAS_PUBLICAS } from "./categorias";
import { ENLACES_PRINCIPALES } from "./navegacion";

/**
 * Hamburguesa de la cabecera pública (por debajo de 1100px). Va dentro del <header>, que es
 * `relative`: el panel se despliega justo debajo ocupando todo el ancho.
 */
export function MenuMovil({ conSesion }: { conSesion: boolean }) {
  const pathname = usePathname();
  // Queda abierto solo en la ruta donde se abrió: al navegar se cierra solo.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const abierto = abiertoEn === pathname;

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbiertoEn(null);
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  const enlace =
    "block rounded-md py-2 text-[15px] font-medium text-white/85 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste";

  return (
    <>
      <button
        type="button"
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={abierto}
        aria-controls="menu-movil-publico"
        onClick={() => setAbiertoEn(abierto ? null : pathname)}
        className="inline-flex size-11 items-center justify-center rounded-md text-white hover:text-celeste focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste min-[1101px]:hidden"
      >
        <Icono nombre={abierto ? "cerrar" : "menu"} tamano={24} trazo={2} />
      </button>
      {abierto && (
        <nav
          id="menu-movil-publico"
          aria-label="Menú principal"
          className="absolute inset-x-0 top-full z-50 flex flex-col gap-1 border-t border-white/10 bg-navy-900 px-6 pt-3 pb-6 shadow-[0_16px_30px_rgba(2,4,45,.4)] min-[1101px]:hidden"
        >
          {CATEGORIAS.map((c) => (
            <Link key={c} href={CATEGORIAS_PUBLICAS[c].ruta} className={enlace}>
              {CATEGORIAS_PUBLICAS[c].nombre}
            </Link>
          ))}
          {ENLACES_PRINCIPALES.map((e) => (
            <Link key={e.href} href={e.href} className={enlace}>
              {e.etiqueta}
            </Link>
          ))}
          <div className="mt-3 flex flex-col gap-3">
            {conSesion ? (
              <BotonLink href="/inicio" variante="cta" bloque className="rounded-full">
                Ir a mi panel
              </BotonLink>
            ) : (
              <>
                <Link href="/ingresar" className={enlace}>
                  Ingresar
                </Link>
                <BotonLink href="/registro" variante="cta" bloque className="rounded-full">
                  Crear cuenta
                </BotonLink>
              </>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
