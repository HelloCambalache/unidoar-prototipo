"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/campos";
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
 * para el domicilio de una persona) y completa el partido y la provincia. Si lo escrito coincide con un solo lugar
 * ("Av. Maipú 1234, Vicente López") lo toma solo; si puede ser de varios, pide elegir. La sugerencia elegida viaja en el
 * campo oculto `ubicacion` (firmada por el servidor) o, en un formulario con estado propio, por `onElegida`. Si no
 * encuentra nada, no bloquea: se completa a mano como siempre.
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
  const entrada = useRef<HTMLInputElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedido = useRef<AbortController | null>(null);
  const [texto, setTexto] = useState(defaultValue);
  const [estado, setEstado] = useState<Estado>("reposo");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [elegida, setElegida] = useState<Sugerencia | null>(null);
  const [verOtras, setVerOtras] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      pedido.current?.abort();
    },
    [],
  );

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
    setVerOtras(false);
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
    setVerOtras(false);
    setAviso(null);
    if (temporizador.current) clearTimeout(temporizador.current);
    pedido.current?.abort();
    if (valor.trim().length < MINIMO) {
      setEstado("reposo");
      return;
    }
    setEstado("buscando");
    temporizador.current = setTimeout(() => void buscar(valor.trim()), ESPERA_MS);
  }

  const hayOsm = (elegida ? [elegida] : sugerencias).some((s) => s.fuente === "osm");
  const hayQueElegir = estado === "listo" && !elegida;
  const otras = sugerencias.filter((s) => s !== elegida);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-semibold text-apagado">
        {etiqueta}
        {requerido && <span className="ml-0.5 text-[#dc2626]">*</span>}
      </label>
      <Input
        ref={entrada}
        id={id}
        name={name}
        value={texto}
        onChange={(e) => alEscribir(e.target.value)}
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={estadoId}
      />
      {enviarFirma && <input type="hidden" name="ubicacion" value={elegida?.token ?? ""} />}

      <div id={estadoId} role="status" aria-live="polite" className="flex flex-col gap-1.5 text-xs">
        {error ? (
          <span role="alert" className="text-[#b91c1c]">
            {error}
          </span>
        ) : estado === "buscando" ? (
          <span className="text-sutil">Buscando la ubicación…</span>
        ) : elegida ? (
          <span className="text-verde">
            <span aria-hidden>✓ </span>
            <strong className="font-semibold">Ubicación detectada:</strong> {elegida.etiqueta}
            {!elegida.exacta && <span className="text-apagado"> · Encontramos la calle pero no ese número: la ubicación es aproximada.</span>}
          </span>
        ) : estado === "sin-resultados" ? (
          <span className="text-apagado">No encontramos esa dirección. Podés seguir y completar el partido y la provincia a mano.</span>
        ) : estado === "falla" ? (
          <span className="text-apagado">{aviso} Podés seguir y completar el partido y la provincia a mano.</span>
        ) : hayQueElegir ? (
          <span className="font-semibold text-tinta">Elegí cuál es tu dirección:</span>
        ) : ayuda ? (
          <span className="text-sutil">{ayuda}</span>
        ) : null}

        {(hayQueElegir || (elegida && verOtras)) && otras.length > 0 && (
          <ul aria-label="Direcciones encontradas" className="m-0 flex list-none flex-col gap-1 p-0">
            {otras.map((s) => (
              <li key={s.token}>
                <button
                  type="button"
                  onClick={() => elegir(s)}
                  className="min-h-11 w-full cursor-pointer rounded-xl border border-borde bg-white px-3 py-2 text-left text-sm text-tinta transition-colors hover:bg-app focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
                >
                  {s.etiqueta}
                  {!s.exacta && <span className="text-xs text-sutil"> · aproximada</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {elegida && otras.length > 0 && (
          <button
            type="button"
            aria-expanded={verOtras}
            onClick={() => setVerOtras((v) => !v)}
            className="w-fit cursor-pointer text-xs font-semibold text-navy-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
          >
            {verOtras ? "Ocultar otras opciones" : "No es esta: ver otras opciones"}
          </button>
        )}

        {hayOsm && <span className="text-[11px] text-sutil">Ubicación con datos de © colaboradores de OpenStreetMap.</span>}
      </div>
    </div>
  );
}
