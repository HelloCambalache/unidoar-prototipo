import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { salir } from "@/app/actions/auth";
import { MarcoAcceso } from "@/components/onboarding/marco-acceso";
import { sesionPublica } from "@/components/publico/sesion";
import { Boton, BotonLink } from "@/components/ui/button";
import { RUTA_INICIO } from "@/lib/catalogo";
import { RUTA_REGISTRO_INSTITUCION } from "@/lib/publico";
import { destinoDePublicar, esPedidoUrgente, queHacerAlPublicar } from "@/lib/publicar-busqueda";

export const metadata: Metadata = { title: "Publicá tu búsqueda" };

/**
 * A donde llevan los botones para instituciones de la parte pública ("Soy institución · Busco profesionales", "Publicar una
 * suplencia"): según quién esté ingresado, directo a publicar, a elegir entre ingresar o crear la cuenta de institución, o a
 * avisarle a un profesional que hace falta una cuenta de institución.
 */
export default async function PublicarBusquedaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { urgente: pedido } = await searchParams;
  const urgente = esPedidoUrgente(pedido);
  const destino = destinoDePublicar(urgente);
  const sesion = await sesionPublica();
  const accion = queHacerAlPublicar(sesion.rol);

  if (accion === "publicar") redirect(destino);
  if (accion === "admin") redirect(RUTA_INICIO.admin);

  if (accion === "otra-cuenta") {
    return (
      <MarcoAcceso>
        <h1 className="m-0 mb-1.5 text-[28px] leading-tight font-semibold tracking-[-0.018em]">Esta cuenta es de profesional</h1>
        <p className="m-0 mb-[26px] text-sm leading-[1.6] text-apagado">
          Para publicar una búsqueda necesitás una cuenta de institución. Una misma cuenta no puede ser las dos cosas: cerrá sesión
          e ingresá con la de tu institución, o creá una con otro email.
        </p>
        <div className="flex flex-col gap-3">
          <form action={salir}>
            <Boton type="submit" variante="cta" tamano="lg" bloque>
              Cerrar sesión
            </Boton>
          </form>
          <BotonLink href={RUTA_INICIO.docente} variante="secundario" tamano="lg" bloque>
            Volver a mi panel
          </BotonLink>
        </div>
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso>
      <h1 className="m-0 mb-1.5 text-[28px] leading-tight font-semibold tracking-[-0.018em]">
        {urgente ? "Publicá una suplencia" : "Publicá tu búsqueda"}
      </h1>
      <p className="m-0 mb-[30px] text-sm leading-normal text-apagado">
        Para publicar necesitás la cuenta de tu institución. ¿Ya tenés una?
      </p>
      <div className="flex flex-col gap-3">
        <BotonLink href={`/ingresar?next=${encodeURIComponent(destino)}`} variante="cta" tamano="lg" bloque>
          Ya tengo cuenta de institución
        </BotonLink>
        <BotonLink href={RUTA_REGISTRO_INSTITUCION} variante="primario" tamano="lg" bloque>
          Crear cuenta de institución
        </BotonLink>
      </div>
    </MarcoAcceso>
  );
}
