import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { PaginacionLista } from "@/components/institucion/paginacion-lista";
import { Boton, BotonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/campos";
import { Avatar, Insignia } from "@/components/ui/insignia";
import { Pestanas } from "@/components/ui/pestanas";
import { Tabla } from "@/components/ui/tabla";
import { requerirInstitucion } from "@/lib/auth";
import { CATEGORIA_INFO } from "@/lib/catalogo";
import { fechaCorta } from "@/lib/fechas";
import { baseDeDocentes, PESTANAS_BASE, type FilaBase, type PestanaBase } from "@/lib/queries/profesionales";
import { iniciales } from "@/lib/utils";

export const metadata: Metadata = { title: "Profesionales" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const ORIGEN: Record<FilaBase["origen"], { etiqueta: string; tono: "verde" | "azul" | "ambar" | "neutro" }> = {
  contratado: { etiqueta: "Contratado/a", tono: "verde" },
  postulo: { etiqueta: "Se postuló", tono: "azul" },
  cv: { etiqueta: "Envió CV", tono: "ambar" },
  invitado: { etiqueta: "Invitado/a", tono: "ambar" },
  favorito: { etiqueta: "Favorito", tono: "neutro" },
};

export default async function BaseDeDocentesPage({ searchParams }: Props) {
  const { usuario, institucion } = await requerirInstitucion();
  const sp = await searchParams;
  const pestana: PestanaBase = PESTANAS_BASE.find((p) => p.clave === uno(sp.tab))?.clave ?? "todos";
  const q = (uno(sp.q) ?? "").trim().slice(0, 80);
  const pagina = Math.max(1, Number.parseInt(uno(sp.pagina) ?? "1", 10) || 1);

  const base = await baseDeDocentes(institucion.id, usuario.id, { pestana, q, pagina });

  const href = (tab: PestanaBase, p = 1) => {
    const params = new URLSearchParams();
    if (tab !== "todos") params.set("tab", tab);
    if (q) params.set("q", q);
    if (p > 1) params.set("pagina", String(p));
    const qs = params.toString();
    return `/institucion/base-de-docentes${qs ? `?${qs}` : ""}`;
  };

  const stats = [
    { etiqueta: "Perfiles en la base", valor: base.stats.perfiles },
    { etiqueta: "Se postularon", valor: base.stats.postularon },
    { etiqueta: "Enviaron CV", valor: base.stats.cv },
    { etiqueta: "Invitados", valor: base.stats.invitados },
    { etiqueta: "Contratados", valor: base.stats.contratados },
  ];

  return (
    <div>
      <EncabezadoPagina
        titulo="Profesionales"
        bajada="Todos los perfiles que pasaron por tu institución: se postularon, te mandaron su CV, los invitaste, los contrataste o los guardaste en favoritos."
        acciones={
          <>
            <Boton
              variante="secundario"
              disabled
              title="Próximamente"
              className="border-navy-700 text-navy-700"
            >
              Importar CSV
              <Insignia tono="azul" className="px-2 py-1 text-[10px]">
                Próximamente
              </Insignia>
            </Boton>
            <Boton disabled title="Próximamente">
              + Cargar perfil
              <Insignia tono="azul" className="px-2 py-1 text-[10px]">
                Próximamente
              </Insignia>
            </Boton>
          </>
        }
      />

      <dl className="m-0 mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        {stats.map((s) => (
          <div key={s.etiqueta} className="rounded-ud border border-borde bg-white px-[18px] py-4">
            <dt className="mb-2 text-xs leading-snug font-medium text-apagado">{s.etiqueta}</dt>
            <dd className="m-0 text-2xl leading-none font-semibold text-navy-700">{s.valor}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <Pestanas
          activa={pestana}
          items={PESTANAS_BASE.map((p) => ({
            clave: p.clave,
            etiqueta: p.etiqueta,
            cantidad: base.cantidades[p.clave],
            href: href(p.clave),
          }))}
        />
        <form role="search" className="ml-auto min-w-[220px] max-w-[340px] flex-1 max-[860px]:max-w-none">
          {pestana !== "todos" && <input type="hidden" name="tab" value={pestana} />}
          <Input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={80}
            aria-label="Buscar por nombre o disciplina"
            placeholder="Buscar por nombre o disciplina"
          />
        </form>
      </div>

      {base.cantidades.todos === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay profesionales en tu base"
          texto="Acá van a aparecer quienes se postulen a tus búsquedas o te manden su CV, a quienes invites y los perfiles que guardes como favoritos."
          accion={<BotonLink href="/institucion/buscar-docentes">Buscar profesionales</BotonLink>}
        />
      ) : base.total === 0 ? (
        <EstadoVacio
          titulo="No hay perfiles que coincidan"
          texto="Probá con otro nombre o disciplina, o mirá todas las pestañas."
          accion={
            <BotonLink href="/institucion/base-de-docentes" variante="secundario">
              Ver toda la base
            </BotonLink>
          }
        />
      ) : (
        <Tabla className="min-w-[760px]">
          <thead>
            <tr>
              <th>Profesional</th>
              <th>Disciplina</th>
              <th>Origen</th>
              <th>Búsqueda</th>
              <th>Última actividad</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {base.filas.map((f) => {
              const origen = ORIGEN[f.origen];
              const info = CATEGORIA_INFO[f.categoria];
              const perfil = `/institucion/docente/${f.docenteId}?desde=base`;
              return (
                <tr key={f.docenteId}>
                  <td>
                    <div className="flex items-center gap-[11px]">
                      <Avatar
                        iniciales={iniciales(f.nombre)}
                        fotoUrl={f.fotoUrl}
                        tamano={34}
                        fondo={info.tint}
                        texto={info.ink}
                      />
                      <div className="min-w-0">
                        <Link href={perfil} className="font-semibold text-tinta hover:text-navy-700 hover:underline">
                          {f.nombre}
                        </Link>
                        {f.suspendido ? (
                          <div className="mt-0.5">
                            <Insignia tono="rosa">Perfil suspendido</Insignia>
                          </div>
                        ) : (
                          f.email && <div className="text-xs leading-snug text-sutil">{f.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{f.disciplina}</td>
                  <td>
                    <Insignia tono={origen.tono}>{origen.etiqueta}</Insignia>
                  </td>
                  <td className="text-apagado">{f.busqueda ?? "—"}</td>
                  <td className="whitespace-nowrap text-apagado">{f.fecha.getTime() > 0 ? fechaCorta(f.fecha) : "—"}</td>
                  <td>
                    <Insignia>{f.estado}</Insignia>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <Link href={perfil} className="text-[13px] leading-none font-medium text-navy-700">
                      Ver perfil →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      )}

      <PaginacionLista pagina={base.pagina} paginas={base.paginas} hrefDe={(n) => href(pestana, n)} />
    </div>
  );
}
