/** Distancia en km entre dos puntos (fórmula de haversine). */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Redondea para mostrar "a 4 km"; por debajo de 1 km muestra "a menos de 1 km". */
export function kmLegible(km: number | null | undefined) {
  if (km == null || Number.isNaN(km)) return null;
  if (km < 1) return "a menos de 1 km";
  return `a ${Math.round(km)} km`;
}
