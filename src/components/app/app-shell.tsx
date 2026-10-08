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
    header: string;
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
    header: "bg-sidebar",
    activo: "bg-[#FBE3F0] font-semibold text-[#7A1B4E]",
    insignia: "bg-white/[.14] text-[#FBD9EC] hover:bg-white/25",
    punto: "bg-rosa",
    marcar: "text-rosa",
    salirHover: "hover:bg-rosa-tint hover:text-rosa",
    contador: "bg-rosa",
    pestana: "border-rosa text-tinta",
  },
  institucion: {
    header: "bg-navy-850",
    activo: "bg-navy-50 font-semibold text-navy-700",
    insignia: "bg-white/[.12] text-navy-100 hover:bg-white/25",
    punto: "bg-naranja",
    marcar: "text-naranja",
    salirHover: "hover:bg-[#F3E6E3] hover:text-naranja",
    contador: "bg-naranja",
    pestana: "border-naranja text-tinta",
  },
  backoffice: {
    header: "bg-backoffice",
    activo: "bg-navy-50 font-semibold text-navy-700",
    insignia: "bg-white/[.14] text-borde hover:bg-white/25",
    punto: "bg-naranja",
    marcar: "text-naranja",
    salirHover: "hover:bg-[#F3E6E3] hover:text-naranja",
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
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-sm transition-colors",
        esActivo(i) ? t.activo : "font-medium text-apagado hover:bg-superficie hover:text-tinta",
      )}
    >
      <Icono nombre={i.icono} />
      {i.label}
    </Link>
  );

  return (
    <div className="flex h-screen flex-col bg-app">
      <header className={cn("flex h-14 flex-none items-center justify-between px-3.5 sm:px-6", t.header)}>
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none sm:gap-[22px]">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setMenuAbierto((v) => !v)}
            className="inline-flex text-white min-[861px]:hidden"
          >
            <Icono nombre="menu" tamano={22} trazo={2} />
          </button>
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo fijo, el ancho depende de la proporción */}
            <img src="/assets/unidoar-logo-horizontal.png" alt="UNIDOAR" className="h-[34px] w-auto object-contain" />
          </Link>
          <span className="hidden max-w-[180px] truncate rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white/90 min-[561px]:block">
            {nombre}
          </span>
        </div>
        <div className="flex items-center gap-3.5">
          <Link
            href={insignia.href}
            title={insignia.titulo}
            className={cn(
              "rounded-full px-2.5 py-[5px] text-xs font-semibold leading-none",
              tema === "backoffice" ? "inline-flex" : "hidden min-[761px]:inline-flex",
              t.insignia,
            )}
          >
            {insignia.texto}
          </Link>
          {notificaciones && (
            <CampanaNotificaciones tema={t} notificaciones={notificaciones} verTodasHref={verTodasHref} />
          )}
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
            {iniciales}
          </span>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {menuAbierto && (
          <div onClick={() => setMenuAbierto(false)} className="fixed inset-0 z-[44] bg-black/35 min-[861px]:hidden" />
        )}
        <aside
          className={cn(
            "flex w-[214px] flex-none flex-col gap-0.5 overflow-y-auto border-r border-borde bg-white px-3 py-4",
            "max-[860px]:fixed max-[860px]:top-14 max-[860px]:bottom-0 max-[860px]:left-0 max-[860px]:z-[45] max-[860px]:shadow-[2px_0_16px_rgba(0,0,0,.2)] max-[860px]:transition-transform max-[860px]:duration-200",
            menuAbierto ? "max-[860px]:translate-x-0" : "max-[860px]:-translate-x-full",
          )}
        >
          {nav.map(itemNav)}
          <div className="sticky bottom-0 mt-auto flex flex-col gap-2.5 bg-white pt-2.5">
            {tarjetaPie}
            {navPie.map(itemNav)}
            <button
              type="button"
              onClick={cerrarSesion}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left text-[13px] font-medium text-apagado transition-colors",
                t.salirHover,
              )}
            >
              <Icono nombre="salir" />
              Cerrar sesión
            </button>
          </div>
        </aside>
        <main
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-auto px-4 py-5 min-[861px]:px-10 min-[861px]:py-8",
            "[&>*]:max-w-[1320px] [&>*]:shrink-0",
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
        className="relative inline-flex text-white"
      >
        <Icono nombre="campana" tamano={19} trazo={1.7} />
        {noLeidas.length > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1.5 h-4 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold text-white",
              t.contador,
            )}
          >
            {noLeidas.length}
          </span>
        )}
      </button>
      {abierta && (
        // En el celular el panel se apoya en la pantalla (no en la campanita, que no queda pegada al borde y lo cortaba).
        <div className="fixed inset-x-3 top-[60px] z-[60] overflow-hidden rounded-xl border border-borde bg-white shadow-[0_16px_40px_rgba(31,36,33,.22)] min-[481px]:absolute min-[481px]:inset-x-auto min-[481px]:top-[34px] min-[481px]:right-0 min-[481px]:w-[360px]">
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
