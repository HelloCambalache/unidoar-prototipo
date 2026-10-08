"use client";

import { useState, useTransition } from "react";
import { cambiarAvisosPorCorreo } from "@/app/actions/cuenta";
import { Casilla } from "@/components/ui/campos";
import { Tarjeta } from "@/components/ui/tarjeta";
import { useToast } from "@/components/ui/toast";

const SIEMPRE = {
  docente: "los de tu cuenta (verificación de tu perfil y de tu documentación, seguridad)",
  institucion: "los de tu cuenta (verificación, seguridad) y los de facturación y de tu plan",
} as const;

const OPCIONALES = {
  docente: "invitaciones a postularte, suplencias urgentes que encajan con vos, preselecciones, entrevistas y ofertas",
  institucion: "postulantes nuevos en tus búsquedas",
} as const;

/** Interruptor de los avisos por mail de búsquedas y postulaciones. Guarda al instante. */
export function CuentaAvisos({ rol, inicial }: { rol: "docente" | "institucion"; inicial: boolean }) {
  const toast = useToast();
  const [activos, setActivos] = useState(inicial);
  const [pendiente, empezar] = useTransition();

  const cambiar = (valor: boolean) => {
    setActivos(valor);
    empezar(async () => {
      const r = await cambiarAvisosPorCorreo(valor);
      if (r.ok) {
        toast(valor ? "Vas a recibir los avisos por mail" : "Dejaste de recibir avisos por mail");
      } else {
        setActivos(!valor);
        toast(r.error, "error");
      }
    });
  };

  return (
    <Tarjeta como="section" className="p-[22px]">
      <h2 className="m-0 mb-1.5 text-base leading-none font-semibold">Avisos por mail</h2>
      <p className="m-0 mb-4 text-sm leading-normal text-apagado">
        Te mandamos por mail {OPCIONALES[rol]}. Siempre los ves también en la campanita de UNIDOAR.
      </p>
      <Casilla checked={activos} disabled={pendiente} onChange={(e) => cambiar(e.target.checked)}>
        Quiero recibir estos avisos por mail
      </Casilla>
      <p className="m-0 mt-3 text-[12.5px] leading-normal text-apagado">
        Esto no apaga {SIEMPRE[rol]}: son parte del funcionamiento del servicio.
      </p>
    </Tarjeta>
  );
}
