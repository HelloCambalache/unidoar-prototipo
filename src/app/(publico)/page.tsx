import { BandaFundador } from "@/components/publico/banda-fundador";
import { CarruselTestimonios } from "@/components/publico/carrusel-testimonios";
import { ComoFunciona } from "@/components/publico/como-funciona";
import { FilaEstadisticas } from "@/components/publico/fila-estadisticas";
import { HeroHome } from "@/components/publico/hero-home";
import { sesionPublica } from "@/components/publico/sesion";
import { TarjetasCategoria } from "@/components/publico/tarjetas-categoria";
import { TiposInstitucion } from "@/components/publico/tipos-institucion";
import { TiraLogos } from "@/components/publico/tira-logos";
import { UrgentesHome } from "@/components/publico/urgentes-home";
import { num } from "@/lib/publico";
import {
  busquedasUrgentes,
  cuposFundadorRestantes,
  logosInstituciones,
  resumenPublico,
  testimoniosDe,
} from "@/lib/queries/publico";

// Consulta la base en cada request: no se prerenderiza (en el build puede no haber DATABASE_URL).
export const dynamic = "force-dynamic";

export default async function Landing() {
  const [resumen, logos, testimonios, urgentes, cupos, sesion] = await Promise.all([
    resumenPublico(),
    logosInstituciones(),
    testimoniosDe("home"),
    busquedasUrgentes({ limite: 3 }),
    cuposFundadorRestantes(),
    sesionPublica(),
  ]);

  return (
    <>
      <HeroHome conteos={resumen.categorias} />

      <FilaEstadisticas
        items={[
          {
            valor: num(resumen.docentesVerificados),
            etiqueta: resumen.docentesVerificados === 1 ? "profesional verificado" : "profesionales verificados",
            color: "#16214F",
            icono: "equipo",
          },
          {
            valor: num(resumen.institucionesVerificadas),
            etiqueta: resumen.institucionesVerificadas === 1 ? "institución verificada" : "instituciones verificadas",
            color: "#DD553F",
            icono: "instituciones",
          },
          {
            valor: num(resumen.busquedasActivas),
            etiqueta: resumen.busquedasActivas === 1 ? "búsqueda activa ahora" : "búsquedas activas ahora",
            color: "#1B4B52",
            icono: "reloj",
          },
          {
            valor: num(resumen.disciplinas),
            etiqueta: `${resumen.disciplinas === 1 ? "disciplina" : "disciplinas"}, de matemática a guardavidas`,
            color: "#8A4B07",
            icono: "cursos",
          },
        ]}
      />

      <section className="border-b border-borde bg-superficie px-12 py-14 max-[900px]:px-6">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-3 flex items-center gap-[9px]">
            <span aria-hidden className="size-2 rounded-full bg-naranja" />
            <span className="text-xs leading-none font-semibold tracking-[.09em] text-naranja-ink uppercase">
              Para profesionales
            </span>
          </div>
          <h2 className="mb-2 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-tinta">Buscás empleo</h2>
          <p className="mb-7 max-w-[72ch] text-[15px] leading-normal text-apagado">
            Elegí la categoría que buscás, completá tu perfil 100% gratis para acceder a búsquedas calificadas.
          </p>
          <TarjetasCategoria conteos={resumen.categorias} />
        </div>
      </section>

      <TiposInstitucion tiposEnUso={resumen.tiposInstitucion} />
      <TiraLogos logos={logos} />
      <ComoFunciona />
      <UrgentesHome urgentes={urgentes} cantidadUrgentes={resumen.urgentes} sesion={sesion} />

      <CarruselTestimonios
        testimonios={testimonios}
        colorAcento="#DD553F"
        colorSobreAcento="#FFFFFF"
        colorNombre="#8A2F1A"
      />

      <BandaFundador cupos={cupos} />
    </>
  );
}
