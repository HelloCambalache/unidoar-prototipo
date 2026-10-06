"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Input, Select } from "@/components/ui/campos";
import type { EstadoFiltro } from "@/lib/busquedas";

const OPCIONES: { valor: EstadoFiltro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos los estados" },
  { valor: "activa", etiqueta: "Activa" },
  { valor: "rapida", etiqueta: "Rápida" },
  { valor: "pausada", etiqueta: "Pausada" },
];

/**
 * Filtros de Publicaciones. El estado vive en la URL (?q=&estado=&tab=) para que la vista
 * se pueda compartir; este componente solo la actualiza (el texto, con debounce).
 */
export function FiltrosBusquedas({
  pestana,
  q,
  estado,
  hayPausadas,
}: {
  pestana: "activas" | "cerradas";
  q: string;
  estado: EstadoFiltro;
  hayPausadas: boolean;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [texto, setTexto] = useState(q);
  const [estadoLocal, setEstadoLocal] = useState(estado);
  // Lo último que escribió la persona, para que el debounce no use valores viejos.
  const actual = useRef({ texto: q, estado });
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  const aplicar = () => {
    const params = new URLSearchParams();
    if (pestana === "cerradas") params.set("tab", "cerradas");
    const buscado = actual.current.texto.trim();
    if (buscado) params.set("q", buscado);
    if (pestana === "activas" && actual.current.estado !== "todos") params.set("estado", actual.current.estado);
    const qs = params.toString();
    empezar(() => router.replace(`/institucion/busquedas${qs ? `?${qs}` : ""}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap gap-2.5" aria-busy={pendiente}>
      <div className="w-full max-w-[280px] max-[640px]:max-w-none">
        <Input
          type="search"
          name="q"
          value={texto}
          aria-label="Buscar por puesto o docente"
          placeholder="Buscar por puesto o docente"
          onChange={(e) => {
            setTexto(e.target.value);
            actual.current.texto = e.target.value;
            clearTimeout(espera.current);
            espera.current = setTimeout(aplicar, 350);
          }}
        />
      </div>
      {pestana === "activas" && (
        <div className="w-full max-w-[170px] max-[640px]:max-w-none">
          <Select
            aria-label="Filtrar por estado"
            value={estadoLocal}
            onChange={(e) => {
              const valor = e.target.value as EstadoFiltro;
              setEstadoLocal(valor);
              actual.current.estado = valor;
              clearTimeout(espera.current);
              aplicar();
            }}
          >
            {OPCIONES.filter((o) => o.valor !== "pausada" || hayPausadas || estado === "pausada").map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
