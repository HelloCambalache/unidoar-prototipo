import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import Link from "next/link";
import { CatEditor } from "@/components/backoffice/cat-editor";
import { FranjaMetricas } from "@/components/backoffice/inst-metricas";
import { Tarjeta } from "@/components/ui/tarjeta";
import { claveDeNombre, DESCRIPCION_CATEGORIA } from "@/lib/backoffice-categorias";
import { CATEGORIA_INFO, CATEGORIAS } from "@/lib/catalogo";
import { catalogoDeCategoria, resumenDeCategorias } from "@/lib/queries/backoffice-categorias";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Categorías · Backoffice" };
export const dynamic = "force-dynamic";

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CategoriasBackoffice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // El layout ya lo exige, pero acá se leen datos sensibles: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const sp = await searchParams;
  const pedida = uno(sp.categoria);
  const categoria = CATEGORIAS.find((c) => c === pedida) ?? CATEGORIAS[0];
  const consulta = uno(sp.q).trim().slice(0, 80);

  const [resumen, catalogo] = await Promise.all([resumenDeCategorias(), catalogoDeCategoria(categoria)]);
  const info = CATEGORIA_INFO[categoria];

  // La búsqueda mira el nombre de la asignatura y el del rubro (si coincide el rubro, se muestra entero).
  const clave = claveDeNombre(consulta);
  const rubros = clave
    ? catalogo.rubros
        .map((g) =>
          claveDeNombre(g.rubro).includes(clave)
            ? g
            : { ...g, asignaturas: g.asignaturas.filter((a) => claveDeNombre(a.nombre).includes(clave)) },
        )
        .filter((g) => g.asignaturas.length > 0)
    : catalogo.rubros;
  const totalAsignaturas = catalogo.rubros.reduce((n, g) => n + g.asignaturas.length, 0);

  return (
    <>
      <div className="mb-5">
        <h1 className="m-0 mb-1.5 text-[24px] leading-[1.2] font-semibold tracking-[-0.018em] max-[860px]:text-[22px]">Categorías</h1>
        <p className="m-0 text-sm leading-normal text-apagado">
          Categorías de cargo y sus asignaturas o disciplinas. Es lo que ven las instituciones al publicar una búsqueda y los
          profesionales al armar su perfil.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <nav
          aria-label="Categorías de cargo"
          className="w-[260px] max-w-full flex-none overflow-hidden rounded-ud border border-borde bg-white"
        >
          <div className="border-b border-borde px-4 py-3.5 text-[11px] leading-none font-semibold tracking-[.06em] text-sutil uppercase">
            Categorías de cargo
          </div>
          {resumen.map((c) => {
            const activa = c.categoria === categoria;
            return (
              <Link
                key={c.categoria}
                href={`/backoffice/categorias?categoria=${c.categoria}`}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-2.5 border-b border-[#F0EFEA] px-4 py-[13px] text-sm leading-tight text-tinta last:border-b-0 hover:bg-[#F7F8FD] hover:text-tinta",
                  activa ? "bg-navy-50/60 font-semibold text-navy-700" : "font-medium",
                )}
              >
                {CATEGORIA_INFO[c.categoria].plural}
                <span className="rounded-full bg-[#F0EFEA] px-2 py-1 text-xs leading-none font-medium text-apagado">
                  {c.asignaturas}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-[320px] flex-1 flex-col gap-4">
          <Tarjeta className="p-[22px]">
            <div className="mb-[18px]">
              <h2 className="m-0 mb-1 text-[19px] leading-tight font-semibold">{info.plural}</h2>
              <div className="text-[13px] leading-[1.4] text-apagado">{DESCRIPCION_CATEGORIA[categoria]}</div>
            </div>
            <FranjaMetricas
              minimo={130}
              className="bg-superficie"
              items={[
                { valor: catalogo.rubros.length, etiqueta: "Rubros" },
                { valor: totalAsignaturas, etiqueta: "Asignaturas" },
                { valor: catalogo.docentes, etiqueta: "Profesionales con perfil" },
                { valor: catalogo.busquedasActivas, etiqueta: "Búsquedas activas" },
              ]}
            />
          </Tarjeta>

          <CatEditor
            categoria={categoria}
            rubros={rubros}
            rubrosCompletos={catalogo.rubros.map((g) => ({ rubro: g.rubro, cantidad: g.asignaturas.length }))}
            consulta={consulta}
            totalAsignaturas={totalAsignaturas}
          />

          <p className="m-0 text-[12.5px] leading-normal text-sutil">
            Al renombrar una asignatura se actualiza también en los perfiles profesionales y en las búsquedas que ya la usan. Si la
            eliminás, deja de ofrecerse al publicar búsquedas y en el alta, pero se mantiene en lo que ya existe. Las categorías de
            cargo son fijas: Educador, Entrenador y Guardavidas.
          </p>
        </div>
      </div>
    </>
  );
}
