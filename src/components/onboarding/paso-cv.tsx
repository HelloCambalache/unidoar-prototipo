"use client";

import Link from "next/link";
import { useActionState } from "react";
import { guardarCvDocente } from "@/app/actions/onboarding";
import { Boton } from "@/components/ui/button";
import { SubirArchivo } from "@/components/ui/subir-archivo";
import { AlertaError, EnlaceVolver, TituloPaso } from "@/components/onboarding/elementos";
import { ID_FORMULARIO_ONBOARDING } from "@/lib/onboarding";

/**
 * "Tu CV": subida opcional de un PDF al bucket privado. No se lee el archivo: no hay extracción
 * automática, y el texto lo dice. Los datos del perfil (experiencia, formación, resumen) los completa la persona.
 */
export function PasoCv({
  cvInicial,
  almacenamientoDisponible,
}: {
  cvInicial: string | null;
  almacenamientoDisponible: boolean;
}) {
  const [estado, accion, pendiente] = useActionState(guardarCvDocente, null);

  return (
    <form id={ID_FORMULARIO_ONBOARDING} action={accion}>
      <input type="hidden" name="destino" defaultValue="continuar" />
      <TituloPaso
        grande
        titulo="Subí tu CV"
        bajada="Lo guardamos de forma privada en tu perfil. Es opcional: podés subirlo ahora o más adelante."
      />
      <div className="mb-[22px]">
        <SubirArchivo
          bucket="privado"
          carpeta="cv"
          nombre="cv"
          variante="zona"
          titulo="Arrastrá tu CV aquí o hacé clic para subirlo"
          valorInicial={cvInicial}
          disponible={almacenamientoDisponible}
        />
      </div>
      <p className="m-0 mb-[22px] rounded-caja bg-[#F0EFEA] px-4 py-3.5 text-[13.5px] leading-normal text-tinta-2">
        Por ahora no leemos el archivo automáticamente: tu experiencia, tu formación y el resumen del perfil los completás vos
        desde <b className="font-semibold text-tinta">Mi perfil</b>.
      </p>
      <AlertaError className="mb-3.5">{estado && !estado.ok ? estado.error : undefined}</AlertaError>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <EnlaceVolver href="/onboarding/docente/3" />
          <Link href="/onboarding/docente/asignaturas" className="text-[13px] leading-none font-medium whitespace-nowrap text-navy-700">
            Lo subo después
          </Link>
        </div>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Continuar"}
        </Boton>
      </div>
    </form>
  );
}
