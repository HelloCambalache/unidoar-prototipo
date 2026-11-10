import Link from "next/link";
import { Icono } from "@/components/icons";
import { Casilla, Input, Select } from "@/components/ui/campos";
import { atajosDeFechas, mismoRango, MEDIOS_DEL_REPORTE, type FiltrosDePagos } from "@/lib/pagos-reporte";
import { cn } from "@/lib/utils";

const RUTA = "/backoffice/cobros/pagos";

/** La dirección de la pantalla con unos filtros (solo lo que se aparta de lo de siempre). */
export function hrefDePagos(f: FiltrosDePagos, cambios: Partial<FiltrosDePagos> = {}, ruta = RUTA): string {
  const x = { ...f, ...cambios };
  const p = new URLSearchParams({ desde: x.desde, hasta: x.hasta });
  if (x.medio) p.set("medio", x.medio);
  if (x.q) p.set("q", x.q);
  if (x.adjunto) p.set("adjunto", x.adjunto);
  if (x.conEjemplo) p.set("ejemplo", "1");
  return `${ruta}?${p.toString()}`;
}

/**
 * Los filtros del reporte de pagos: un formulario común (GET), así que funciona sin JavaScript y todo queda en la dirección (se puede compartir o
 * guardar). Arriba, los rangos de un toque.
 */
export function PagosFiltros({ filtros, hoy }: { filtros: FiltrosDePagos; hoy: string }) {
  const atajos = atajosDeFechas(hoy);
  return (
    <form role="search" method="get" action={RUTA} className="mb-5 rounded-tarjeta bg-white p-4 shadow-tarjeta">
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[12.5px] font-semibold text-apagado">Rango:</span>
        {atajos.map((a) => {
          const activo = mismoRango(a, filtros);
          return (
            <Link
              key={a.clave}
              href={hrefDePagos(filtros, { desde: a.desde, hasta: a.hasta })}
              aria-current={activo ? "true" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12.5px] leading-none font-semibold whitespace-nowrap transition-colors",
                activo ? "bg-navy-50 text-navy-700" : "text-apagado hover:bg-black/5 hover:text-tinta",
              )}
            >
              {a.etiqueta}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] items-end gap-3">
        <label className="block text-[12.5px] font-semibold text-apagado">
          Desde
          <Input type="date" name="desde" defaultValue={filtros.desde} required className="mt-1" />
        </label>
        <label className="block text-[12.5px] font-semibold text-apagado">
          Hasta
          <Input type="date" name="hasta" defaultValue={filtros.hasta} required className="mt-1" />
        </label>
        <label className="block text-[12.5px] font-semibold text-apagado">
          Método de pago
          <Select name="medio" defaultValue={filtros.medio} className="mt-1">
            <option value="">Todos</option>
            {MEDIOS_DEL_REPORTE.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-[12.5px] font-semibold text-apagado">
          Comprobante de pago
          <Select name="adjunto" defaultValue={filtros.adjunto} className="mt-1">
            <option value="">Todos</option>
            <option value="con">Con comprobante adjunto</option>
            <option value="sin">Sin comprobante adjunto</option>
          </Select>
        </label>
        <label className="block text-[12.5px] font-semibold text-apagado">
          Institución
          <div className="relative mt-1">
            <Icono nombre="buscar" tamano={16} trazo={2} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sutil" />
            <Input type="search" name="q" defaultValue={filtros.q} maxLength={80} placeholder="Nombre" className="pl-10" />
          </div>
        </label>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
        <Casilla name="ejemplo" value="1" defaultChecked={filtros.conEjemplo}>
          Incluir los pagos de instituciones de ejemplo (son pruebas)
        </Casilla>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={RUTA} className="text-[13px] leading-none font-medium text-naranja hover:underline">
            Volver al mes en curso
          </Link>
          <button
            type="submit"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-navy-700 px-5 text-[13.5px] leading-none font-semibold text-white transition-colors hover:bg-navy-900 focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
          >
            <Icono nombre="buscar" tamano={15} trazo={2.2} />
            Ver pagos
          </button>
        </div>
      </div>
    </form>
  );
}
