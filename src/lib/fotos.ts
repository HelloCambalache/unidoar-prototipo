/*
 * Encuadre de las fotos del sitio. Una foto se muestra en cajas de formas muy distintas (un panel alto, una banda ancha, un círculo
 * de 42 px) con `object-fit: cover` o `background-size: cover`, y el recorte al centro suele dejar afuera la cara. Acá cada foto
 * tiene su PUNTO DE INTERÉS (dónde está la cara de la persona, en % del ancho y del alto) y se lo pasa como `object-position` /
 * `background-position`: alinear ese punto con el mismo punto de la caja asegura que quede SIEMPRE a la vista, sea cual sea el
 * recorte. Sin código de por medio y sin importar la caja: una foto nueva solo necesita su fila acá.
 * Código puro (sin base ni Next) para poder probarlo.
 */

/** Para las fotos que no están en la lista (las que suben las personas: portadas, fotos de perfil, galerías): un poco más arriba del centro, donde suele estar la cara. */
export const FOCO_POR_DEFECTO = "50% 35%";

/** Punto de interés de cada foto de `public/assets` ("x% y%"). */
export const FOCOS: Record<string, string> = {
  // Alta (paneles altos en escritorio, banda baja en el celular)
  "/assets/onboarding-bg-1.jpg": "29% 24%",
  "/assets/onboarding-bg-2.jpg": "31% 18%",
  "/assets/onboarding-bg-3.jpg": "26% 34%",
  "/assets/onboarding-bg.jpg": "40% 22%",
  "/assets/entrenador-chicos.jpg": "54% 28%",
  "/assets/gimnasio-entrenamiento.jpg": "36% 20%",
  "/assets/aula-secundaria.jpg": "46% 24%",
  // Educadores
  "/assets/cat-profesores.jpg": "28% 16%",
  "/assets/hero-profesor.jpg": "28% 16%",
  "/assets/bgProfesores.png": "28% 16%",
  "/assets/cat-docentes.jpg": "48% 22%",
  "/assets/hero-docente.jpg": "48% 22%",
  "/assets/bgDocentes-fixed.jpg": "48% 22%",
  "/assets/profe-ciencias.jpg": "80% 20%",
  "/assets/maestra-inicial.jpg": "50% 25%",
  "/assets/hero-aula.jpg": "66% 22%",
  "/assets/hero-universidad.png": "55% 30%",
  "/assets/urgente-docentes.jpg": "50% 30%",
  "/assets/urgente-pizarron.jpg": "50% 25%",
  // Entrenadores
  "/assets/cat-entrenadores.jpg": "53% 26%",
  "/assets/hero-entrenador.jpg": "53% 26%",
  "/assets/bgEntrenadores-fixed.jpg": "53% 26%",
  "/assets/tile-entrenadores.jpg": "55% 36%",
  "/assets/cat-entrenadores-gym.jpg": "76% 30%",
  // Guardavidas
  "/assets/cat-guardavidas.jpg": "50% 40%",
  "/assets/cat-guardavidas-pileta.jpg": "63% 25%",
  "/assets/hero-guardavidas.jpg": "45% 30%",
  "/assets/bgGuardavidas-fixed.jpg": "45% 30%",
  // Quiénes somos: el equipo frente al logo (las caras están en el tercio de arriba, el grupo centrado)
  "/assets/quienes-somos-equipo.webp": "50% 32%",
  // Fundadores (se muestran en un círculo: la cara tiene que quedar al centro)
  "/assets/fundador-ricardo.webp": "46% 30%",
  // Retrato alto: en un círculo se ve una franja cuadrada, así que el punto va arriba para que entre la cabeza completa
  "/assets/fundador-esteban.webp": "52% 8%",
  "/assets/fundador-ariel.webp": "46% 6%",
  // Instituciones de ejemplo
  "/assets/sanandres-portada-fixed.jpg": "50% 62%",
};

/**
 * El encuadre de una foto para `object-position` / `background-position`. Acepta la ruta tal cual, con `?query` o con el
 * origen delante; si no la conoce (una foto subida por una persona), usa el punto por defecto.
 */
export function focoDeFoto(src?: string | null): string {
  if (!src) return FOCO_POR_DEFECTO;
  const ruta = src.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0] ?? "";
  return FOCOS[ruta] ?? FOCO_POR_DEFECTO;
}
