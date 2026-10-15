import { Icono, type IconoClave } from "@/components/icons";

export type Estadistica = {
  valor: string;
  etiqueta: string;
  /** Color de la cifra, de la barrita y del ícono (hex de 6 dígitos). */
  color: string;
  icono: IconoClave;
};

/** Fila de cifras centradas con ícono, barrita y descripción (se apila por debajo de 640px). */
export function FilaEstadisticas({ items }: { items: Estadistica[] }) {
  return (
    <section aria-label="Cifras de UNIDOAR" className="bg-lienzo px-12 pb-4 max-[900px]:px-6 max-[480px]:px-4">
      <ul className="m-0 mx-auto grid max-w-[1200px] list-none grid-cols-4 gap-4 p-0 max-[900px]:grid-cols-2 max-[480px]:gap-2.5">
        {items.map((i) => (
          <li
            key={i.etiqueta}
            className="flex items-center gap-4 rounded-tarjeta bg-white px-5 py-5 shadow-tarjeta max-[480px]:gap-3 max-[480px]:rounded-[20px] max-[480px]:px-3.5 max-[480px]:py-3.5"
          >
            <div
              style={{ background: `${i.color}1a`, color: i.color }}
              className="flex size-12 flex-none items-center justify-center rounded-[14px] max-[480px]:size-9 max-[480px]:rounded-[11px]"
            >
              <Icono nombre={i.icono} tamano={20} trazo={2} className="max-[480px]:size-4" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[32px] leading-none font-semibold tracking-[-0.03em] text-navy-900 max-[480px]:text-[22px]">
                {i.valor}
              </div>
              <p className="m-0 mt-1 text-[13.5px] leading-snug text-apagado max-[480px]:text-[12px]">{i.etiqueta}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
