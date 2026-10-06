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
    <section aria-label="Cifras de UNIDOAR" className="border-y border-borde bg-superficie">
      <ul className="m-0 mx-auto flex max-w-[1200px] list-none p-0 max-[640px]:flex-col">
        {items.map((i) => (
          <li
            key={i.etiqueta}
            className="flex-1 border-r border-borde px-8 py-9 text-center last:border-r-0 max-[640px]:border-r-0 max-[640px]:border-b max-[640px]:last:border-b-0"
          >
            <div
              style={{ background: `${i.color}1a`, color: i.color }}
              className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded-full"
            >
              <Icono nombre={i.icono} tamano={20} trazo={2} />
            </div>
            <div style={{ color: i.color }} className="font-display text-[34px] leading-none font-bold tracking-[-0.02em]">
              {i.valor}
            </div>
            <div style={{ background: i.color }} className="mx-auto mt-2.5 mb-3 h-[3px] w-7 rounded-sm" />
            <p className="m-0 text-sm leading-normal text-apagado">{i.etiqueta}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
