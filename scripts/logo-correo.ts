/*
 * Genera `public/assets/unidoar-logo-mail.png`: el logo de la web (`LogoMarca`, src/components/ui/logo-marca.tsx: el isotipo con «UNIDOAR» en Sora
 * semibold, en blanco) como una imagen con fondo transparente, para la cabecera azul de los mails. Un mail no puede usar la tipografía de la web, así
 * que el nombre va dibujado dentro de la imagen; se hace a 3x del tamaño en que se muestra (220 px de ancho) para que se vea nítido en pantallas de
 * alta densidad. Se corre solo cuando cambia el logo de la web (la imagen queda guardada en el repo):
 *
 *   pnpm logo:correo
 *
 * Necesita internet: baja Sora de Google Fonts (recortada a las letras de «UNIDOAR»), igual que la imagen de vista previa del sitio (src/app/opengraph-image.tsx).
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement as h } from "react";
import { ImageResponse } from "next/og";

const TEXTO = "UNIDOAR";
// Lo que mide en la web (`md`: isotipo de 40 px, 10 px de separación, 18 px de texto con 0,08 em de espaciado) por la escala de la cabecera del mail
// (1,4) por 3 (nitidez).
const ESCALA = 1.4 * 3;
const ICONO = 40 * ESCALA;
const SEPARACION = 10 * ESCALA;
const LETRA = 18 * ESCALA;
const ESPACIADO = 0.08 * LETRA;
// Proporción del isotipo (public/assets/unidoar-logo.png).
const PROPORCION_ICONO = 443 / 470;

async function sora(peso: number): Promise<ArrayBuffer> {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Sora:wght@${peso}&text=${encodeURIComponent(TEXTO)}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error("Google Fonts no devolvió la tipografía Sora.");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo bajar Sora (${res.status}).`);
  return res.arrayBuffer();
}

async function main() {
  const carpeta = join(process.cwd(), "public", "assets");
  const [isotipo, fuente] = await Promise.all([readFile(join(carpeta, "unidoar-logo.png"), "base64"), sora(600)]);
  const ancho = 660;
  const alto = Math.round(ICONO) + 12;

  const imagen = new ImageResponse(
    h(
      "div",
      { style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" } },
      h("img", { src: `data:image/png;base64,${isotipo}`, width: Math.round(ICONO * PROPORCION_ICONO), height: Math.round(ICONO), alt: "" }),
      h("span", { style: { marginLeft: SEPARACION, fontFamily: "Sora", fontSize: LETRA, fontWeight: 600, letterSpacing: ESPACIADO, color: "#FFFFFF" } }, TEXTO),
    ),
    { width: ancho, height: alto, fonts: [{ name: "Sora", data: fuente, weight: 600, style: "normal" }] },
  );
  const destino = join(carpeta, "unidoar-logo-mail.png");
  await writeFile(destino, Buffer.from(await imagen.arrayBuffer()));
  console.log(`Listo: ${destino} (${ancho}×${alto})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
