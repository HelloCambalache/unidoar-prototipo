import { Insignia } from "@/components/ui/insignia";
import { ETIQUETA_ESTADO_COBRO, ETIQUETA_ESTADO_FACTURA, type EstadoCobro, type EstadoFactura } from "@/lib/cobros";

/* Insignias de estado de las pantallas de instituciones y cobros del backoffice. */

export function InsigniaCuenta({ suspendida }: { suspendida: boolean }) {
  return suspendida ? (
    <Insignia tono="naranja" punto>
      Suspendida
    </Insignia>
  ) : (
    <Insignia tono="verde" punto>
      Activa
    </Insignia>
  );
}

export function InsigniaVerificada({ verificada }: { verificada: boolean }) {
  return verificada ? <Insignia tono="azul">Verificada</Insignia> : <Insignia tono="neutro">Sin verificar</Insignia>;
}

const TONO_FACTURA = { pagada: "verde", pendiente: "ambar", vencida: "naranja" } as const;

export function InsigniaFactura({ estado }: { estado: EstadoFactura }) {
  return <Insignia tono={TONO_FACTURA[estado]}>{ETIQUETA_ESTADO_FACTURA[estado]}</Insignia>;
}

const TONO_COBRO = { aldia: "verde", pendiente: "ambar", vencida: "naranja" } as const;

export function InsigniaCobro({ estado }: { estado: EstadoCobro }) {
  return (
    <Insignia tono={TONO_COBRO[estado]} punto>
      {ETIQUETA_ESTADO_COBRO[estado]}
    </Insignia>
  );
}
