"use client";

import { useEffect, useRef, useState } from "react";
import { useFiltrosUrl } from "@/components/docente/filtros-url";
import { Input, Select } from "@/components/ui/campos";
import { TIPOS_INSTITUCION } from "@/lib/catalogo";
import { ESTADOS_INSTITUCION, ORDENES_INSTITUCIONES, type FiltrosInstituciones } from "@/lib/backoffice-instituciones";
import { CLAVES_PLAN, nombreDePlan } from "@/lib/cobros";

/**
 * Búsqueda y filtros del listado de instituciones. Todo vive en la URL (el listado lo arma el servidor):
 * cualquier cambio vuelve a la página 1. Los campos son no controlados; "Limpiar" los reinicia cambiando su `key`.
 */
export function InstFiltros({ valores }: { valores: FiltrosInstituciones }) {
  const { aplicar, pendiente } = useFiltrosUrl();
  const [reinicio, setReinicio] = useState(0);
  const demora = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(demora.current), []);
  const hayFiltros = !!(
    valores.q ||
    valores.tipo ||
    valores.plan ||
    valores.verificacion ||
    valores.estado ||
    valores.orden !== "nombre"
  );

  const cambiar = (cambios: Record<string, string>) => aplicar({ ...cambios, pagina: "" });

  return (
    <div role="search" aria-busy={pendiente} className="mb-3.5 flex flex-wrap items-center gap-2.5">
      <Input
        key={`q${reinicio}`}
        type="search"
        aria-label="Buscar por nombre, tipo o zona"
        placeholder="Buscar por nombre, tipo o zona"
        defaultValue={valores.q}
        onChange={(e) => {
          // Espera a que se deje de tipear; al buscar siempre se vuelve a la página 1.
          clearTimeout(demora.current);
          const texto = e.target.value.trim();
          demora.current = setTimeout(() => cambiar({ q: texto }), 300);
        }}
        className="max-w-[340px] min-w-[220px] flex-1"
      />
      <Select
        key={`t${reinicio}`}
        aria-label="Tipo de institución"
        defaultValue={valores.tipo}
        onChange={(e) => cambiar({ tipo: e.target.value })}
        className="w-[190px] max-w-full flex-none"
      >
        <option value="">Todos los tipos</option>
        {TIPOS_INSTITUCION.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Select
        key={`p${reinicio}`}
        aria-label="Plan"
        defaultValue={valores.plan}
        onChange={(e) => cambiar({ plan: e.target.value })}
        className="w-[170px] max-w-full flex-none"
      >
        <option value="">Todos los planes</option>
        {CLAVES_PLAN.map((p) => (
          <option key={p} value={p}>
            {nombreDePlan(p)}
          </option>
        ))}
      </Select>
      <Select
        key={`v${reinicio}`}
        aria-label="Verificación"
        defaultValue={valores.verificacion}
        onChange={(e) => cambiar({ verificacion: e.target.value })}
        className="w-[170px] max-w-full flex-none"
      >
        <option value="">Toda verificación</option>
        <option value="si">Verificadas</option>
        <option value="no">Sin verificar</option>
      </Select>
      <Select
        key={`e${reinicio}`}
        aria-label="Estado"
        defaultValue={valores.estado}
        onChange={(e) => cambiar({ estado: e.target.value })}
        className="w-[170px] max-w-full flex-none"
      >
        <option value="">Todos los estados</option>
        {ESTADOS_INSTITUCION.map((e) => (
          <option key={e.clave} value={e.clave}>
            {e.etiqueta}
          </option>
        ))}
      </Select>
      <Select
        key={`o${reinicio}`}
        aria-label="Ordenar"
        defaultValue={valores.orden}
        onChange={(e) => cambiar({ orden: e.target.value === "nombre" ? "" : e.target.value })}
        className="w-[200px] max-w-full flex-none"
      >
        {ORDENES_INSTITUCIONES.map((o) => (
          <option key={o.clave} value={o.clave}>
            {o.etiqueta}
          </option>
        ))}
      </Select>
      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            setReinicio((n) => n + 1);
            aplicar({ q: "", tipo: "", plan: "", verificacion: "", estado: "", orden: "", pagina: "" });
          }}
          className="text-[13px] leading-none font-medium text-naranja hover:underline"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
