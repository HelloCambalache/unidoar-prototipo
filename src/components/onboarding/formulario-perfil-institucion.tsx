"use client";

import { useActionState } from "react";
import { actualizarPerfilInstitucion } from "@/app/actions/onboarding";
import { Boton } from "@/components/ui/button";
import { Campo, Textarea } from "@/components/ui/campos";
import { SubirArchivo } from "@/components/ui/subir-archivo";
import { AlertaError, EnlaceVolver, TituloPaso } from "@/components/onboarding/elementos";
import { ID_FORMULARIO_ONBOARDING, valorDe, type DatosForm } from "@/lib/onboarding";

/**
 * Paso 3 de la institución: así la ven los docentes en su perfil. Logo, portada y descripción son
 * opcionales y se pueden cambiar después desde "Mi perfil".
 */
export function FormularioPerfilInstitucion({
  inicial,
  almacenamientoDisponible,
}: {
  inicial: DatosForm;
  almacenamientoDisponible: boolean;
}) {
  const [estado, accion, pendiente] = useActionState(actualizarPerfilInstitucion, null);
  const campos = estado && !estado.ok ? (estado.campos ?? {}) : {};
  const v = (campo: string) => valorDe(estado, inicial, campo);

  return (
    <form id={ID_FORMULARIO_ONBOARDING} action={accion}>
      <input type="hidden" name="destino" defaultValue="continuar" />
      <TituloPaso titulo="Completá tu perfil" bajada="Así te ven los profesionales cuando entran a tu perfil. Podés cambiarlo después." />
      <div className="flex flex-col gap-[22px]">
        <div>
          <SubirArchivo
            bucket="publico"
            carpeta="logos"
            nombre="logoUrl"
            etiqueta="Logo"
            variante="circulo"
            valorInicial={v("logoUrl") || null}
            disponible={almacenamientoDisponible}
          />
          {campos.logoUrl && (
            <p role="alert" className="mt-1 text-xs text-[#b91c1c]">
              {campos.logoUrl}
            </p>
          )}
        </div>
        <div>
          <SubirArchivo
            bucket="publico"
            carpeta="portadas"
            nombre="portadaUrl"
            etiqueta="Foto de portada"
            variante="banner"
            valorInicial={v("portadaUrl") || null}
            disponible={almacenamientoDisponible}
          />
          {campos.portadaUrl && (
            <p role="alert" className="mt-1 text-xs text-[#b91c1c]">
              {campos.portadaUrl}
            </p>
          )}
        </div>
        <Campo etiqueta="Descripción" error={campos.descripcion}>
          <Textarea
            name="descripcion"
            rows={3}
            maxLength={1000}
            placeholder="Contanos brevemente quién es tu institución y qué tipo de profesionales buscás habitualmente."
            defaultValue={v("descripcion")}
            aria-invalid={Boolean(campos.descripcion)}
          />
        </Campo>

        <AlertaError>{estado && !estado.ok && Object.keys(campos).length === 0 ? estado.error : undefined}</AlertaError>
        <Boton type="submit" bloque disabled={pendiente} className="min-h-12 text-base">
          {pendiente ? "Guardando…" : "Terminar y entrar a UNIDOAR"}
        </Boton>
      </div>
      <div className="mt-3.5">
        <EnlaceVolver href="/onboarding/institucion/2" />
      </div>
    </form>
  );
}
