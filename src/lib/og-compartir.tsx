import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { focoDeFoto } from "@/lib/fotos";
import { IMAGEN_DOCENTES, IMAGEN_GENERAL, IMAGEN_INSTITUCIONES, MEDIDAS_DE_IMAGEN, type CaraDeImagen, type Publico } from "@/lib/seo";

/*
 * La imagen que se ve al compartir un enlace de UNIDOAR (WhatsApp, redes, mail), una por público: la de docentes dice "Para docentes", la de
 * instituciones "Para instituciones" y la general muestra las dos. La sirve `src/app/og/[archivo]/route.tsx` (/og/docentes.png…) y cada
 * página la declara en sus metadatos (`metadatosDePagina`, src/lib/seo.ts). Los textos salen de `src/lib/seo.ts`.
 *
 * PESO: WhatsApp no muestra la imagen de la vista previa si pesa mucho (se cita ~300 KB como límite práctico). Por eso la foto es chica y no
 * hay más de una: la versión anterior (foto grande) pesaba 489 KB. Si se agrega una foto o se agranda, volver a medir el PNG (hay una prueba).
 * Si cambia el dibujo, subir `VERSION_DE_LAS_IMAGENES` en seo.ts: los enlaces ya compartidos recuerdan la imagen por su dirección.
 */

const FONDO = "#040B35";
/** Lo que ocupa la foto: cada píxel suma al peso del PNG (ver arriba). */
const FOTO = { ancho: 220, alto: 390 } as const;
const TEXTO_SUAVE = "#C9CCE0";

/** Una fuente de Google Fonts recortada a las letras de `texto`; null si no se puede bajar (la imagen sale con la letra por defecto). */
async function fuenteDeGoogle(familia: string, peso: number, texto: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${familia}:wght@${peso}&text=${encodeURIComponent(texto)}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function leer(archivo: string) {
  return readFile(join(process.cwd(), "public", "assets", archivo), "base64");
}

function Marca({ logo }: { logo: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/png;base64,${logo}`} width={52} height={55} alt="" />
      <span style={{ fontFamily: "Sora", fontSize: 28, fontWeight: 700, letterSpacing: 4, color: "#FFFFFF" }}>UNIDOAR</span>
    </div>
  );
}

function Pastilla({ cara, tamano = 26 }: { cara: Pick<CaraDeImagen, "pastilla" | "color" | "colorTexto">; tamano?: number }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "10px 24px",
        borderRadius: 999,
        background: cara.color,
        color: cara.colorTexto,
        fontFamily: "Sora",
        fontWeight: 700,
        fontSize: tamano,
        letterSpacing: 2,
      }}
    >
      {cara.pastilla}
    </div>
  );
}

/** Todo el texto que se dibuja con cada letra, para pedirle a Google Fonts solo esas letras. */
function textosDeSora(publico: Publico): string {
  if (publico === "general") {
    return `UNIDOAR${IMAGEN_GENERAL.titulo}${IMAGEN_GENERAL.tarjetas.map((t) => t.pastilla + t.texto).join("")}`;
  }
  const c = publico === "docentes" ? IMAGEN_DOCENTES : IMAGEN_INSTITUCIONES;
  return `UNIDOAR${c.pastilla}${c.titulo}`;
}

function textosDeInter(publico: Publico): string {
  if (publico === "general") return IMAGEN_GENERAL.tarjetas.map((t) => t.detalle).join("");
  const c = publico === "docentes" ? IMAGEN_DOCENTES : IMAGEN_INSTITUCIONES;
  return `${c.detalle}${c.bajada}${c.etiquetas.join("")}`;
}

function ImagenDeUnPublico({ cara, foto, logo }: { cara: CaraDeImagen; foto: string; logo: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: FONDO, padding: 40, gap: 44, fontFamily: "Inter" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px 0 20px 24px" }}>
        <Marca logo={logo} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
            <Pastilla cara={cara} />
            <div style={{ fontSize: 24, color: TEXTO_SUAVE }}>{cara.detalle}</div>
          </div>
          <div style={{ fontFamily: "Sora", fontSize: 58, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, color: "#FFFFFF" }}>
            {cara.titulo}
          </div>
          <div style={{ fontSize: 27, lineHeight: 1.35, color: TEXTO_SUAVE }}>{cara.bajada}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {cara.etiquetas.map((e) => (
            <div
              key={e}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.1)",
                color: "#FFFFFF",
                fontSize: 21,
              }}
            >
              <div style={{ width: 11, height: 11, borderRadius: 999, background: cara.color }} />
              {e}
            </div>
          ))}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/jpeg;base64,${foto}`}
        width={FOTO.ancho}
        height={FOTO.alto}
        alt=""
        style={{ alignSelf: "center", borderRadius: 32, objectFit: "cover", objectPosition: focoDeFoto(`/assets/${cara.foto}`) }}
      />
    </div>
  );
}

function ImagenGeneral({ logo }: { logo: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: FONDO, padding: "52px 64px", fontFamily: "Inter" }}>
      <Marca logo={logo} />
      <div style={{ fontFamily: "Sora", fontSize: 60, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, color: "#FFFFFF", maxWidth: 1072 }}>
        {IMAGEN_GENERAL.titulo}
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {IMAGEN_GENERAL.tarjetas.map((t) => (
          <div
            key={t.pastilla}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, padding: "26px 28px", borderRadius: 28, background: "rgba(255,255,255,0.08)" }}
          >
            <Pastilla cara={t} tamano={24} />
            <div style={{ fontFamily: "Sora", fontSize: 30, fontWeight: 700, lineHeight: 1.2, color: "#FFFFFF" }}>{t.texto}</div>
            <div style={{ fontSize: 22, color: TEXTO_SUAVE }}>{t.detalle}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** La imagen de compartir del público dado. La llama la ruta /og/<público>.png (se genera una vez, en el build). */
export async function imagenDeCompartir(publico: Publico): Promise<ImageResponse> {
  const cara = publico === "docentes" ? IMAGEN_DOCENTES : publico === "instituciones" ? IMAGEN_INSTITUCIONES : null;
  const [logo, foto, sora, inter] = await Promise.all([
    leer("unidoar-logo.png"),
    cara ? leer(cara.foto) : Promise.resolve(""),
    fuenteDeGoogle("Sora", 700, textosDeSora(publico)),
    fuenteDeGoogle("Inter", 500, textosDeInter(publico)),
  ]);
  const fuentes = [
    ...(inter ? [{ name: "Inter", data: inter, weight: 500 as const, style: "normal" as const }] : []),
    ...(sora ? [{ name: "Sora", data: sora, weight: 700 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(cara ? <ImagenDeUnPublico cara={cara} foto={foto} logo={logo} /> : <ImagenGeneral logo={logo} />, {
    ...MEDIDAS_DE_IMAGEN,
    // Sin ninguna fuente bajada hay que NO pasar `fonts`: con una lista vacía ImageResponse no usa la suya por defecto y falla ("No fonts are loaded").
    fonts: fuentes.length > 0 ? fuentes : undefined,
  });
}
