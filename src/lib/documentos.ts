/**
 * Reglas de los números de identificación argentinos (puro, sin base ni red: se prueba solo).
 * DNI: 7 u 8 números. CUIT y CUIL: 11 números cuyo último es un dígito verificador (módulo 11).
 */

/** Saca los separadores que la gente escribe ("20-12345678-6", "12.345.678"); lo que no sea número queda y lo rechaza la regla. */
export const soloDigitos = (v: string) => v.replace(/[\s.\-]/g, "");

export const esDniValido = (v: string) => /^\d{7,8}$/.test(soloDigitos(v));

/**
 * Lo que se le dice al profesional sobre las fotos de su DNI (alta, Mi perfil y mail de verificado). Es lo que hace
 * `aplicarVerificacion`: al verificar se borran las fotos y queda solo el número. Si esa regla cambia, cambiar esto y `/privacidad`.
 */
export const FOTOS_DNI_SE_ELIMINAN =
  "Las fotos de tu DNI se eliminan apenas validamos tu identidad: solo conservamos el número, como constancia de lo que verificamos.";

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/** ¿Son 11 números con el dígito verificador correcto? Sirve igual para un CUIT que para un CUIL. */
export function esCuitValido(v: string): boolean {
  const d = soloDigitos(v);
  if (!/^\d{11}$/.test(d)) return false;
  const suma = PESOS.reduce((total, peso, i) => total + peso * Number(d[i]), 0);
  const resto = suma % 11;
  // Resto 1 daría 10, que no existe como dígito: ese número no puede ser un CUIT.
  const digito = resto === 0 ? 0 : 11 - resto;
  return digito !== 10 && digito === Number(d[10]);
}

/** "30712345671" → "30-71234567-1" (sin validar: usar después de `esCuitValido`). */
export function formatearCuit(v: string): string {
  const d = soloDigitos(v);
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}
