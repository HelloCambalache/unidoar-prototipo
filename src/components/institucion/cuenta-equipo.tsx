"use client";

import { useState, useTransition } from "react";
import { salirDelEquipo } from "@/app/actions/equipo";
import { Boton } from "@/components/ui/button";
import { DialogoModal } from "@/components/ui/dialogo-modal";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";

/**
 * "Salir del equipo": para quien se sumó al equipo de una institución (no para el dueño). Se borra su lugar en el equipo, no su cuenta de
 * acceso, y después puede crear su propia institución. Pide confirmar.
 */
export function CuentaEquipo({ nombreInstitucion }: { nombreInstitucion: string }) {
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [saliendo, empezar] = useTransition();

  const salir = () =>
    empezar(async () => {
      try {
        const r = await salirDelEquipo();
        // Si sale bien, la acción redirige al paso 2 del alta y no vuelve acá.
        if (r && !r.ok) {
          toast(r.error, "error");
          setAbierto(false);
        }
      } catch {
        toast("No pudimos sacarte del equipo. Probá de nuevo.", "error");
      }
    });

  return (
    <Tarjeta como="section" className="p-[22px]">
      <h2 className="m-0 mb-1.5 text-base leading-none font-semibold">Salir del equipo</h2>
      <p className="m-0 mb-4 text-sm leading-normal text-apagado">
        Formás parte del equipo de <strong className="text-tinta">{nombreInstitucion}</strong>. Si salís, dejás de ver sus búsquedas y postulantes y
        se le avisa al equipo. Tu cuenta no se borra: después podés crear tu propia institución o que te inviten a otra.
      </p>
      <Boton variante="secundario" onClick={() => setAbierto(true)}>
        Salir del equipo
      </Boton>
      <DialogoModal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="¿Querés salir del equipo?" ancho={460}>
        <div className="mt-3">
          <p className="m-0 mb-5 text-sm leading-[1.6] text-apagado">
            Vas a dejar el equipo de <strong className="text-tinta">{nombreInstitucion}</strong> y perder el acceso a sus búsquedas, postulantes y datos.
            Si querés volver, alguien del equipo tiene que invitarte de nuevo.
          </p>
          <div className="flex gap-2 max-[560px]:flex-col">
            <Boton variante="secundario" bloque onClick={() => setAbierto(false)}>
              Mejor no
            </Boton>
            <Boton variante="peligro" bloque onClick={salir} disabled={saliendo} aria-busy={saliendo}>
              {saliendo ? "Saliendo…" : "Salir del equipo"}
            </Boton>
          </div>
        </div>
      </DialogoModal>
    </Tarjeta>
  );
}
