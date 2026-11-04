import Link from "next/link";
import { Icono } from "@/components/icons";
import { Input } from "@/components/ui/campos";

/**
 * La lupa de la cola de verificación: busca por nombre y apellido sin depender del orden de llegada (pedido del cliente, 2026-11-04).
 * Es un formulario común (GET): funciona sin JavaScript, el texto queda en la URL (`?q=`) y la pestaña elegida se conserva.
 */
export function VerifBuscador({ q, estado, hayBusqueda }: { q: string; estado: string; hayBusqueda: boolean }) {
  return (
    <form
      role="search"
      method="get"
      action="/backoffice/verificacion"
      className="mb-4 flex flex-wrap items-center gap-2.5 rounded-tarjeta bg-white p-3 shadow-tarjeta"
    >
      {estado !== "todos" && <input type="hidden" name="estado" value={estado} />}
      <div className="relative min-w-[220px] max-w-[420px] flex-1 max-[640px]:max-w-none">
        <Icono nombre="buscar" tamano={17} trazo={2} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sutil" />
        <Input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={80}
          aria-label="Buscar profesional por nombre y apellido"
          placeholder="Buscar por nombre y apellido"
          className="pl-10"
        />
      </div>
      <button
        type="submit"
        className="inline-flex min-h-[42px] flex-none items-center gap-2 rounded-xl bg-navy-700 px-5 text-[13.5px] leading-none font-semibold text-white transition-colors hover:bg-navy-900 focus-visible:ring-[3px] focus-visible:ring-navy-700/30 focus-visible:outline-none"
      >
        <Icono nombre="buscar" tamano={15} trazo={2.2} />
        Buscar
      </button>
      {hayBusqueda && (
        <Link
          href={estado !== "todos" ? `/backoffice/verificacion?estado=${estado}` : "/backoffice/verificacion"}
          className="text-[13px] leading-none font-medium text-naranja hover:underline"
        >
          Quitar la búsqueda
        </Link>
      )}
    </form>
  );
}
