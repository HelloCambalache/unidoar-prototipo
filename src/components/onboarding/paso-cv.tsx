"use client";

import { useActionState, useState } from "react";
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
  const [tieneCv, setTieneCv] = useState(Boolean(cvInicial));

  return (
    <form id={ID_FORMULARIO_ONBOARDING} action={accion}>
      <input type="hidden" name="destino" defaultValue="continuar" />
      <TituloPaso
        grande
        titulo="Tu CV"
        bajada={
          <>
            <strong className="font-semibold text-tinta">Es opcional</strong>: podés seguir sin subirlo y agregarlo cuando quieras desde Mi perfil. Si lo
            subís, lo guardamos de forma privada.
          </>
        }
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
          onCambio={(valor) => setTieneCv(valor !== "")}
        />
      </div>
      <p className="m-0 mb-[22px] rounded-caja bg-[#F0EFEA] px-4 py-3.5 text-[13.5px] leading-normal text-tinta-2">
        Por ahora no leemos el archivo automáticamente: tu experiencia, tu formación y el resumen del perfil los completás vos
        desde <b className="font-semibold text-tinta">Mi perfil</b>.
      </p>
      <AlertaError className="mb-3.5">{estado && !estado.ok ? estado.error : undefined}</AlertaError>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <EnlaceVolver href="/onboarding/docente/3" />
        {/* Antes había un link chico «Lo subo después» al lado de «Volver»: no se veía que se podía seguir sin CV. Un solo botón, que dice lo que hace. */}
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : tieneCv ? "Continuar" : "Continuar sin CV"}
        </Boton>
      </div>
    </form>
  );
}
