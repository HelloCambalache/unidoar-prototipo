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
 * (se renderiza en el servidor). Es el mismo panel del docente y del sitio público; con `publico`
 * se ocultan el rango de distancia y los favoritos, que necesitan una cuenta.
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
  children,
}: {
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
  const [panelAbierto, setPanelAbierto] = useState(false);
  // Texto y slider guardan su propio valor mientras se escribe/arrastra; al limpiar se les avisa con este contador.
  const [reinicios, setReinicios] = useState(0);

  const aplicar = (cambios: Partial<Record<keyof FiltrosOportunidades, string | number | null | undefined>>) =>
    empezar(() => router.replace(hrefOportunidades(base, filtros, cambios), { scroll: false }));

  const limpiar = () => {
    setReinicios((n) => n + 1);
    // Se conserva la vista (lista/mapa): no es un filtro.
    empezar(() => router.replace(hrefOportunidades(base, {}, { vista: filtros.vista }), { scroll: false }));
  };

  const hayFiltros = Object.entries(filtros).some(([clave, valor]) => clave !== "vista" && valor !== undefined);

  return (
    <div
      aria-busy={pendiente}
      className="flex items-start gap-6 max-[860px]:flex-col max-[860px]:items-stretch max-[860px]:gap-4"
    >
      <div
        className={cn(
          "w-[250px] flex-none rounded-lg border border-borde bg-white p-[18px]",
          "max-[860px]:w-full",
          "max-[760px]:sticky max-[760px]:top-0 max-[760px]:z-30 max-[760px]:max-h-[82vh] max-[760px]:overflow-auto max-[760px]:px-4 max-[760px]:py-3.5",
        )}
      >
        <button
          type="button"
          aria-expanded={panelAbierto}
          aria-controls="panel-filtros"
          onClick={() => setPanelAbierto((v) => !v)}
          className={cn("hidden w-full items-center justify-between gap-2 text-sm font-semibold max-[760px]:flex", FOCO)}
        >
          Filtros
          <Icono nombre="chevron" tamano={14} trazo={2.2} className={cn("transition-transform", panelAbierto && "rotate-180")} />
        </button>
        <div id="panel-filtros" className={cn("max-[760px]:hidden", panelAbierto && "max-[760px]:mt-3.5 max-[760px]:block")}>
          <div className="mb-4 flex items-center justify-between max-[760px]:justify-end">
            <span className="text-sm leading-none font-semibold max-[760px]:hidden">Filtros</span>
            <button
              type="button"
              onClick={limpiar}
              disabled={!hayFiltros}
              className={cn("rounded text-xs leading-none font-medium text-naranja disabled:cursor-default disabled:opacity-40", FOCO)}
            >
              Limpiar
            </button>
          </div>

          <div className="mb-[18px] flex flex-col gap-2">
            <span className={ETIQUETA_SECCION}>Categoría</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Pastilla activa={!filtros.categoria} onClick={() => aplicar({ categoria: null })}>
                Todas
              </Pastilla>
              {CATEGORIAS.map((c) => (
                <Pastilla key={c} activa={filtros.categoria === c} onClick={() => aplicar({ categoria: c })}>
                  {ETIQUETA_FILTRO_CATEGORIA[c]}
                </Pastilla>
              ))}
            </div>
          </div>

          <div className="mb-4 h-px bg-borde" />

          {!publico && (
            <>
              <RangoDeBusqueda
                vigente={Math.min(radio, RADIO_MAX)}
                porDefecto={Math.min(radioPorDefecto, RADIO_MAX)}
                reinicios={reinicios}
                habilitado={conUbicacion}
                onCambio={(km) => aplicar({ radio: km })}
              />

              <div className="mb-4 h-px bg-borde" />
            </>
          )}

          <div className="flex flex-col gap-3.5">
            {modo === "todas" && (
              <Interruptor
                activo={filtros.rapidas === "1"}
                etiqueta="Sólo suplencias"
                onCambio={() => aplicar({ rapidas: filtros.rapidas ? null : "1" })}
              />
            )}
            <Interruptor
              activo={filtros.verificadas === "1"}
              etiqueta="Solo instituciones verificadas"
              onCambio={() => aplicar({ verificadas: filtros.verificadas ? null : "1" })}
            />
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 max-[760px]:w-full">
        <FraseDeBusqueda base={base} vista={filtros.vista} lectura={lectura} limpiarHref={hrefOportunidades(base, {}, { vista: filtros.vista })} />
        <div className="mb-5 flex flex-wrap gap-2.5">
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
        </div>
        {children}
      </div>
    </div>
  );
}

function Pastilla({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs leading-none font-semibold transition-colors",
        activa ? "bg-navy-700 text-white" : "bg-[#F0EFEA] text-apagado hover:text-tinta",
        FOCO,
      )}
    >
      {children}
    </button>
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

function Interruptor({ activo, etiqueta, onCambio }: { activo: boolean; etiqueta: string; onCambio: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={onCambio}
      className={cn("flex w-full items-center justify-between gap-3 rounded text-left", FOCO)}
    >
      <span className="text-[13px] leading-none font-medium">{etiqueta}</span>
      <span
        className={cn(
          "relative inline-block h-5 w-[34px] flex-none rounded-full transition-colors",
          activo ? "bg-naranja" : "bg-[#CFCCC5]",
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
}: {
  vigente: number;
  porDefecto: number;
  reinicios: number;
  habilitado: boolean;
  onCambio: (km: number) => void;
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

  return (
    <div className="mb-4">
      <div className={cn(ETIQUETA_SECCION, "mb-2.5")}>Rango de búsqueda</div>
      <label htmlFor="rango-km" className="mb-1.5 block text-[13px] leading-none font-medium text-tinta-2">
        {km >= RADIO_MAX ? "Toda la zona" : `Hasta ${km} km`}
      </label>
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
        className="mb-1.5 w-full accent-rosa disabled:opacity-50"
      />
      <div className="flex justify-between text-[11.5px] leading-none text-sutil">
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
    <section aria-label="Buscá con IA" className="mb-4 rounded-[10px] border border-borde bg-white px-[18px] py-4">
      <div className="mb-2.5 flex items-center gap-2 text-navy-700">
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
        <Boton type="submit" disabled={pendiente} className="flex-none">
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
