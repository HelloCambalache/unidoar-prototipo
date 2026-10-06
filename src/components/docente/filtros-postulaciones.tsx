"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Boton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/campos";
import { hrefPostulaciones, type FiltrosPostulaciones } from "@/lib/oportunidades";

/** Búsqueda por texto y filtros de nivel y zona de "Mis postulaciones". Viven en la URL. */
export function FiltrosPostulacionesBarra({
  filtros,
  niveles,
  zonas,
}: {
  filtros: FiltrosPostulaciones;
  niveles: string[];
  zonas: string[];
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [texto, setTexto] = useState(filtros.q ?? "");
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);

  // Cambiar un filtro cierra el cajón: la postulación abierta puede no estar en el nuevo resultado.
  const aplicar = (cambios: { q?: string; nivel?: string; zona?: string }) =>
    empezar(() => router.replace(hrefPostulaciones(filtros, { ...cambios, abrir: null }), { scroll: false }));

  const limpiar = () => {
    clearTimeout(espera.current);
    setTexto("");
    empezar(() => router.replace(hrefPostulaciones({ tab: filtros.tab }), { scroll: false }));
  };

  const hayFiltros = Boolean(filtros.q || filtros.nivel || filtros.zona || texto);

  return (
    <div aria-busy={pendiente} className="mb-4 flex flex-wrap gap-2.5">
      <Input
        type="search"
        aria-label="Buscar por puesto o institución"
        placeholder="Buscar por puesto o institución"
        value={texto}
        maxLength={80}
        onChange={(e) => {
          const nuevo = e.target.value;
          setTexto(nuevo);
          clearTimeout(espera.current);
          espera.current = setTimeout(() => aplicar({ q: nuevo.trim() }), 350);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          clearTimeout(espera.current);
          aplicar({ q: e.currentTarget.value.trim() });
        }}
        className="min-w-[200px] flex-1"
      />
      <Select
        aria-label="Nivel"
        value={filtros.nivel ?? ""}
        onChange={(e) => aplicar({ nivel: e.target.value })}
        className="w-auto max-w-[160px] min-w-[140px]"
      >
        <option value="">Todos los niveles</option>
        {niveles.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Zona"
        value={filtros.zona ?? ""}
        onChange={(e) => aplicar({ zona: e.target.value })}
        className="w-auto max-w-[200px] min-w-[140px]"
      >
        <option value="">Todas las zonas</option>
        {zonas.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </Select>
      {hayFiltros && (
        <Boton variante="fantasma" onClick={limpiar}>
          Limpiar
        </Boton>
      )}
    </div>
  );
}
