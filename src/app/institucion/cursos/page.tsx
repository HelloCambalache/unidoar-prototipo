import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { CursoTarjeta } from "@/components/institucion/curso-tarjeta";
import { BotonLink } from "@/components/ui/button";
import { requerirInstitucion } from "@/lib/auth";
import { listarCursosDeInstitucion } from "@/lib/queries/cursos-institucion";

export const metadata: Metadata = { title: "Mis cursos" };

export default async function MisCursos() {
  const { institucion } = await requerirInstitucion();
  const cursos = await listarCursosDeInstitucion(institucion.id);

  return (
    <>
      <EncabezadoPagina
        titulo="Mis cursos"
        bajada="Cursos cortos o certificaciones que ofrecés. Los docentes los ven en su sección de Cursos y se inscriben desde ahí."
        className="mb-5"
        acciones={
          <BotonLink href="/institucion/cursos/nuevo" variante="cta" tamano="lg" className="text-[15px]">
            + Crear curso
          </BotonLink>
        }
      />

      {cursos.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no creaste ningún curso"
          texto="Ofrecé un curso corto o una certificación: los docentes pueden inscribirse y vos llevás el control de quiénes lo terminan y reciben su certificado."
          accion={
            <BotonLink href="/institucion/cursos/nuevo" variante="cta">
              Crear tu primer curso
            </BotonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {cursos.map((c) => (
            <CursoTarjeta key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}
