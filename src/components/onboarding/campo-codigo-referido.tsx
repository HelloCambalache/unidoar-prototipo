import { Campo, Input } from "@/components/ui/campos";

/**
 * El campo «Código de referido (opcional)» del alta de institución: lo que recibió de otra institución que la recomendó. Vale lo mismo que
 * entrar con su enlace (`/referido/<código>`), así que también acepta el enlace pegado. Está en el paso 1 (registro) y, si ya hay un código
 * anotado por un enlace, vuelve en el paso 2 para cambiarlo (reglas en src/lib/referidos.ts). **Siempre arranca vacío** (2026-10-28): la persona
 * lo escribe; un código que dejó un enlace se avisa en la ayuda del campo y vale aunque el campo quede vacío.
 */
export function CampoCodigoDeReferido({ defaultValue, error, ayuda }: { defaultValue: string; error?: string; ayuda: string }) {
  return (
    <Campo etiqueta="Código de referido (opcional)" error={error} ayuda={ayuda}>
      <Input
        name="codigoReferido"
        placeholder="Ej. K7M2XQ9D"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={120}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        className="uppercase placeholder:normal-case"
      />
    </Campo>
  );
}

/** La ayuda del campo en el paso 1: distinta si la persona ya llegó con el enlace de otra institución (el código ya quedó anotado, el campo sigue vacío). */
export const AYUDA_DEL_CODIGO_AL_REGISTRARSE = {
  conEnlace: "Llegaste con el enlace de otra institución: ya quedó anotado, no hace falta que escribas nada. Si tenés otro código, escribilo acá.",
  sinEnlace: "Si otra institución te recomendó UNIDOAR, escribí su código (8 letras y números) o pegá su enlace. Es lo mismo que entrar con su enlace.",
} as const;
