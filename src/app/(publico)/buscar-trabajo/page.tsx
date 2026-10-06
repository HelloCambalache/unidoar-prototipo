import type { Metadata } from "next";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { MuroCuenta } from "@/components/publico/muro-cuenta";
import { Paginacion } from "@/components/publico/paginacion";
import { accionPostular, sesionPublica } from "@/components/publico/sesion";
import { TarjetaBusqueda } from "@/components/publico/tarjeta-busqueda";
import { Boton, BotonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/campos";
import { CATEGORIAS, CATEGORIA_INFO } from "@/lib/catalogo";
import { plural } from "@/lib/publico";
import { listarBusquedasPublicas } from "@/lib/queries/publico";

export const metadata: Metadata = {
  title: "Búsquedas abiertas",
  description:
    "Todo lo que las instituciones están buscando ahora mismo: docentes, entrenadores y guardavidas. Mirá sin cuenta; para postularte necesitás una.",
};

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

type Params = Promise<Record<string, string | string[] | undefined>>;
const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BuscarTrabajo({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const q = primero(sp.q)?.trim().slice(0, 80) || undefined;
  const cat = primero(sp.categoria);
  const categoria = CATEGORIAS.find((c) => c === cat);
  const pagina = Math.max(1, Number.parseInt(primero(sp.pagina) ?? "1", 10) || 1);

  const [{ filas, total, paginas, pagina: paginaActual }, sesion] = await Promise.all([
    listarBusquedasPublicas({ q, categoria, pagina }),
    sesionPublica(),
  ]);
  const filtrando = !!(q || categoria);

  return (
    <div className="flex-1 bg-app px-12 py-9 max-[860px]:px-4 max-[860px]:py-5">
      <div className="mx-auto max-w-[1320px]">
        <h1 className="mb-1.5 font-display text-[34px] leading-[1.2] font-bold tracking-[-0.02em] text-tinta max-[560px]:text-[28px]">
          Búsquedas abiertas
        </h1>
        <p className="mb-[22px] text-[15px] leading-normal text-apagado">
          Todo lo que las instituciones están buscando ahora mismo. Mirá sin cuenta; para postularte necesitás una.
        </p>

        {!sesion.rol && (
          <MuroCuenta
            titulo="Creá tu cuenta para postularte"
            bajada="Gratis para docentes. Te lleva dos minutos y después te postulás con un clic."
          />
        )}

        <form role="search" method="get" action="/buscar-trabajo" className="mb-5 flex flex-wrap items-center gap-2.5">
          <label htmlFor="filtro-q" className="sr-only">
            Buscar por institución o materia
          </label>
          <Input
            id="filtro-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Buscar por institución o materia"
            maxLength={80}
            className="max-w-[360px] min-w-[220px] flex-1"
          />
          <label htmlFor="filtro-categoria" className="sr-only">
            Categoría
          </label>
          <Select id="filtro-categoria" name="categoria" defaultValue={categoria ?? ""} className="w-auto max-w-[220px]">
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_INFO[c].label}
              </option>
            ))}
          </Select>
          <Boton type="submit">Buscar</Boton>
          {filtrando && (
            <BotonLink href="/buscar-trabajo" variante="fantasma">
              Limpiar filtros
            </BotonLink>
          )}
        </form>

        <p aria-live="polite" className="mb-4 text-[13px] text-apagado">
          {plural(total, "búsqueda abierta", "búsquedas abiertas")}
          {q ? ` para “${q}”` : ""}
        </p>

        {filas.length === 0 ? (
          <EstadoVacio
            titulo={filtrando ? "No encontramos búsquedas con esos filtros" : "Todavía no hay búsquedas abiertas"}
            texto={
              filtrando
                ? "Probá con otra palabra o quitá la categoría para ver más resultados."
                : "Cuando una institución publique una búsqueda, la vas a ver acá."
            }
            accion={
              filtrando ? (
                <BotonLink href="/buscar-trabajo" variante="secundario" tamano="sm">
                  Ver todas las búsquedas
                </BotonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="m-0 grid list-none grid-cols-3 gap-[18px] p-0 max-[760px]:grid-cols-2 max-[700px]:grid-cols-1">
            {filas.map((b) => (
              <li key={b.id} className="grid">
                <TarjetaBusqueda busqueda={b} accion={accionPostular(sesion, b.id)} />
              </li>
            ))}
          </ul>
        )}

        <Paginacion
          base="/buscar-trabajo"
          parametros={{ q, categoria }}
          pagina={paginaActual}
          paginas={paginas}
        />
      </div>
    </div>
  );
}
