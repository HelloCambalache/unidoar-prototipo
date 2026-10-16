import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/*
 * Imagen que se ve al compartir un enlace de UNIDOAR (WhatsApp, LinkedIn, X…). La usan todas las páginas que no
 * definen la suya. Se genera una vez en el build con el isotipo y una foto del sitio.
 */

export const alt = "UNIDOAR: docentes, entrenadores y guardavidas verificados";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Sora desde Google Fonts (solo para el nombre y el título). Si no se puede bajar, la imagen sale con la letra por defecto. */
const sora = (texto: string) => fuenteDeGoogle("Sora", 700, texto);

/** Una fuente de Google Fonts recortada a las letras de `texto`; null si no se puede bajar. */
async function fuenteDeGoogle(familia: string, peso: number, texto: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${familia}:wght@${peso}&text=${encodeURIComponent(texto)}`)
    ).text();
    // El subconjunto trae solo estas letras: el resto del texto va en la letra por defecto (ver `fontFamily` abajo).
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

const CATEGORIAS = [
  { texto: "Docentes", color: "#DD553F" },
  { texto: "Entrenadores", color: "#F59332" },
  { texto: "Guardavidas", color: "#82D8E9" },
];

export default async function Image() {
  const publico = join(process.cwd(), "public", "assets");
  const [logo, foto] = await Promise.all([
    readFile(join(publico, "unidoar-logo.png"), "base64"),
    readFile(join(publico, "hero-docente.jpg"), "base64"),
  ]);
  const titulo = "Docentes, entrenadores y guardavidas verificados";
  const bajada = "Colegios, clubes y natatorios cubren cargos y suplencias en días.";
  const [fuente, inter] = await Promise.all([
    sora(`UNIDOAR${titulo}`),
    fuenteDeGoogle("Inter", 500, `${bajada}${CATEGORIAS.map((c) => c.texto).join("")}`),
  ]);
  const fuentes = [
    ...(inter ? [{ name: "Inter", data: inter, weight: 500 as const, style: "normal" as const }] : []),
    ...(fuente ? [{ name: "Sora", data: fuente, weight: 700 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#040B35", padding: 40, gap: 48, fontFamily: "Inter" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "28px 0 28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={`data:image/png;base64,${logo}`} width={64} height={67} alt="" />
            <span style={{ fontFamily: "Sora", fontSize: 32, fontWeight: 700, letterSpacing: 4, color: "#FFFFFF" }}>UNIDOAR</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ fontFamily: "Sora", fontSize: 56, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, color: "#FFFFFF" }}>
              {titulo}
            </div>
            <div style={{ fontSize: 28, lineHeight: 1.35, color: "#C9CCE0" }}>
              {bajada}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {CATEGORIAS.map((c) => (
              <div
                key={c.texto}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                  fontSize: 22,
                }}
              >
                <div style={{ width: 12, height: 12, borderRadius: 999, background: c.color }} />
                {c.texto}
              </div>
            ))}
          </div>
        </div>
        <img
          src={`data:image/jpeg;base64,${foto}`}
          width={400}
          height={550}
          alt=""
          style={{ borderRadius: 36, objectFit: "cover", objectPosition: "48% 22%" }}
        />
      </div>
    ),
    {
      ...size,
      // Sin ninguna fuente bajada hay que NO pasar `fonts`: con una lista vacía ImageResponse no usa la suya por defecto y falla
      // con "No fonts are loaded" (500).
      fonts: fuentes.length > 0 ? fuentes : undefined,
    },
  );
}
