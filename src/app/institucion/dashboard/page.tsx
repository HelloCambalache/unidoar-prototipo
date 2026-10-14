import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/app/encabezado-pagina";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { TarjetaMetrica } from "@/components/app/tarjeta-metrica";
import { BannerPasos } from "@/components/institucion/banner-pasos";
import { DashboardPrimeraVez } from "@/components/institucion/dashboard-primera-vez";
import { RecomendadosLateral } from "@/components/institucion/docentes-sugeridos";
import { ResumenDeBusqueda } from "@/components/institucion/insignias-busqueda";
import { BotonLink } from "@/components/ui/button";
import { requerirInstitucion } from "@/lib/auth";
import { avisoDeBusquedasSinPostulaciones, plural } from "@/lib/busquedas";
import { chipEntrevista, rangoDeSemana } from "@/lib/fechas";
import { enumerar, pasosDePerfilInstitucion } from "@/lib/perfil-institucion";
import { estadisticasInstitucion, integrantesDeEquipo, listarBusquedas } from "@/lib/queries/busquedas";
import { docentesRecomendados } from "@/lib/queries/coincidencias";
import { planes } from "@/lib/queries/planes";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardInstitucion() {
  const { institucion } = await requerirInstitucion();
  const nombre = institucion.contactoNombre?.trim().split(/\s+/)[0] || institucion.nombre;
  const est = await estadisticasInstitucion(institucion.id);

  // Sin búsquedas todavía: la variante de "institución recién creada".
  if (est.totalBusquedas === 0) {
    const [equipo, cercanos, P] = await Promise.all([
      integrantesDeEquipo(institucion.id),
      docentesRecomendados(institucion, { limite: 4 }),
      planes(),
    ]);
    return (
      <DashboardPrimeraVez
        institucion={institucion}
        nombre={nombre}
        equipo={equipo}
        cercanos={cercanos}
        planLabel={P.planDe(institucion.plan).label}
      />
    );
  }

  const activas = await listarBusquedas(institucion.id, { pestana: "activas", limite: 5 });
  const recomendados = await docentesRecomendados(institucion, {
    categorias: [...new Set(activas.map((b) => b.categoria))],
    // Con qué se compara a cada candidato: disciplina, nivel y turno de lo que la institución está buscando.
    busquedas: activas.map((b) => ({ id: b.id, categoria: b.categoria, disciplina: b.disciplina, nivel: b.nivel, turno: b.turno })),
    limite: 3,
  });
  const perfil = pasosDePerfilInstitucion(institucion);

  const conMasNuevos = [...activas].sort((a, b) => b.nuevos - a.nuevos)[0];
  const bajada =
    est.nuevos > 0
      ? `Tenés ${plural(est.nuevos, "postulante nuevo", "postulantes nuevos")} para revisar${
          conMasNuevos && activas.length > 1 && conMasNuevos.nuevos < est.nuevos
            ? `, ${conMasNuevos.nuevos} en «${conMasNuevos.puesto}»`
            : ""
        }.`
      : est.vigentes > 0
        ? "No hay postulantes nuevos para revisar. Mirá cómo van tus búsquedas."
        : "No tenés búsquedas abiertas. Publicá una para volver a recibir postulantes.";

  return (
    <>
      <EncabezadoPagina
        titulo={`Buenas, ${nombre}`}
        bajada={bajada}
        acciones={<span className="text-[13px] leading-none whitespace-nowrap text-sutil">Semana del {rangoDeSemana()}</span>}
        className="mb-[22px]"
      />

      <div className="mb-[22px] grid grid-cols-4 gap-3.5 max-[760px]:grid-cols-2 max-[700px]:grid-cols-1">
        <TarjetaMetrica
          etiqueta="Búsquedas activas"
          valor={est.vigentes}
          nota={[
            est.nuevasEstaSemana > 0
              ? `${est.nuevasEstaSemana} se ${est.nuevasEstaSemana === 1 ? "publicó" : "publicaron"} esta semana`
              : "ninguna nueva esta semana",
            // Lo que figura en la lista pero ya no recibe postulaciones (rápidas vencidas sin cerrar, pausadas).
            avisoDeBusquedasSinPostulaciones(est.vencidas, est.pausadas),
          ]
            .filter(Boolean)
            .join(" · ")}
          href="/institucion/busquedas"
        />
        <TarjetaMetrica etiqueta="Postulantes nuevos" valor={est.nuevos} nota="esperando tu revisión" tono="naranja" />
        <TarjetaMetrica
          etiqueta="En entrevista"
          valor={est.entrevistas}
          nota={
            est.entrevistasAgendadas > 0
              ? `${plural(est.entrevistasAgendadas, "agendada", "agendadas")}${
                  est.proximaEntrevista ? ` · la próxima ${chipEntrevista(est.proximaEntrevista)}` : ""
                }`
              : "ninguna con fecha todavía"
          }
        />
        <TarjetaMetrica
          etiqueta="Contratados este año"
          valor={est.contratadosAnio}
          nota={est.contratadosDetalle || "todavía ninguno"}
        />
      </div>

      <div className="mb-5">
        <BannerPasos titulo="Cubrir un cargo en UNIDOAR son tres pasos" conAcciones />
      </div>

      <div className="mb-5 flex flex-wrap items-start gap-5">
        <section aria-label="Búsquedas activas" className="min-w-[340px] flex-1 rounded-ud border border-borde bg-white p-[22px] max-[560px]:min-w-0 max-[560px]:p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 text-[15px] leading-none font-semibold">Búsquedas activas</h2>
            <Link href="/institucion/busquedas" className="text-[13px] leading-none font-medium">
              Ver todas
            </Link>
          </div>
          {activas.length === 0 ? (
            <EstadoVacio
              titulo="No tenés búsquedas abiertas"
              texto="Publicá una búsqueda nueva o reabrí una de las cerradas."
              accion={
                <BotonLink href="/institucion/publicar" variante="cta">
                  Publicar una búsqueda
                </BotonLink>
              }
            />
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {activas.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-borde py-4">
                  <div className="min-w-0">
                    <div className="text-[15px] leading-tight font-semibold">{b.puesto}</div>
                    <div className="mt-[3px] text-[13px] leading-snug text-apagado">
                      {b.meta} · publicada {b.publicada}
                    </div>
                  </div>
                  <div className="flex flex-none flex-wrap items-center gap-2.5">
                    <ResumenDeBusqueda b={b} />
                    <BotonLink href={`/institucion/postulantes?busqueda=${b.id}`} variante="secundario" tamano="sm">
                      Ver publicación
                    </BotonLink>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <RecomendadosLateral docentes={recomendados} />
      </div>

      {perfil.porcentaje < 100 && (
        <section
          aria-label="Perfil de la institución"
          className="flex flex-wrap items-center justify-between gap-5 rounded-ud border border-borde bg-white p-[22px]"
        >
          <div className="min-w-[280px] flex-1 max-[560px]:min-w-0">
            <h2 className="m-0 mb-1.5 text-base leading-snug font-semibold">
              Completá el perfil de tu institución para que los profesionales te encuentren
            </h2>
            <p className="m-0 mb-2.5 text-[13px] leading-normal text-apagado">
              Te falta {enumerar(perfil.faltan)}. Es lo primero que miran los profesionales antes de decidir si se postulan.
            </p>
            <div className="flex items-center gap-2.5">
              <div className="h-2 max-w-[260px] flex-1 overflow-hidden rounded-full bg-[#F0EFEA]" role="presentation">
                <div className="h-full bg-navy-700" style={{ width: `${perfil.porcentaje}%` }} />
              </div>
              <span className="text-[13px] leading-none font-semibold text-apagado">{perfil.porcentaje}%</span>
            </div>
          </div>
          <BotonLink href="/institucion/vitrina" variante="cta" tamano="lg" className="flex-none">
            Completar perfil
          </BotonLink>
        </section>
      )}
    </>
  );
}
