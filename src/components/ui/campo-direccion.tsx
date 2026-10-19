"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/campos";
import { mover, teclaDelMenu } from "@/lib/combo";
import { cn } from "@/lib/utils";

/** Una sugerencia de /api/ubicacion: lo que se muestra y la firma que el formulario manda al guardar. */
export type Sugerencia = {
  etiqueta: string;
  calle: string | null;
  partido: string;
  provincia: string;
  localidad: string | null;
  /** "Villa Adelina, Vicente López": el texto de zona que se muestra en las tarjetas. */
  zona: string;
  exacta: boolean;
  fuente: "georef" | "osm";
  coincide: boolean;
  token: string;
};

type Estado = "reposo" | "buscando" | "listo" | "sin-resultados" | "falla";

const MINIMO = 6;
const ESPERA_MS = 450;

/** Pone un valor en un input que React no controla (partido, provincia) y avisa para que se enteren los `onInput` del formulario. */
function escribir(input: HTMLInputElement, valor: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Dirección con ubicación automática: mientras se escribe busca la dirección (Georef, y OpenStreetMap de respaldo salvo
 * para el domicilio de una persona) y completa el partido y la provincia. Los resultados salen en un menú desplegable debajo
 * del campo (se recorre con las flechas, se elige con Enter o con un toque y se cierra con Esc), y cada opción dice si es exacta
 * o aproximada. Si lo escrito coincide con un solo lugar ("Av. Maipú 1234, Vicente López") lo toma solo; si puede ser de varios,
 * pide elegir. La sugerencia elegida viaja en el campo oculto `ubicacion` (firmada por el servidor) o, en un formulario con
 * estado propio, por `onElegida`. Si no encuentra nada, no bloquea: se completa a mano como siempre.
 */
export function CampoDireccion({
  etiqueta = "Dirección",
  name = "direccion",
  defaultValue = "",
  proposito,
  campoPartido,
  campoProvincia,
  enviarFirma = true,
  onCambioTexto,
  onElegida,
  placeholder = "Ej. Av. Maipú 1234, Vicente López",
  ayuda,
  error,
  requerido,
  required,
  className,
}: {
  etiqueta?: string;
  name?: string;
  defaultValue?: string;
  /** A dónde puede viajar el texto: "docente" solo se consulta en Georef (es un domicilio). */
  proposito: "institucion" | "curso" | "docente";
  /** `name` de los campos del mismo formulario donde se vuelcan el partido y la provincia detectados. */
  campoPartido?: string;
  campoProvincia?: string;
  /** Manda la firma en el campo oculto `ubicacion`. Se apaga si el formulario la lleva por `onElegida` o no la usa. */
  enviarFirma?: boolean;
  /** Para formularios que guardan el texto en su propio estado. */
  onCambioTexto?: (texto: string) => void;
  /** Se llama con la sugerencia tomada, y con null cuando se edita el texto y deja de valer. */
  onElegida?: (sugerencia: Sugerencia | null) => void;
  placeholder?: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  const estadoId = `${id}-estado`;
  const listaId = `${id}-lista`;
  const opcionId = (i: number) => `${id}-op-${i}`;
  const entrada = useRef<HTMLInputElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedido = useRef<AbortController | null>(null);
  const [texto, setTexto] = useState(defaultValue);
  const [estado, setEstado] = useState<Estado>("reposo");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [elegida, setElegida] = useState<Sugerencia | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [resaltada, setResaltada] = useState(-1);
  const [descartada, setDescartada] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      pedido.current?.abort();
    },
    [],
  );

  // Lo que lista el menú: todas las encontradas o, si ya hay una elegida, las otras.
  const opciones = elegida ? sugerencias.filter((s) => s !== elegida) : sugerencias;
  const hayQueElegir = estado === "listo" && !elegida && !descartada;
  // El menú muestra la búsqueda en curso, las opciones, y también cuándo no hubo nada: ahí mismo se entiende qué pasó.
  const hayMensaje = estado === "buscando" || estado === "sin-resultados" || estado === "falla" || (estado === "listo" && opciones.length > 0);
  const panelAbierto = abierto && hayMensaje;
  const conOpciones = panelAbierto && estado === "listo" && opciones.length > 0;

  // La opción resaltada con el teclado siempre queda a la vista.
  useEffect(() => {
    if (resaltada >= 0) document.getElementById(opcionId(resaltada))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resaltada]);

  function completarCampos(s: Sugerencia) {
    const formulario = entrada.current?.form;
    if (!formulario) return;
    for (const [nombre, valor] of [
      [campoPartido, s.partido],
      [campoProvincia, s.provincia],
    ] as const) {
      const campo = nombre ? formulario.elements.namedItem(nombre) : null;
      if (campo instanceof HTMLInputElement && campo.value !== valor) escribir(campo, valor);
    }
  }

  function elegir(s: Sugerencia) {
    setElegida(s);
    setAbierto(false);
    setResaltada(-1);
    setDescartada(false);
    completarCampos(s);
    onElegida?.(s);
  }

  async function buscar(consulta: string) {
    pedido.current?.abort();
    const control = new AbortController();
    pedido.current = control;
    setEstado("buscando");
    setAviso(null);
    try {
      const url = `/api/ubicacion?${new URLSearchParams({ q: consulta, proposito })}`;
      const respuesta = await fetch(url, { signal: control.signal });
      const cuerpo = (await respuesta.json().catch(() => null)) as { resultados?: Sugerencia[]; error?: string } | null;
      if (control.signal.aborted) return;
      if (!respuesta.ok) {
        setAviso(cuerpo?.error ?? "No pudimos buscar la dirección ahora.");
        setEstado("falla");
        return;
      }
      const lista = cuerpo?.resultados ?? [];
      setSugerencias(lista);
      setResaltada(-1);
      if (lista.length === 0) {
        setEstado("sin-resultados");
        return;
      }
      setEstado("listo");
      // Si lo escrito coincide con un lugar (calle, número y localidad), se toma solo.
      const clara = lista.find((s) => s.coincide);
      if (clara) elegir(clara);
    } catch {
      if (control.signal.aborted) return;
      setAviso("No pudimos buscar la dirección ahora.");
      setEstado("falla");
    }
  }

  function alEscribir(valor: string) {
    setTexto(valor);
    onCambioTexto?.(valor);
    if (elegida) onElegida?.(null);
    setElegida(null);
    setSugerencias([]);
    setResaltada(-1);
    setDescartada(false);
    setAviso(null);
    if (temporizador.current) clearTimeout(temporizador.current);
    pedido.current?.abort();
    if (valor.trim().length < MINIMO) {
      setEstado("reposo");
      setAbierto(false);
      return;
    }
    setAbierto(true);
    setEstado("buscando");
    temporizador.current = setTimeout(() => void buscar(valor.trim()), ESPERA_MS);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    // Con el menú cerrado, la flecha abajo lo vuelve a abrir si hay algo para elegir.
    if (!panelAbierto) {
      if (e.key === "ArrowDown" && (estado === "listo" || estado === "sin-resultados") && (opciones.length > 0 || estado === "sin-resultados")) {
        e.preventDefault();
        setAbierto(true);
      }
      return;
    }
    const { accion, frenar } = teclaDelMenu(e.key, resaltada, conOpciones ? opciones.length : 0);
    if (frenar) {
      e.preventDefault();
      // Escape cierra solo el menú, no el cajón o el diálogo que tenga el campo adentro.
      if (e.key === "Escape") e.stopPropagation();
    }
    if (accion === "mover-abajo") setResaltada((r) => mover(r, opciones.length, "abajo"));
    else if (accion === "mover-arriba") setResaltada((r) => mover(r, opciones.length, "arriba"));
    else if (accion === "elegir") {
      const s = opciones[resaltada];
      if (s) elegir(s);
    } else if (accion === "cerrar") setAbierto(false);
  }

  function alEnfocar() {
    // Al volver al campo con resultados todavía sin elegir, el menú reaparece.
    if (hayQueElegir || estado === "buscando") setAbierto(true);
  }

  const hayOsm = (elegida ? [elegida] : sugerencias).some((s) => s.fuente === "osm");

  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      onBlur={(e) => {
        // Se cierra al salir del campo y del menú (un toque dentro del menú no cuenta como salir).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAbierto(false);
      }}
    >
      <label htmlFor={id} className="text-xs font-semibold text-apagado">
        {etiqueta}
        {requerido && <span className="ml-0.5 text-[#dc2626]">*</span>}
      </label>
      <div className="relative">
        <Input
          ref={entrada}
          id={id}
          name={name}
          value={texto}
          onChange={(e) => alEscribir(e.target.value)}
          onKeyDown={alTeclear}
          onFocus={alEnfocar}
          autoComplete="off"
          placeholder={placeholder}
          required={required}
          role="combobox"
          aria-expanded={panelAbierto}
          aria-autocomplete="list"
          aria-controls={conOpciones ? listaId : undefined}
          aria-activedescendant={conOpciones && resaltada >= 0 ? opcionId(resaltada) : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={estadoId}
        />

        {panelAbierto && (
          <div className="absolute top-full right-0 left-0 z-30 mt-1.5 max-h-[18rem] overflow-auto rounded-caja border border-borde bg-white shadow-dropdown">
            {estado === "buscando" && <p className="m-0 px-3.5 py-3 text-[13px] text-sutil">Buscando la ubicación…</p>}
            {estado === "sin-resultados" && (
              <p className="m-0 px-3.5 py-3 text-[13px] leading-snug text-apagado">
                No encontramos esa dirección. Podés seguir y completar el partido y la provincia a mano.
              </p>
            )}
            {estado === "falla" && (
              <p className="m-0 px-3.5 py-3 text-[13px] leading-snug text-apagado">
                {aviso} Podés seguir y completar el partido y la provincia a mano.
              </p>
            )}
            {conOpciones && (
              <>
                <p aria-hidden className="m-0 border-b border-linea px-3.5 py-2 text-[11px] font-semibold tracking-[.06em] text-sutil uppercase">
                  {elegida ? "Otras opciones" : "Elegí cuál es tu dirección"}
                </p>
                <ul id={listaId} role="listbox" aria-label="Direcciones encontradas" className="m-0 list-none p-0">
                  {opciones.map((s, i) => (
                    <li
                      key={s.token}
                      id={opcionId(i)}
                      role="option"
                      aria-selected={i === resaltada}
                      // Con onMouseDown frenado el foco se queda en el campo y el toque elige sin cerrar el menú antes de tiempo.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => elegir(s)}
                      onMouseEnter={() => setResaltada(i)}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-sm leading-snug text-tinta",
                        i === resaltada ? "bg-navy-50" : "hover:bg-app",
                      )}
                    >
                      <span className="min-w-0">{s.etiqueta}</span>
                      <span className={cn("flex-none text-[11px] font-semibold", s.exacta ? "text-verde" : "text-apagado")}>
                        {s.exacta ? "✓ con número" : "≈ aproximada"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-linea px-3.5 py-2">
                  {!elegida ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setDescartada(true);
                        setAbierto(false);
                      }}
                      className="cursor-pointer text-xs font-semibold text-navy-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
                    >
                      Ninguna es la mía
                    </button>
                  ) : (
                    <span />
                  )}
                  {opciones.some((s) => s.fuente === "osm") && (
                    <span className="text-[11px] text-sutil">Datos de © colaboradores de OpenStreetMap</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {enviarFirma && <input type="hidden" name="ubicacion" value={elegida?.token ?? ""} />}

      <div id={estadoId} role="status" aria-live="polite" className="flex flex-col gap-1.5 text-xs">
        {error ? (
          <span role="alert" className="text-[#b91c1c]">
            {error}
          </span>
        ) : elegida ? (
          <span className="text-verde">
            <span aria-hidden>✓ </span>
            <strong className="font-semibold">Ubicación detectada:</strong> {elegida.etiqueta}
            {!elegida.exacta && <span className="text-apagado"> · Encontramos la calle pero no ese número: la ubicación es aproximada.</span>}
          </span>
        ) : descartada ? (
          <span className="text-apagado">No elegiste ninguna: al guardar intentamos ubicarla con lo que escribiste.</span>
        ) : estado === "buscando" && !panelAbierto ? (
          <span className="text-sutil">Buscando la ubicación…</span>
        ) : estado === "sin-resultados" && !panelAbierto ? (
          <span className="text-apagado">No encontramos esa dirección. Podés seguir y completar el partido y la provincia a mano.</span>
        ) : estado === "falla" && !panelAbierto ? (
          <span className="text-apagado">{aviso} Podés seguir y completar el partido y la provincia a mano.</span>
        ) : hayQueElegir && !panelAbierto ? (
          <span className="font-semibold text-tinta">Elegí cuál es tu dirección.</span>
        ) : ayuda && !panelAbierto ? (
          <span className="text-sutil">{ayuda}</span>
        ) : null}

        {(elegida || descartada || (hayQueElegir && !panelAbierto)) && sugerencias.length > (elegida ? 1 : 0) && (
          <button
            type="button"
            aria-expanded={panelAbierto}
            aria-controls={conOpciones ? listaId : undefined}
            onClick={() => {
              setDescartada(false);
              setAbierto((v) => !v);
              entrada.current?.focus();
            }}
            className="w-fit cursor-pointer text-xs font-semibold text-navy-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
          >
            {elegida ? "No es esta: ver otras opciones" : "Ver las opciones encontradas"}
          </button>
        )}

        {hayOsm && !panelAbierto && <span className="text-[11px] text-sutil">Ubicación con datos de © colaboradores de OpenStreetMap.</span>}
      </div>
    </div>
  );
}
