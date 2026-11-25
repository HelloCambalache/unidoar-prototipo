import type { Metadata } from "next";
import { SitioCifras } from "@/components/backoffice/sitio-cifras";
import { requerirUsuario } from "@/lib/auth";
import { fechaCorta } from "@/lib/fechas";
import { num } from "@/lib/publico";
import { configuracionDelSitio } from "@/lib/queries/configuracion-sitio";
import { resumenReal } from "@/lib/queries/publico";

export const metadata: Metadata = { title: "Sitio · Backoffice" };
export const dynamic = "force-dynamic";

export default async function SitioBackoffice() {
  // El layout ya lo exige, pero acá se leen y se escriben datos: se vuelve a verificar en cada página.
  await requerirUsuario("admin");
  const [config, real] = await Promise.all([configuracionDelSitio(), resumenReal()]);

  // Los números de verdad de hoy (también ocultos): para que el equipo vea qué se mostraría antes de prender el interruptor.
  const cifras = [
    { valor: num(real.docentesVerificados), etiqueta: real.docentesVerificados === 1 ? "profesional verificado" : "profesionales verificados" },
    { valor: num(real.institucionesVerificadas), etiqueta: real.institucionesVerificadas === 1 ? "institución verificada" : "instituciones verificadas" },
    { valor: num(real.busquedasActivas), etiqueta: real.busquedasActivas === 1 ? "búsqueda activa" : "búsquedas activas" },
    { valor: num(real.disciplinas), etiqueta: real.disciplinas === 1 ? "disciplina" : "disciplinas" },
  ];

  return (
    <>
      <div className="mb-5">
        <h1 className="m-0 mb-1.5 text-[24px] leading-[1.2] font-semibold tracking-[-0.018em] max-[860px]:text-[22px]">Sitio</h1>
        <p className="m-0 max-w-[70ch] text-sm leading-normal text-apagado">
          Lo que se muestra en el sitio público. Mientras la red es chica, podés dejar ocultos los números y volver a mostrarlos cuando quieras: el
          cambio rige en el momento.
        </p>
      </div>
      <div className="max-w-[760px]">
        <SitioCifras
          visibles={config.mostrarCifras}
          cifras={cifras}
          ultimoCambio={config.actualizadoEn ? fechaCorta(config.actualizadoEn) : null}
        />
      </div>
    </>
  );
}
