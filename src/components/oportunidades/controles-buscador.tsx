"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icono } from "@/components/icons";
import { Boton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/campos";
import { Insignia } from "@/components/ui/insignia";
import { CATEGORIAS, NIVELES, TIPOS_BUSQUEDA, TURNOS } from "@/lib/catalogo";
import {
  ETIQUETA_FILTRO_CATEGORIA,
  hrefOportunidades,
  RADIO_MAX,
  RADIO_MIN,
  type FiltrosOportunidades,
} from "@/lib/oportunidades";
import { cn } from "@/lib/utils";

const ETIQUETA_SECCION = "text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase";
const FOCO = "focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none";

/**
 * Filtros del buscador de trabajo (panel lateral + barra superior). Cada cambio actualiza la URL,
 * así el listado, el mapa y el link compartido siempre coinciden. El listado va como `children`
 * (se renderiza en el servidor). Es el mismo panel, con la misma identidad, en el área del profesional y en el
 * sitio público; con `publico` se ocultan el rango de distancia y los favoritos, que necesitan una cuenta.
 */
export function ControlesBuscador({
  base,
  filtros,
  radio,
  radioPorDefecto,
  conUbicacion,
  modo,
  publico = false,
  lectura = null,
  vistaNav,
  children,
}: {
  /** Selector Lista/Mapa: va a la derecha, en la fila de Favoritos y Búsqueda rápida. */
  vistaNav?: React.ReactNode;
  /** Ruta de la pantalla: /docente/oportunidades, /docente/busquedas-rapidas o /buscar-trabajo. */
  base: string;
  filtros: FiltrosOportunidades;
  /** Radio vigente (el del filtro o el del perfil). */
  radio: number;
  /** Radio guardado en el perfil: es el que vuelve al limpiar los filtros. */
  radioPorDefecto: number;
  conUbicacion: boolean;
  modo: "todas" | "rapidas";
  /** Sitio público (sin sesión): sin rango de distancia ni favoritos. */
  publico?: boolean;
  /** Lo que se entendió de la frase de "Buscá con IA" (null si no hay frase). Los filtros ya vienen aplicados en `filtros`. */
  lectura?: { frase: string; leido: string[]; reconocido: boolean; sinEntender: string[] } | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  // Texto y slider guardan su propio valor mientras se escribe/arrastra; al limpiar se les avisa con este contador.
  const [reinicios, setReinicios] = useState(0);

  const aplicar = (cambios: Partial<Record<keyof FiltrosOportunidades, string | number | null | undefined>>) =>
    empezar(() => router.replace(hrefOportunidades(base, filtros, cambios), { scroll: false }));

  const limpiar = () => {
    setReinicios((n) => n + 1);
    // Se conserva la vista (lista/mapa): no es un filtro.
    empezar(() => router.replace(hrefOportunidades(base, {}, { vista: filtros.vista }), { scroll: false }));
  };

  return (
    <div
      aria-busy={pendiente}
      className="flex items-start gap-6 max-[860px]:flex-col max-[860px]:items-stretch max-[860px]:gap-4"
    >
      <PanelFiltrosApp
        filtros={filtros}
        modo={modo}
        radio={radio}
        radioPorDefecto={radioPorDefecto}
        conUbicacion={conUbicacion}
        publico={publico}
        reinicios={reinicios}
        aplicar={aplicar}
        limpiar={limpiar}
      />

      <div className="min-w-0 flex-1 max-[760px]:w-full">
        <FraseDeBusqueda
          base={base}
          vista={filtros.vista}
          lectura={lectura}
          limpiarHref={hrefOportunidades(base, {}, { vista: filtros.vista })}
        />
        <div className="mb-5 flex flex-wrap gap-2.5 rounded-tarjeta bg-white p-3.5 shadow-tarjeta">
          <CampoTexto
            inicial={filtros.q ?? ""}
            reinicios={reinicios}
            onAplicar={(q) => aplicar({ q: q || null })}
          />
          <Select
            aria-label="Nivel"
            value={filtros.nivel ?? ""}
            onChange={(e) => aplicar({ nivel: e.target.value || null })}
            className="w-auto max-w-[150px] min-w-[130px]"
          >
            <option value="">Todos los niveles</option>
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Turno"
            value={filtros.turno ?? ""}
            onChange={(e) => aplicar({ turno: e.target.value || null })}
            className="w-auto max-w-[150px] min-w-[130px]"
          >
            <option value="">Todos los turnos</option>
            {TURNOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Tipo de búsqueda"
            value={filtros.tipo ?? ""}
            onChange={(e) => aplicar({ tipo: e.target.value || null })}
            className="w-auto max-w-[150px] min-w-[130px]"
          >
            <option value="">Todos los tipos</option>
            {/* "Suplencia rápida" ya tiene su propio botón: acá no se repite. */}
            {TIPOS_BUSQUEDA.filter((t) => t !== "Suplencia rápida").map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <div className="flex flex-none gap-2.5">
            {!publico && (
              <BotonFiltro activo={filtros.favoritos === "1"} onClick={() => aplicar({ favoritos: filtros.favoritos ? null : "1" })}>
                <span aria-hidden>★</span> Favoritos
              </BotonFiltro>
            )}
            {modo === "todas" && (
              <BotonFiltro
                activo={filtros.rapidas === "1"}
                tono="naranja"
                onClick={() => aplicar({ rapidas: filtros.rapidas ? null : "1" })}
              >
                <svg
                  aria-hidden
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="flex-none"
                >
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9.5V13l2.4 1.6" />
                  <path d="M9.6 2.8h4.8" />
                </svg>
                Búsqueda rápida
              </BotonFiltro>
            )}
          </div>
          {vistaNav && <div className="ml-auto flex-none">{vistaNav}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

function BotonFiltro({
  activo,
  tono = "azul",
  onClick,
  children,
}: {
  activo: boolean;
  tono?: "azul" | "naranja";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 flex-none items-center gap-1.5 rounded-lg px-4 text-[13px] leading-none font-semibold whitespace-nowrap transition-colors",
        activo
          ? tono === "naranja"
            ? "bg-naranja text-white"
            : "bg-navy-700 text-white"
          : "border border-borde bg-white text-tinta-2 hover:border-borde-fuerte",
        FOCO,
      )}
    >
      {children}
    </button>
  );
}

function Interruptor({
  activo,
  etiqueta,
  detalle,
  onCambio,
  app = false,
  urgente = false,
}: {
  activo: boolean;
  etiqueta: string;
  /** Una línea que explica qué hace (solo en el panel del área con sesión). */
  detalle?: string;
  onCambio: () => void;
  app?: boolean;
  /** Filtro de búsquedas urgentes: rayo y naranja, el color de las urgentes en toda la app. */
  urgente?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={onCambio}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded text-left",
        app && "min-h-14 rounded-caja px-3 py-2.5 transition-colors hover:bg-white",
        FOCO,
      )}
    >
      {app ? (
        <span className="flex min-w-0 flex-col gap-1">
          <span className={cn("flex items-center gap-1.5 text-[14px] leading-tight font-semibold", urgente ? "text-naranja-ink" : "text-tinta")}>
            {urgente && <Icono nombre="rayo" tamano={14} trazo={2} className="flex-none" />}
            {etiqueta}
          </span>
          {detalle && <span className="text-[12.5px] leading-tight text-apagado">{detalle}</span>}
        </span>
      ) : (
        <span className="text-[13px] leading-none font-medium">{etiqueta}</span>
      )}
      <span
        className={cn(
          "relative inline-block h-5 w-[34px] flex-none rounded-full transition-colors",
          activo ? (app && !urgente ? "bg-rosa" : "bg-naranja") : "bg-[#CFCCC5]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform",
            activo && "translate-x-[14px]",
          )}
        />
      </span>
    </button>
  );
}

/** Texto libre con espera de 350 ms: no recarga el listado en cada tecla. */
function CampoTexto({
  inicial,
  reinicios,
  onAplicar,
}: {
  inicial: string;
  reinicios: number;
  onAplicar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const [reiniciosVistos, setReiniciosVistos] = useState(reinicios);
  // Limpiar filtros vacía el campo (ajuste de estado durante el render, sin efecto).
  if (reinicios !== reiniciosVistos) {
    setReiniciosVistos(reinicios);
    setTexto("");
  }
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);

  return (
    <Input
      type="search"
      aria-label="Buscar por institución o materia"
      placeholder="Buscar por institución o materia"
      value={texto}
      maxLength={80}
      onChange={(e) => {
        const nuevo = e.target.value;
        setTexto(nuevo);
        clearTimeout(espera.current);
        espera.current = setTimeout(() => onAplicar(nuevo.trim()), 350);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        clearTimeout(espera.current);
        onAplicar(e.currentTarget.value.trim());
      }}
      className="min-w-[180px] flex-1"
    />
  );
}

function RangoDeBusqueda({
  vigente,
  porDefecto,
  reinicios,
  habilitado,
  onCambio,
  app = false,
}: {
  vigente: number;
  porDefecto: number;
  reinicios: number;
  habilitado: boolean;
  onCambio: (km: number) => void;
  /** Panel del área con sesión: el valor va en una pastilla a la derecha del título. */
  app?: boolean;
}) {
  const [km, setKm] = useState(vigente);
  const [reiniciosVistos, setReiniciosVistos] = useState(reinicios);
  if (reinicios !== reiniciosVistos) {
    setReiniciosVistos(reinicios);
    setKm(porDefecto);
  }
  const confirmar = (valor: number) => {
    if (valor !== vigente) onCambio(valor);
  };

  const valor = km >= RADIO_MAX ? "Toda la zona" : `Hasta ${km} km`;
  return (
    <div className={app ? "" : "mb-4"}>
      {app ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <label htmlFor="rango-km" className="text-[12px] font-semibold tracking-[.08em] text-apagado uppercase">
            Distancia
          </label>
          <span className="inline-flex h-7 items-center rounded-full bg-rosa-tint px-3 text-[13px] font-semibold text-rosa">{valor}</span>
        </div>
      ) : (
        <>
          <div className={cn(ETIQUETA_SECCION, "mb-2.5")}>Rango de búsqueda</div>
          <label htmlFor="rango-km" className="mb-1.5 block text-[13px] leading-none font-medium text-tinta-2">
            {valor}
          </label>
        </>
      )}
      <input
        id="rango-km"
        type="range"
        min={RADIO_MIN}
        max={RADIO_MAX}
        step={1}
        value={km}
        disabled={!habilitado}
        onChange={(e) => setKm(Number(e.target.value))}
        // Se aplica al soltar (mouse, dedo o teclado), no en cada paso del slider.
        onPointerUp={(e) => confirmar(Number(e.currentTarget.value))}
        onKeyUp={(e) => confirmar(Number(e.currentTarget.value))}
        className={cn("mb-1.5 w-full accent-rosa disabled:opacity-50", app && "h-6 cursor-pointer")}
      />
      <div className={cn("flex justify-between text-[11.5px] leading-none", app ? "text-apagado" : "text-sutil")}>
        <span>{RADIO_MIN} km</span>
        <span>Toda la zona</span>
      </div>
      {!habilitado && (
        <p className="mt-2.5 mb-0 text-xs leading-normal text-apagado">
          Para filtrar por distancia,{" "}
          <Link href="/docente/perfil" className="font-semibold underline">
            completá tu zona en el perfil
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/**
 * "Buscá con IA": una frase libre ("suplencia de inglés, de mañana, primaria") que el servidor convierte en los filtros de al lado.
 * Una frase nueva reemplaza los filtros; después se pueden ajustar a mano. No hay ningún modelo detrás: ver `leerFraseDeTrabajo`.
 */
function FraseDeBusqueda({
  base,
  vista,
  lectura,
  limpiarHref,
}: {
  base: string;
  vista: FiltrosOportunidades["vista"];
  lectura: { frase: string; leido: string[]; reconocido: boolean; sinEntender: string[] } | null;
  limpiarHref: string;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  return (
    <section aria-label="Buscá con IA" className="mb-4 rounded-tarjeta bg-white px-5 py-[18px] shadow-tarjeta">
      <div className="mb-2.5 flex items-center gap-2 text-rosa">
        <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="flex-none">
          <path d="M12 2.5l1.7 4.6 4.6 1.7-4.6 1.7L12 15.1l-1.7-4.6-4.6-1.7 4.6-1.7z" />
          <path d="M18.5 14.4l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" />
        </svg>
        <span className="text-sm leading-none font-semibold">Buscá con IA</span>
      </div>
      <form
        key={lectura?.frase ?? ""}
        className="flex flex-wrap gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          const frase = String(new FormData(e.currentTarget).get("frase") ?? "").trim();
          const params = new URLSearchParams();
          if (frase) params.set("frase", frase);
          if (vista) params.set("vista", vista);
          const qs = params.toString();
          empezar(() => router.push(qs ? `${base}?${qs}` : base));
        }}
      >
        <Input
          name="frase"
          aria-label="Contanos qué buscás"
          defaultValue={lectura?.frase ?? ""}
          maxLength={200}
          placeholder="Contanos qué buscás: «suplencia de inglés en primaria, de mañana»"
          className="min-w-[240px] flex-1"
        />
        <Boton type="submit" disabled={pendiente} className="flex-none rounded-full bg-rosa px-7 hover:bg-[#7A0F4D]">
          Buscar
        </Boton>
      </form>
      {lectura && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-borde pt-3.5">
          <span className="text-[12.5px] leading-none font-medium text-apagado">Entendimos:</span>
          {lectura.reconocido ? (
            lectura.leido.map((l) => (
              <Insignia key={l} tono="azul">
                {l}
              </Insignia>
            ))
          ) : (
            <Insignia tono="azul">No reconocimos filtros: te mostramos todas las búsquedas</Insignia>
          )}
          <Link href={limpiarHref} className="ml-auto text-[12.5px] leading-none font-medium text-sutil hover:text-tinta">
            Limpiar
          </Link>
          {lectura.reconocido && lectura.sinEntender.length > 0 && (
            <p className="m-0 basis-full text-[12.5px] leading-normal text-apagado">
              No pudimos aplicar como filtro: {lectura.sinEntender.map((p) => `«${p}»`).join(", ")}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Color de cada categoría en el panel: punto, fondo y borde de la opción elegida. */
const COLOR_CATEGORIA = {
  educador: { punto: "bg-naranja", activa: "bg-panel-naranja ring-naranja/45" },
  entrenador: { punto: "bg-ambar", activa: "bg-panel-ambar ring-ambar/50" },
  guardavidas: { punto: "bg-celeste-anillo", activa: "bg-panel-celeste ring-celeste-anillo/45" },
} as const;

/**
 * Panel de filtros (identidad nueva), el mismo en el área del profesional y en el sitio público. Categorías como
 * lista con su color, distancia con el valor a la vista, interruptores con una línea que explica qué hacen y un
 * contador de filtros aplicados. En el sitio público (`publico`) no está la distancia: necesita la zona del perfil.
 */
function PanelFiltrosApp({
  filtros,
  modo,
  radio,
  radioPorDefecto,
  conUbicacion,
  publico,
  reinicios,
  aplicar,
  limpiar,
}: {
  filtros: FiltrosOportunidades;
  modo: "todas" | "rapidas";
  radio: number;
  radioPorDefecto: number;
  conUbicacion: boolean;
  publico: boolean;
  reinicios: number;
  aplicar: (cambios: Partial<Record<keyof FiltrosOportunidades, string | number | null | undefined>>) => void;
  limpiar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const activos = Object.entries(filtros).filter(([clave, valor]) => clave !== "vista" && valor !== undefined).length;

  const opcion = (activa: boolean, color: string, punto: React.ReactNode, texto: string, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-caja px-3 text-left text-[14px] leading-tight transition-colors",
        activa ? cn("font-semibold text-tinta ring-[1.5px]", color) : "font-medium text-tinta-2 hover:bg-[#F7F6F2]",
        FOCO,
      )}
    >
      {punto}
      <span className="min-w-0 flex-1">{texto}</span>
      {activa && <Icono nombre="tilde" tamano={15} trazo={2.6} className="flex-none text-tinta" />}
    </button>
  );

  return (
    <aside
      aria-label="Filtros"
      className={cn(
        "w-[272px] flex-none rounded-tarjeta bg-white p-5 shadow-tarjeta",
        "max-[860px]:w-full",
        "max-[760px]:sticky max-[760px]:top-0 max-[760px]:z-30 max-[760px]:max-h-[82vh] max-[760px]:overflow-auto max-[760px]:p-3",
      )}
    >
      {/* En el celular el panel se pliega: este botón lo abre y dice cuántos filtros hay puestos. */}
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="panel-filtros-app"
        onClick={() => setAbierto((v) => !v)}
        className={cn("hidden min-h-11 w-full items-center gap-2 rounded-caja px-2 text-[15px] font-semibold max-[760px]:flex", FOCO)}
      >
        <Icono nombre="menu" tamano={18} trazo={2} />
        Filtros
        {activos > 0 && (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-navy-900 px-2 text-xs text-white">{activos}</span>
        )}
        <Icono nombre="chevron" tamano={16} trazo={2.2} className={cn("ml-auto transition-transform", abierto && "rotate-180")} />
      </button>

      <div id="panel-filtros-app" className={cn("flex flex-col gap-5 max-[760px]:hidden", abierto && "max-[760px]:mt-3 max-[760px]:flex")}>
        <div className="flex items-center gap-2 max-[760px]:hidden">
          <h2 className="font-display m-0 text-[17px] leading-none font-semibold text-navy-900">Filtros</h2>
          {activos > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-navy-900 px-2 text-xs font-semibold text-white">
              {activos}
            </span>
          )}
          {activos > 0 && (
            <button
              type="button"
              onClick={limpiar}
              className={cn("ml-auto inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-rosa hover:bg-rosa-tint", FOCO)}
            >
              <Icono nombre="cerrar" tamano={13} trazo={2.4} />
              Limpiar
            </button>
          )}
        </div>
        {activos > 0 && (
          <button
            type="button"
            onClick={limpiar}
            className={cn("hidden min-h-10 items-center justify-center gap-1 rounded-full bg-rosa-tint text-[13px] font-semibold text-rosa max-[760px]:flex", FOCO)}
          >
            Limpiar {activos === 1 ? "el filtro" : `los ${activos} filtros`}
          </button>
        )}

        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
          <legend className="mb-2 p-0 text-[12px] font-semibold tracking-[.08em] text-apagado uppercase">Categoría</legend>
          {opcion(
            !filtros.categoria,
            "bg-navy-50 ring-navy-700/30",
            <span aria-hidden className="size-2.5 flex-none rounded-full bg-[linear-gradient(135deg,#c2187a,#5b3fd0_45%,#22b8d9_75%,#f59332)]" />,
            "Todas",
            () => aplicar({ categoria: null }),
          )}
          {CATEGORIAS.map((c) => (
            <div key={c}>
              {opcion(
                filtros.categoria === c,
                COLOR_CATEGORIA[c].activa,
                <span aria-hidden className={cn("size-2.5 flex-none rounded-full", COLOR_CATEGORIA[c].punto)} />,
                ETIQUETA_FILTRO_CATEGORIA[c],
                () => aplicar({ categoria: c }),
              )}
            </div>
          ))}
        </fieldset>

        <div className="h-px bg-linea" />

        {!publico && (
          <RangoDeBusqueda
            vigente={Math.min(radio, RADIO_MAX)}
            porDefecto={Math.min(radioPorDefecto, RADIO_MAX)}
            reinicios={reinicios}
            habilitado={conUbicacion}
            onCambio={(km) => aplicar({ radio: km })}
            app
          />
        )}

        <div className="flex flex-col gap-1 rounded-interno bg-[#F7F6F2] p-1.5">
          {modo === "todas" && (
            <Interruptor
              activo={filtros.rapidas === "1"}
              etiqueta="Solo búsquedas urgentes"
              detalle="Suplencias rápidas que vencen pronto"
              onCambio={() => aplicar({ rapidas: filtros.rapidas ? null : "1" })}
              app
              urgente
            />
          )}
          <Interruptor
            activo={filtros.verificadas === "1"}
            etiqueta="Solo instituciones verificadas"
            detalle="Revisadas por el equipo de UNIDOAR"
            onCambio={() => aplicar({ verificadas: filtros.verificadas ? null : "1" })}
            app
          />
        </div>
      </div>
    </aside>
  );
}
