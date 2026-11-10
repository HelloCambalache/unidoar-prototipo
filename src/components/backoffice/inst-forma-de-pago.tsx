"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cambiarPagoManual } from "@/app/actions/backoffice-pago-manual";
import { Boton } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { Insignia } from "@/components/ui/insignia";
import { EtiquetaSeccion, Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";

/**
 * «Forma de pago» de una institución (ficha del equipo): todas pagan con Mercado Pago salvo las que se habilitan acá a pagar por transferencia o
 * efectivo (pedido de Flor, 2026-11-10; reglas en src/lib/pago-manual.ts). Cambia lo que VE la institución en su pantalla de pago; el equipo puede
 * seguir registrándole un pago manual a cualquiera. `resumen` lo arma el servidor: qué significa hoy, según si Mercado Pago está disponible para ella.
 */
export function InstFormaDePago({
  institucionId,
  nombre,
  habilitada,
  resumen,
}: {
  institucionId: string;
  nombre: string;
  habilitada: boolean;
  resumen: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const pedirConfirmacion = useConfirmacion();
  const [pendiente, empezar] = useTransition();

  const cambiar = async () => {
    const habilitar = !habilitada;
    const ok = await pedirConfirmacion(
      habilitar
        ? `¿Habilitar a ${nombre} a pagar por transferencia o efectivo? Va a ver esa opción en su pantalla de pago, además de Mercado Pago.`
        : `¿Dejar de habilitar a ${nombre}? Va a ver solo Mercado Pago en su pantalla de pago (cuando Mercado Pago esté disponible para ella). Podés seguir registrándole un pago manual si hace falta.`,
    );
    if (!ok) return;
    empezar(async () => {
      const r = await cambiarPagoManual(institucionId, habilitar);
      if (!r.ok) {
        toast(r.error, "error");
        return;
      }
      toast(habilitar ? "Habilitada para transferencia o efectivo" : "Vuelve a pagar con Mercado Pago");
      router.refresh();
    });
  };

  return (
    <Tarjeta className="p-[22px]">
      <EtiquetaSeccion className="mb-3">Forma de pago</EtiquetaSeccion>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Insignia tono={habilitada ? "verde" : "azul"} punto>
          {habilitada ? "Habilitada: transferencia o efectivo" : "Paga con Mercado Pago"}
        </Insignia>
      </div>
      <p className="m-0 mb-3.5 text-[13px] leading-[1.5] text-apagado">{resumen}</p>
      <Boton variante="secundario" tamano="sm" onClick={cambiar} disabled={pendiente} aria-busy={pendiente}>
        {pendiente ? "Guardando…" : habilitada ? "Dejar de habilitar" : "Habilitar transferencia o efectivo"}
      </Boton>
    </Tarjeta>
  );
}
