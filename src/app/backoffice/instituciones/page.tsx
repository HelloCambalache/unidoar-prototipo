import type { Metadata } from "next";
import { requerirUsuario } from "@/lib/auth";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { InsigniaCuenta, InsigniaVerificada } from "@/components/backoffice/inst-insignias";
import { InstFiltros } from "@/components/backoffice/inst-filtros";
import { FilaClicable } from "@/components/docente/fila-clicable";
import { PaginacionLista } from "@/components/institucion/paginacion-lista";
import { BotonLink } from "@/components/ui/button";
import { Insignia } from "@/components/ui/insignia";
import { Tabla } from "@/components/ui/tabla";
import { hrefInstituciones, leerFiltrosInstituciones } from "@/lib/backoffice-instituciones";
import { plural } from "@/lib/busquedas";
import { nombreDePlan } from "@/lib/cobros";
import { listarInstituciones, totalInstituciones } from "@/lib/queries/backoffice-instituciones";

export const metadata: Metadata = { title: "Instituciones · Backoffice" };
// Datos de contacto y facturación: siempre frescos, nunca cacheados.
export const dynamic = "force-dynamic";

export default async function InstitucionesBackoffice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // El layout ya lo exige, pero acá se leen datos sensibles: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const filtros = leerFiltrosInstituciones(await searchParams);
  const [listado, totalGeneral] = await Promise.all([listarInstituciones(filtros), totalInstituciones()]);
  const { filas, total, pagina, paginas } = listado;
  const filtrado =
    !!(filtros.q || filtros.tipo || filtros.plan || filtros.verificacion || filtros.estado);

  return (
    <>
      <EncabezadoPagina
        titulo="Instituciones"
        bajada={
          filtrado
            ? `${total} de ${totalGeneral} ${totalGeneral === 1 ? "institución" : "instituciones"}`
            : plural(totalGeneral, "institución registrada", "instituciones registradas")
        }
      />
      <InstFiltros valores={filtros} />

      {filas.length === 0 ? (
        <EstadoVacio
          titulo={filtrado ? "Ninguna institución coincide con los filtros" : "Todavía no hay instituciones"}
          texto={
            filtrado
              ? "Probá con otra búsqueda o sacá algún filtro."
              : "Cuando una institución complete su alta, aparece acá."
          }
          accion={
            filtrado ? (
              <BotonLink href="/backoffice/instituciones" variante="secundario">
                Limpiar filtros
              </BotonLink>
            ) : undefined
          }
        />
      ) : (
        <Tabla className="min-w-[860px]">
          <thead>
            <tr>
              <th>Institución</th>
              <th>Plan</th>
              <th>Verificación</th>
              <th>Estado</th>
              <th>Búsquedas activas</th>
              <th>Postulaciones</th>
              <th>Contrataciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((i) => (
              <FilaClicable key={i.id} href={`/backoffice/instituciones/${i.id}`}>
                <td>
                  <Link href={`/backoffice/instituciones/${i.id}`} className="font-semibold text-tinta hover:text-naranja">
                    {i.nombre}
                  </Link>
                  <div className="mt-0.5 text-xs leading-snug text-apagado">
                    {[i.tipo, i.zona, i.sedes > 1 ? `${i.sedes} sedes` : null].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td>{nombreDePlan(i.plan)}</td>
                <td>
                  <InsigniaVerificada verificada={i.verificada} />
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <InsigniaCuenta suspendida={i.suspendida} />
                    {i.pagoVencido && <Insignia tono="ambar">Pago vencido</Insignia>}
                  </div>
                </td>
                <td>
                  {i.busquedasActivas}
                  {i.busquedasTotal > i.busquedasActivas && (
                    <span className="text-xs text-sutil"> de {i.busquedasTotal}</span>
                  )}
                </td>
                <td>{i.postulaciones}</td>
                <td>{i.contrataciones}</td>
              </FilaClicable>
            ))}
          </tbody>
        </Tabla>
      )}

      <PaginacionLista pagina={pagina} paginas={paginas} hrefDe={(p) => hrefInstituciones(filtros, p)} />
    </>
  );
}
