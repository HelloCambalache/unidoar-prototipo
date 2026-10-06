import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { BotonMarcarTodasLeidas, ListaNotificaciones } from "@/components/docente/lista-notificaciones";
import { Pestanas } from "@/components/ui/pestanas";
import { requerirDocente } from "@/lib/auth";
import { notificacionesDe } from "@/lib/queries/notificaciones";

export const metadata: Metadata = { title: "Notificaciones" };

/** Tope de la pantalla completa; la campana del encabezado muestra solo las últimas 20. */
const MAXIMO = 200;

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { usuario } = await requerirDocente();
  const { tab } = await searchParams;
  const soloNoLeidas = tab === "no-leidas";

  const todas = await notificacionesDe(usuario.id, MAXIMO);
  const noLeidas = todas.filter((n) => !n.leida);
  const lista = soloNoLeidas ? noLeidas : todas;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/docente/dashboard" aria-label="Volver al inicio" className="inline-flex text-tinta hover:text-tinta">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <h1 className="m-0 text-2xl leading-[1.25] font-semibold tracking-[-0.018em] max-[860px]:text-[22px]">
            Notificaciones
          </h1>
        </div>
        {noLeidas.length > 0 && <BotonMarcarTodasLeidas />}
      </div>

      <Pestanas
        className="mb-4"
        activa={soloNoLeidas ? "no-leidas" : "todas"}
        items={[
          { clave: "todas", etiqueta: "Todas", href: "/docente/notificaciones" },
          { clave: "no-leidas", etiqueta: "No leídas", cantidad: noLeidas.length, href: "/docente/notificaciones?tab=no-leidas" },
        ]}
      />

      {lista.length === 0 ? (
        <EstadoVacio
          className="max-w-[900px]"
          titulo={soloNoLeidas ? "No te queda ninguna sin leer" : "Todavía no tenés notificaciones"}
          texto={
            soloNoLeidas
              ? undefined
              : "Acá te avisamos cuando una institución avanza con tus postulaciones, te invita a una búsqueda o te escribe."
          }
        />
      ) : (
        <ListaNotificaciones notificaciones={lista} />
      )}
    </>
  );
}
