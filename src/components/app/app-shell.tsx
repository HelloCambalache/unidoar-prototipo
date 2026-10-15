"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icono, type IconoClave } from "@/components/icons";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { marcarLeida, marcarTodasLeidas } from "@/app/actions/notificaciones";
import { estiloNotificacion, type NotificacionVista } from "@/lib/notificaciones";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icono: IconoClave;
  /** Prefijos de ruta que dejan este ítem marcado como activo (además de `href`). */
  tambien?: string[];
};

type Tema = "docente" | "institucion" | "backoffice";

const TEMAS: Record<
  Tema,
  {
    /** Halo de color detrás del logo del menú. */
    halo: string;
    activo: string;
    insignia: string;
    punto: string;
    marcar: string;
    salirHover: string;
    contador: string;
    pestana: string;
  }
> = {
  docente: {
    halo: "bg-rosa-tint",
    activo: "bg-rosa-tint font-semibold text-rosa",
    insignia: "bg-rosa-tint text-rosa hover:bg-rosa-suave",
    punto: "bg-rosa",
    marcar: "text-rosa",
    salirHover: "hover:bg-rosa-tint hover:text-rosa",
    contador: "bg-naranja",
    pestana: "border-rosa text-tinta",
  },
  institucion: {
    halo: "bg-navy-50",
    activo: "bg-navy-50 font-semibold text-navy-700",
    insignia: "bg-navy-50 text-navy-700 hover:bg-navy-100",
    punto: "bg-naranja",
    marcar: "text-naranja",
    salirHover: "hover:bg-naranja-tint hover:text-naranja-ink",
    contador: "bg-naranja",
    pestana: "border-naranja text-tinta",
  },
  backoffice: {
    halo: "bg-lienzo",
    activo: "bg-navy-50 font-semibold text-navy-700",
    insignia: "bg-lienzo text-tinta hover:bg-linea",
    punto: "bg-naranja",
    marcar: "text-naranja",
    salirHover: "hover:bg-naranja-tint hover:text-naranja-ink",
    contador: "bg-naranja",
    pestana: "border-naranja text-tinta",
  },
};

export function AppShell({
  tema,
  nombre,
  iniciales,
  insignia,
  nav,
  navPie = [],
  tarjetaPie,
  notificaciones,
  verTodasHref,
  children,
}: {
  tema: Tema;
  nombre: string;
  iniciales: string;
  insignia: { texto: string; href: string; titulo?: string };
  nav: NavItem[];
  navPie?: NavItem[];
  tarjetaPie?: React.ReactNode;
  /** Sin esto no se muestra la campana (el backoffice no tiene notificaciones). */
  notificaciones?: NotificacionVista[];
  verTodasHref?: string;
  children: React.ReactNode;
}) {
  const t = TEMAS[tema];
  const pathname = usePathname();
  const router = useRouter();

  async function cerrarSesion() {
    await crearClienteNavegador().auth.signOut();
    router.push("/");
    router.refresh();
  }
  // El drawer queda abierto solo en la ruta donde se abrió: al navegar se cierra solo.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const menuAbierto = abiertoEn === pathname;
  const setMenuAbierto = (abrir: boolean | ((previo: boolean) => boolean)) => {
    const siguiente = typeof abrir === "function" ? abrir(menuAbierto) : abrir;
    setAbiertoEn(siguiente ? pathname : null);
  };

  const esActivo = (i: NavItem) =>
    pathname === i.href || pathname.startsWith(i.href + "/") || (i.tambien ?? []).some((p) => pathname.startsWith(p));

  const itemNav = (i: NavItem) => (
    <Link
      key={i.href}
      href={i.href}
      aria-current={esActivo(i) ? "page" : undefined}
      className={cn(
        "flex min-h-[44px] items-center gap-3 rounded-[14px] px-3 text-[14.5px] transition-colors",
        esActivo(i) ? t.activo : "font-medium text-tinta-2 hover:bg-lienzo hover:text-tinta",
      )}
    >
      <Icono nombre={i.icono} tamano={19} trazo={1.8} />
      {i.label}
    </Link>
  );

  return (
    <div className="flex h-screen gap-5 bg-lienzo min-[861px]:p-4">
      {menuAbierto && (
        <div onClick={() => setMenuAbierto(false)} className="fixed inset-0 z-[44] bg-navy-950/35 min-[861px]:hidden" />
      )}
      <aside
        className={cn(
          "relative flex w-[248px] flex-none flex-col gap-1 overflow-y-auto overflow-x-hidden bg-white px-3.5 pt-5 pb-4 min-[861px]:rounded-[28px] min-[861px]:border min-[861px]:border-linea",
          "max-[860px]:fixed max-[860px]:top-0 max-[860px]:bottom-0 max-[860px]:left-0 max-[860px]:z-[45] max-[860px]:rounded-r-[28px] max-[860px]:shadow-[4px_0_24px_rgba(4,11,53,.18)] max-[860px]:transition-transform max-[860px]:duration-200",
          menuAbierto ? "max-[860px]:translate-x-0" : "max-[860px]:-translate-x-full",
        )}
      >
        {/* Halo suave de marca detrás del logo: decorativo. */}
        <span aria-hidden className={cn("pointer-events-none absolute -top-24 -left-16 h-52 w-64 rounded-full opacity-70 blur-[48px]", t.halo)} />
        <Link href="/" className="relative mb-4 flex items-center gap-2.5 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- isotipo fijo */}
          <img src="/assets/unidoar-logo.png" alt="" className="size-9 object-contain" />
          <span className="font-display text-[17px] font-semibold tracking-[0.08em] text-navy-900">UNIDOAR</span>
        </Link>
        <span className="relative px-3 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-apagado">PRINCIPAL</span>
        <nav aria-label="Menú principal" className="relative flex flex-col gap-1">
          {nav.map(itemNav)}
        </nav>
        <div className="sticky bottom-0 mt-auto flex flex-col gap-1 bg-white pt-3">
          {tarjetaPie}
          {navPie.length > 0 && (
            <span className="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-apagado">TU CUENTA</span>
          )}
          {navPie.map(itemNav)}
          <button
            type="button"
            onClick={cerrarSesion}
            className={cn(
              "flex min-h-[44px] w-full items-center gap-3 rounded-[14px] px-3 text-left text-[14px] font-medium text-apagado transition-colors",
              t.salirHover,
            )}
          >
            <Icono nombre="salir" tamano={19} trazo={1.8} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex min-h-[64px] flex-none items-center gap-3 bg-white px-3.5 py-2.5 min-[861px]:rounded-[22px] min-[861px]:border min-[861px]:border-linea min-[861px]:px-5 max-[860px]:border-b max-[860px]:border-linea">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setMenuAbierto((v) => !v)}
            className="inline-flex size-11 items-center justify-center rounded-full text-tinta hover:bg-lienzo min-[861px]:hidden"
          >
            <Icono nombre="menu" tamano={22} trazo={2} />
          </button>
          <Link href="/" className="flex items-center min-[861px]:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- isotipo fijo */}
            <img src="/assets/unidoar-logo.png" alt="UNIDOAR" className="size-8 object-contain" />
          </Link>
          <span className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-navy-900 max-[560px]:hidden">
            {nombre}
          </span>
          <span className="flex-1 min-[561px]:hidden" />
          <Link
            href={insignia.href}
            title={insignia.titulo}
            className={cn(
              "h-9 items-center rounded-full px-3.5 text-[13px] font-semibold leading-none",
              tema === "backoffice" ? "inline-flex" : "hidden min-[761px]:inline-flex",
              t.insignia,
            )}
          >
            {insignia.texto}
          </Link>
          {notificaciones && (
            <CampanaNotificaciones tema={t} notificaciones={notificaciones} verTodasHref={verTodasHref} />
          )}
          {/* Avatar con el anillo del espectro del logo. */}
          <span className="inline-flex size-11 flex-none rounded-full bg-[linear-gradient(135deg,#c2187a,#5b3fd0_45%,#22b8d9_75%,#f59332)] p-[2px]">
            <span className="inline-flex size-full items-center justify-center rounded-full border-2 border-white bg-navy-900 font-display text-[12px] font-semibold text-white">
              {iniciales}
            </span>
          </span>
        </header>
        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-auto px-4 pb-6 min-[861px]:px-2 min-[861px]:pb-8",
            // El contenido de la página no pasa de 1320px ni se encoge. Las capas que se pegan a la ventana (el cajón y su fondo,
            // que son `fixed`, y los <dialog>) quedan afuera: con este tope el fondo atenuado medía 1320px en una pantalla
            // de 1920 y dejaba una franja sin atenuar, y su `max-w-[92vw]` quedaba pisado (en un celular se pasaban de ancho).
            "[&>*:not(.fixed):not(dialog)]:max-w-[1320px] [&>*:not(.fixed):not(dialog)]:shrink-0",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function CampanaNotificaciones({
  tema: t,
  notificaciones,
  verTodasHref,
}: {
  tema: (typeof TEMAS)[Tema];
  notificaciones: NotificacionVista[];
  verTodasHref?: string;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [tab, setTab] = useState<"todas" | "noLeidas">("todas");
  const [, empezar] = useTransition();
  const contenedor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!abierta) return;
    const cerrar = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierta(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [abierta]);

  const noLeidas = notificaciones.filter((n) => !n.leida);
  const lista = tab === "todas" ? notificaciones : noLeidas;

  const abrir = (n: NotificacionVista) => {
    setAbierta(false);
    if (!n.leida) empezar(() => void marcarLeida(n.id));
    if (n.enlace) router.push(n.enlace);
  };

  return (
    <span ref={contenedor} className="relative inline-flex">
      <button
        type="button"
        title="Notificaciones"
        aria-label={`Notificaciones${noLeidas.length ? `, ${noLeidas.length} sin leer` : ""}`}
        onClick={() => setAbierta((v) => !v)}
        className="relative inline-flex size-11 items-center justify-center rounded-full border border-linea bg-white text-tinta transition-colors hover:bg-lienzo"
      >
        <Icono nombre="campana" tamano={19} trazo={1.8} />
        {noLeidas.length > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] rounded-full border-2 border-white px-1 text-center text-[10px] leading-[14px] font-semibold text-white",
              t.contador,
            )}
          >
            {noLeidas.length}
          </span>
        )}
      </button>
      {abierta && (
        // En el celular el panel se apoya en la pantalla (no en la campanita, que no queda pegada al borde y lo cortaba).
        <div className="fixed inset-x-3 top-[60px] z-[60] overflow-hidden rounded-xl border border-borde bg-white shadow-[0_16px_40px_rgba(31,36,33,.22)] min-[481px]:absolute min-[481px]:inset-x-auto min-[481px]:top-[52px] min-[481px]:right-0 min-[481px]:w-[360px]">
          <div className="flex items-center justify-between px-[18px] pt-4 pb-2.5">
            <span className="text-[17px] leading-tight font-semibold tracking-[-0.01em] text-tinta">Notificaciones</span>
            {noLeidas.length > 0 && (
              <button
                type="button"
                onClick={() => empezar(() => void marcarTodasLeidas())}
                className={cn("text-[12.5px] font-medium", t.marcar)}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="flex gap-[18px] border-b border-borde px-[18px]">
            {(
              [
                ["todas", "Todas"],
                ["noLeidas", `No leídas (${noLeidas.length})`],
              ] as const
            ).map(([k, etiqueta]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn(
                  "-mb-px border-b-2 py-2 text-[13px] font-semibold",
                  tab === k ? t.pestana : "border-transparent text-sutil",
                )}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <div className="max-h-[min(340px,calc(100dvh-230px))] overflow-auto">
            {lista.map((n) => {
              const e = estiloNotificacion(n.tipo, n.titulo);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => abrir(n)}
                  className={cn(
                    "flex w-full items-start gap-[11px] border-b border-[#F0EFEA] px-[18px] py-[13px] text-left hover:bg-[#F0EFEA]",
                    !n.leida && "bg-superficie",
                  )}
                >
                  <span
                    style={{ background: e.fondo, color: e.texto }}
                    className="inline-flex size-[34px] flex-none items-center justify-center rounded-full text-xs font-semibold"
                  >
                    {e.ini}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-[1.45] text-tinta-2">
                      <b className="font-semibold text-tinta">{n.titulo}</b> {n.texto}
                    </span>
                    <span className="mt-[3px] block text-[11.5px] leading-none text-sutil">{n.cuando}</span>
                  </span>
                  {!n.leida && <span className={cn("mt-1.5 size-2 flex-none rounded-full", t.punto)} />}
                </button>
              );
            })}
            {lista.length === 0 && (
              <div className="px-[18px] py-7 text-center text-[13px] leading-normal text-sutil">
                {tab === "noLeidas" ? "No te queda ninguna sin leer." : "Todavía no tenés notificaciones."}
              </div>
            )}
          </div>
          {verTodasHref && (
            <Link
              href={verTodasHref}
              onClick={() => setAbierta(false)}
              className={cn("block border-t border-borde px-[18px] py-3 text-center text-[13px] font-semibold", t.marcar)}
            >
              Ver todas las notificaciones
            </Link>
          )}
        </div>
      )}
    </span>
  );
}
