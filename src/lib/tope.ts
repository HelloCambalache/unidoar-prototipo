/**
 * Tope de pedidos por clave en una ventana de tiempo (puro, sin base ni red: se prueba solo).
 *
 * Vive en la memoria de cada instancia del servidor, así que es un freno para el abuso casual (un bucle que sube archivos sin parar),
 * no una garantía exacta: con varias instancias de Vercel el tope real es de hasta N veces el configurado. Para algo que tenga que ser
 * exacto hay que contar en la base.
 */
export function crearTope(max: number, ventanaMs: number, maxClaves = 2000) {
  const pedidos = new Map<string, number[]>();

  /** ¿Deja pasar este pedido? Si pasa, lo anota. */
  return function permitir(clave: string, ahora = Date.now()): boolean {
    const recientes = (pedidos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (recientes.length >= max) {
      pedidos.set(clave, recientes);
      return false;
    }
    recientes.push(ahora);
    pedidos.set(clave, recientes);
    // Para que el mapa no crezca sin fin con claves que ya no piden nada.
    if (pedidos.size > maxClaves) {
      for (const [k, v] of pedidos) if (v.every((t) => ahora - t >= ventanaMs)) pedidos.delete(k);
    }
    return true;
  };
}
