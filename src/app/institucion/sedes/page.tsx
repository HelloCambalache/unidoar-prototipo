import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { SedesFormulario } from "@/components/institucion/sedes-formulario";
import { ListaDeSedes } from "@/components/instituciones/lista-de-sedes";
import { requerirInstitucion } from "@/lib/auth";
import { esRolGestor } from "@/lib/equipo";
import { rolEnInstitucion } from "@/lib/queries/equipo";
import { sedesParaEditar } from "@/lib/queries/sedes";
import { aSedePublica, huellaDeSedes } from "@/lib/sedes";

export const metadata: Metadata = { title: "Sedes" };

/**
 * Sedes de la institución, en su propia pantalla del menú (antes estaban al pie de "Mi perfil"). Quien administra la cuenta las edita;
 * el resto del equipo las ve numeradas, como las ven los profesionales.
 */
export default async function SedesPage() {
  const { usuario, institucion: i } = await requerirInstitucion();
  const sedes = await sedesParaEditar(i);
  const gestor = esRolGestor(await rolEnInstitucion(i, usuario.id));

  return (
    <>
      <EncabezadoPagina
        titulo="Sedes"
        bajada="Los lugares donde trabaja tu institución. Se numeran solas (la principal es la 1) y los profesionales las ven en tu perfil. Al publicar una búsqueda elegís en qué sedes es."
      />
      {gestor ? (
        <SedesFormulario sedes={sedes} huella={huellaDeSedes(sedes, { conCue: false })} />
      ) : sedes.length > 0 ? (
        <section className="rounded-tarjeta border border-linea bg-white p-6">
          <p className="m-0 mb-4 text-[13.5px] text-apagado">Solo el dueño y los administradores editan las sedes.</p>
          <ListaDeSedes sedes={sedes.map(aSedePublica)} />
        </section>
      ) : (
        <EstadoVacio titulo="Todavía no hay sedes cargadas" texto="Pedile a alguien que administre la cuenta que las cargue." />
      )}
    </>
  );
}
