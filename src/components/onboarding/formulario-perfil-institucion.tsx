"use client";

import { useActionState, useState } from "react";
import { actualizarPerfilInstitucion } from "@/app/actions/onboarding";
import { PortadaConEncuadre } from "@/components/institucion/portada-con-encuadre";
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
  // La portada y su encuadre se eligen en pantalla (arrastrando la foto): van en estado, no en campos que React vacía tras un envío fallido.
  const [portada, setPortada] = useState(() => v("portadaUrl"));
  const [portadaFoco, setPortadaFoco] = useState(() => v("portadaFoco"));
  const [reinicioDePortada, setReinicioDePortada] = useState(0);

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
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-apagado">Foto de portada</span>
          {/* El mismo marco que ven los profesionales: se arrastra la foto para elegir qué parte se muestra. `portadaFoco` viaja en un campo oculto. */}
          <input type="hidden" name="portadaFoco" value={portadaFoco} />
          <div className="overflow-hidden rounded-interno border border-borde">
            <PortadaConEncuadre
              url={portada}
              encuadre={portadaFoco}
              onEncuadre={setPortadaFoco}
              acciones={
                <>
                  {portada && (
                    <Boton
                      tamano="sm"
                      variante="secundario"
                      onClick={() => {
                        setPortada("");
                        setPortadaFoco("");
                        setReinicioDePortada((n) => n + 1);
                      }}
                    >
                      Quitar
                    </Boton>
                  )}
                  <SubirArchivo
                    key={`portada-${reinicioDePortada}`}
                    bucket="publico"
                    carpeta="portadas"
                    nombre="portadaUrl"
                    etiqueta="foto de portada"
                    textoBoton={portada ? "Cambiar portada" : "Subir portada"}
                    variante="boton"
                    valorInicial={reinicioDePortada === 0 ? portada || null : null}
                    disponible={almacenamientoDisponible}
                    onCambio={(valor) => {
                      setPortada(valor);
                      // Una portada nueva arranca con el encuadre de siempre: el de la anterior no le corresponde.
                      setPortadaFoco("");
                    }}
                  />
                </>
              }
            />
          </div>
          <p className="m-0 text-xs leading-normal text-sutil">JPG, PNG o WebP. Después de subirla podés arrastrarla para elegir qué parte se ve.</p>
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
