/**
 * Imagen con URL dinámica (logos, portadas y fotos subidas a Storage): no se conocen las
 * dimensiones ni el dominio de antemano, así que va como <img> común.
 */
export function Imagen({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- origen dinámico, sin dimensiones conocidas
  return <img alt={alt} loading="lazy" decoding="async" {...props} />;
}
