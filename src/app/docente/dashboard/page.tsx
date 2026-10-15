import type { Metadata } from "next";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { BotonLink } from "@/components/ui/button";
import { AvisoVerificacion } from "@/components/docente/aviso-verificacion";
import { BannerBienvenida } from "@/components/docente/banner-bienvenida";
import { DashboardMetrica } from "@/components/docente/dashboard-metrica";
import { DashboardPrimeraVez } from "@/components/docente/dashboard-primera-vez";
import { PublicidadLateral, PublicidadesPareja } from "@/components/docente/dashboard-publicidad";
import {
  CuadriculaTarjetas,
  ResumenPostulaciones,
  SeccionTablero,
  TarjetaCompletaPerfil,
  TarjetaCursoDestacado,
  TarjetaInstitucionDestacada,
  TarjetaOfertaRecomendada,
} from "@/components/docente/dashboard-secciones";
import { requerirDocente } from "@/lib/auth";
import { pendientesDePerfil } from "@/lib/perfil";
import { tableroDocente } from "@/lib/queries/docente";

export const metadata: Metadata = { title: "Dashboard" };

function plural(n: number, uno: string, varios: string) {
  return n === 1 ? uno : varios;
}

export default async function DashboardDocentePage() {
  const { usuario, docente } = await requerirDocente();
  const tablero = await tableroDocente(docente, usuario.id);

  // Mientras no tenga ninguna postulación se muestra la variante "recién registrado".
  if (tablero.primeraVez) {
    return (
      <>
        <AvisoVerificacion verificacion={docente.verificacion} nota={docente.verificacionNota} enlacePerfil />
        <DashboardPrimeraVez docente={docente} tablero={tablero} />
      </>
    );
  }

  const { metricas } = tablero;
  const perfil = pendientesDePerfil(docente);

  const partes: string[] = [];
  if (metricas.nuevas > 0) {
    partes.push(
      `Hay ${metricas.nuevas} ${plural(metricas.nuevas, "búsqueda nueva", "búsquedas nuevas")} en tus zonas`,
    );
  }
  if (metricas.vistasPerfil > 0) {
    partes.push(
      `${metricas.vistasPerfil} ${plural(metricas.vistasPerfil, "institución vio", "instituciones vieron")} tu perfil en los últimos 30 días`,
    );
  }
  const bajada =
    partes.length > 0
      ? `${partes.join(" y ")}.`
      : "Todavía no hay búsquedas nuevas en tus zonas. Apenas aparezca una, la vas a ver acá.";

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-5">
        <BannerBienvenida
          titulo={`Buenas, ${docente.nombre}`}
          bajada={bajada}
          mostrarPerfil={perfil.pendientes.length > 0}
          className="flex-[3_1_520px]"
        />
        <PublicidadLateral className="flex-[2_1_320px]" />
      </div>

      <AvisoVerificacion
        verificacion={docente.verificacion}
        nota={docente.verificacionNota}
        enlacePerfil
        className="mb-6"
      />

      <div className="mb-8 grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1">
        <DashboardMetrica
          tono="azul"
          etiqueta="Búsquedas nuevas"
          valor={metricas.nuevas}
          nota={metricas.nuevasDonde ? `en ${metricas.nuevasDonde}` : "en las últimas dos semanas"}
        />
        <DashboardMetrica
          tono="rosa"
          etiqueta="Postulaciones activas"
          valor={metricas.postulacionesActivas}
          nota={
            metricas.conEntrevista === 0
              ? "ninguna con entrevista todavía"
              : `${metricas.conEntrevista} con entrevista agendada`
          }
        />
        <DashboardMetrica
          tono="azul"
          etiqueta="Vieron tu perfil"
          valor={metricas.vistasPerfil}
          nota="instituciones, últimos 30 días"
        />
        <DashboardMetrica
          tono="naranja"
          etiqueta="Suplencias abiertas"
          valor={metricas.suplencias}
          nota={metricas.suplenciaVence ?? "se cubren el mismo día"}
        />
      </div>

      <SeccionTablero
        titulo="Recomendadas para vos"
        bajada="Ordenadas por cuánto coinciden con tus asignaturas, tus zonas y tu disponibilidad."
        enlace={{ href: "/docente/oportunidades", texto: "Ver todas" }}
      >
        {tablero.recomendadas.length > 0 ? (
          <CuadriculaTarjetas>
            {tablero.recomendadas.map((o) => (
              <TarjetaOfertaRecomendada key={o.id} o={o} />
            ))}
          </CuadriculaTarjetas>
        ) : (
          <EstadoVacio
            titulo="No hay búsquedas para recomendarte por ahora"
            texto="Ya te postulaste a las que estaban abiertas. Cuando una institución publique una nueva, la vas a ver acá."
            accion={<BotonLink href="/docente/oportunidades">Ver todas las búsquedas</BotonLink>}
          />
        )}
      </SeccionTablero>

      <TarjetaCompletaPerfil perfil={perfil} />

      <SeccionTablero
        titulo="Instituciones destacadas"
        bajada="Las que más están buscando en tus zonas."
        enlace={{ href: "/docente/instituciones", texto: "Ver todas" }}
      >
        {tablero.instituciones.length > 0 ? (
          <CuadriculaTarjetas>
            {tablero.instituciones.map((i) => (
              <TarjetaInstitucionDestacada key={i.id} i={i} />
            ))}
          </CuadriculaTarjetas>
        ) : (
          <EstadoVacio
            titulo="Todavía no hay instituciones verificadas buscando"
            texto="Mirá el catálogo completo: podés guardar las que te interesan y enterarte cuando publiquen."
            accion={<BotonLink href="/docente/instituciones">Ver instituciones</BotonLink>}
          />
        )}
      </SeccionTablero>

      <SeccionTablero
        titulo="Cursos destacados"
        bajada="Suman en tu perfil y las instituciones los ven."
        enlace={{ href: "/docente/cursos", texto: "Ver todos" }}
        className="mb-0"
      >
        {tablero.cursos.length > 0 ? (
          <CuadriculaTarjetas>
            {tablero.cursos.map((c) => (
              <TarjetaCursoDestacado key={c.id} c={c} />
            ))}
          </CuadriculaTarjetas>
        ) : (
          <EstadoVacio
            titulo="No hay cursos nuevos para sumarte"
            texto="Cuando una institución abra un curso, lo vas a poder ver e inscribirte desde acá."
            accion={<BotonLink href="/docente/cursos">Ver cursos</BotonLink>}
          />
        )}
      </SeccionTablero>

      <PublicidadesPareja className="mt-[26px]" />

      <ResumenPostulaciones filas={tablero.postulaciones} />
    </>
  );
}
