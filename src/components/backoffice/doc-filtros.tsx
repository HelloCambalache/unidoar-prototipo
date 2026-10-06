"use client";

import { useEffect, useRef, useState } from "react";
import { useFiltrosUrl } from "@/components/docente/filtros-url";
import { Input, Select } from "@/components/ui/campos";
import {
  FILTROS_VERIFICACION,
  ORDENES_BO,
  hayFiltrosBoDocentes,
  type FiltrosBoDocentes,
} from "@/lib/backoffice-docentes";

/**
 * Filtros del listado de docentes. El estado vive en la URL (?q=&disciplina=&zona=&verificacion=&orden=):
 * este componente solo la actualiza (el texto, con demora) y la página vuelve a leerla en el servidor.
 * Las disciplinas y zonas llegan de las tablas `asignaturas` y `zonas`.
 */
export function DocFiltros({
  filtros,
  disciplinas,
  zonas,
}: {
  filtros: FiltrosBoDocentes;
  disciplinas: string[];
  zonas: string[];
}) {
  const { aplicar, pendiente } = useFiltrosUrl();
  const demora = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(demora.current), []);
  const [q, setQ] = useState(filtros.q);
  const [disciplina, setDisciplina] = useState(filtros.disciplina);
  const [zona, setZona] = useState(filtros.zona);
  const [verificacion, setVerificacion] = useState<string>(filtros.verificacion);
  const [orden, setOrden] = useState<string>(filtros.orden);

  // Una disciplina o zona de la URL que ya no está en el catálogo se conserva para que el filtro no mienta.
  const conActual = (opciones: string[], actual: string) => (actual && !opciones.includes(actual) ? [...opciones, actual] : opciones);

  const limpiar = () => {
    clearTimeout(demora.current);
    setQ("");
    setDisciplina("");
    setZona("");
    setVerificacion("");
    setOrden("scoring");
    aplicar({ q: "", disciplina: "", zona: "", verificacion: "", orden: "", pagina: "" });
  };

  return (
    <div role="search" aria-busy={pendiente} className="mb-3.5 flex flex-wrap items-center gap-2.5">
      <Input
        type="search"
        value={q}
        maxLength={80}
        aria-label="Buscar por nombre, disciplina o zona"
        placeholder="Buscar por nombre, disciplina o zona"
        className="max-w-[340px] min-w-[220px] flex-1 max-[640px]:max-w-none"
        onChange={(e) => {
          const valor = e.target.value;
          setQ(valor);
          clearTimeout(demora.current);
          demora.current = setTimeout(() => aplicar({ q: valor.trim(), pagina: "" }), 300);
        }}
      />
      <Select
        aria-label="Filtrar por disciplina"
        value={disciplina}
        className="w-[200px] max-w-full flex-none"
        onChange={(e) => {
          setDisciplina(e.target.value);
          aplicar({ disciplina: e.target.value, pagina: "" });
        }}
      >
        <option value="">Todas las disciplinas</option>
        {conActual(disciplinas, disciplina).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrar por zona"
        value={zona}
        className="w-[170px] max-w-full flex-none"
        onChange={(e) => {
          setZona(e.target.value);
          aplicar({ zona: e.target.value, pagina: "" });
        }}
      >
        <option value="">Todas las zonas</option>
        {conActual(zonas, zona).map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filtrar por verificación"
        value={verificacion}
        className="w-[170px] max-w-full flex-none"
        onChange={(e) => {
          setVerificacion(e.target.value);
          aplicar({ verificacion: e.target.value, pagina: "" });
        }}
      >
        <option value="">Toda verificación</option>
        {FILTROS_VERIFICACION.map((f) => (
          <option key={f.valor} value={f.valor}>
            {f.etiqueta}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Ordenar"
        value={orden}
        className="w-[180px] max-w-full flex-none"
        onChange={(e) => {
          setOrden(e.target.value);
          aplicar({ orden: e.target.value === "scoring" ? "" : e.target.value, pagina: "" });
        }}
      >
        {ORDENES_BO.map((o) => (
          <option key={o.clave} value={o.clave}>
            {o.etiqueta}
          </option>
        ))}
      </Select>
      {(hayFiltrosBoDocentes(filtros) || filtros.orden !== "scoring") && (
        <button type="button" onClick={limpiar} className="text-[13px] leading-none font-medium text-naranja hover:underline">
          Limpiar
        </button>
      )}
    </div>
  );
}
