"use client";

import Link from "next/link";
import { useId } from "react";
import { Icono } from "@/components/icons";
import { Boton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/campos";
import { Insignia } from "@/components/ui/insignia";
import { NIVELES } from "@/lib/catalogo";
import {
  hrefBuscador,
  hrefFrase,
  ORDENES,
  RUTA_BUSCADOR,
  TIPOS_FILTRO,
  type FiltrosDocentes,
} from "@/lib/filtros-docentes";
import { cn } from "@/lib/utils";
import { useFiltrosEnUrl } from "./usar-filtros-docentes";

const BOTON_FILTRO =
  "inline-flex h-10 flex-none items-center gap-1.5 rounded-lg px-4 text-[13px] leading-none font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-navy-700/30";
const INACTIVO = "border border-borde bg-white text-tinta-2 hover:border-borde-fuerte hover:bg-superficie";

/**
 * Parte de arriba del buscador: un solo campo para buscar por nombre, por disciplina o contando qué se necesita
 * ("profe de inglés para secundario, turno mañana") —el servidor decide si lo escrito pide filtros o es un nombre—, más
 * el orden y los filtros rápidos (nivel, tipo, favoritos, búsqueda rápida, verificados). Todo termina en la URL.
 */
export function BarraBuscadorDocentes({
  ruta,
  rutaOtraPantalla,
  rapidas,
  filtros: delServidor,
  leido,
  sugerencias,
  puedeOrdenarPorCercania,
}: {
  ruta: string;
  /** La otra pantalla del buscador (catálogo ↔ búsquedas rápidas), a la que lleva el botón "Búsqueda rápida". */
  rutaOtraPantalla: string;
  rapidas: boolean;
  filtros: FiltrosDocentes;
  /** Lo que se entendió de lo escrito; null si no se escribió nada. */
  leido: { etiquetas: string[]; reconocido: boolean; sinEntender: string[] } | null;
  sugerencias: string[];
  puedeOrdenarPorCercania: boolean;
}) {
  const { filtros, aplicar, pendiente, router, empezar } = useFiltrosEnUrl(ruta, delServidor);
  const idSugerencias = useId();
  const limpiarHref = hrefFrase(rapidas ? ruta : RUTA_BUSCADOR, "", filtros.busqueda);
  // Un texto que vino solo en la URL (un enlace de antes, sin frase) también se muestra en el campo: si no, filtraría sin que se vea.
  const escrito = delServidor.frase || delServidor.texto;
  const textoBuscado = delServidor.texto;

  return (
    <>
      <section aria-label="Buscador" className="mb-4 rounded-tarjeta border border-linea bg-white px-[18px] py-4">
        <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-navy-700">
          <Icono nombre="chispas" tamano={17} trazo={1.6} relleno />
          <span className="text-sm leading-none font-semibold">Buscá con IA</span>
          <span className="text-[12.5px] leading-none font-normal text-apagado">
            por nombre, por disciplina o contándonos qué necesitás
          </span>
        </div>
        <form
          key={`${delServidor.frase}\u0000${delServidor.texto}`}
          role="search"
          className="flex flex-wrap gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            const frase = String(new FormData(e.currentTarget).get("frase") ?? "");
            // Lo escrito reemplaza los filtros y arranca siempre en el catálogo: el servidor decide si pide filtros o es un
            // nombre, y si pide algo urgente la manda a "Búsquedas rápidas".
            empezar(() => router.push(hrefFrase(RUTA_BUSCADOR, frase, filtros.busqueda)));
          }}
        >
          <Input
            type="search"
            name="frase"
            aria-label="Buscar por nombre, por disciplina o contando qué necesitás"
            defaultValue={escrito}
            maxLength={200}
            list={idSugerencias}
            enterKeyHint="search"
            placeholder="Ej.: «profe de inglés para secundario, turno mañana»"
            className="min-w-[240px] flex-1"
          />
          <datalist id={idSugerencias}>
            {sugerencias.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Boton type="submit" disabled={pendiente} className="flex-none">
            Buscar
          </Boton>
        </form>
        {(leido || textoBuscado) && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-borde pt-3.5">
            <span className="text-[12.5px] leading-none font-medium text-apagado">Entendimos:</span>
            {(leido?.etiquetas ?? []).map((l) => (
              <Insignia key={l} tono="azul">
                {l}
              </Insignia>
            ))}
            {textoBuscado && <Insignia tono="azul">Nombre o disciplina: «{textoBuscado}»</Insignia>}
            {leido && !leido.reconocido && !textoBuscado && (
              <Insignia tono="azul">No reconocimos filtros: te mostramos el catálogo completo</Insignia>
            )}
            <Link href={limpiarHref} className="ml-auto text-[12.5px] leading-none font-medium text-sutil hover:text-tinta">
              Limpiar
            </Link>
            {leido && leido.reconocido && leido.sinEntender.length > 0 && (
              <p className="m-0 basis-full text-[12.5px] leading-normal text-apagado">
                No pudimos aplicar como filtro: {leido.sinEntender.map((p) => `«${p}»`).join(", ")}. Si es un nombre, buscalo solo, sin el
                resto de la frase; si es otra cosa, usá los filtros de al lado.
              </p>
            )}
          </div>
        )}
      </section>

      <div className={cn("mb-[18px] flex flex-wrap gap-2.5 transition-opacity", pendiente && "opacity-70")}>
        <Select
          aria-label="Ordenar por"
          value={filtros.orden}
          onChange={(e) => aplicar({ orden: e.target.value as FiltrosDocentes["orden"] })}
          className="h-10 max-w-[250px] py-0"
        >
          {ORDENES.filter((o) => o.clave !== "cercania" || puedeOrdenarPorCercania).map((o) => (
            <option key={o.clave} value={o.clave}>
              Ordenar: {o.etiqueta}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Nivel"
          value={filtros.nivel ?? ""}
          onChange={(e) => aplicar({ nivel: e.target.value || null })}
          className="h-10 max-w-[170px] py-0"
        >
          <option value="">Todos los niveles</option>
          {NIVELES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Tipo de búsqueda"
          title="Según las búsquedas a las que el profesional se postuló o fue invitado"
          value={filtros.tipo ?? ""}
          onChange={(e) => aplicar({ tipo: e.target.value || null })}
          className="h-10 max-w-[170px] py-0"
        >
          <option value="">Todos los tipos</option>
          {TIPOS_FILTRO.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <div className="flex flex-none flex-wrap gap-2.5">
          <button
            type="button"
            aria-pressed={filtros.soloFavoritos}
            onClick={() => aplicar({ soloFavoritos: !filtros.soloFavoritos })}
            className={cn(BOTON_FILTRO, filtros.soloFavoritos ? "bg-navy-700 text-white" : INACTIVO)}
          >
            ★ Favoritos
          </button>
          <Link
            href={hrefBuscador(rutaOtraPantalla, filtros)}
            aria-current={rapidas ? "page" : undefined}
            className={cn(BOTON_FILTRO, rapidas ? "bg-naranja text-white hover:text-white" : INACTIVO)}
          >
            <Icono nombre="cronometro" tamano={13} trazo={2} />
            Búsqueda rápida
          </Link>
          <button
            type="button"
            aria-pressed={filtros.soloVerificados}
            onClick={() => aplicar({ soloVerificados: !filtros.soloVerificados })}
            className={cn(BOTON_FILTRO, filtros.soloVerificados ? "bg-verde text-white" : INACTIVO)}
          >
            <Icono nombre="tilde" tamano={13} trazo={2.4} />
            Verificados
          </button>
        </div>
      </div>
    </>
  );
}
