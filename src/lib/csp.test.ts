import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cabeceraDeCsp, modoDeCsp, nuevoNonce, politicaDeContenido } from "@/lib/csp";

const SUPABASE = "https://abcdefgh.supabase.co";

describe("política de contenido", () => {
  it("los scripts solo corren con el nonce del pedido, sin unsafe-inline", () => {
    const p = politicaDeContenido("NONCE123", { supabaseUrl: SUPABASE });
    assert.match(p, /script-src 'self' 'nonce-NONCE123' 'strict-dynamic'/);
    const scripts = p.split("; ").find((d) => d.startsWith("script-src"))!;
    assert.ok(!scripts.includes("unsafe-inline"));
    assert.ok(!scripts.includes("unsafe-eval"), "en producción no hace falta eval");
  });

  it("en desarrollo suma unsafe-eval (React lo usa para sus errores)", () => {
    const scripts = politicaDeContenido("N", { desarrollo: true }).split("; ").find((d) => d.startsWith("script-src"))!;
    assert.ok(scripts.includes("'unsafe-eval'"));
  });

  it("permite el Storage de Supabase para imágenes y conexiones, y el mapa para imágenes", () => {
    const p = politicaDeContenido("N", { supabaseUrl: `${SUPABASE}/` });
    assert.match(p, new RegExp(`img-src [^;]*${SUPABASE.replaceAll(".", "\\.")}`));
    assert.match(p, new RegExp(`connect-src 'self' ${SUPABASE.replaceAll(".", "\\.")}(;|$)`));
    assert.match(p, /img-src [^;]*https:\/\/tile\.openstreetmap\.org/);
    assert.match(p, /img-src [^;]*data: blob:/);
  });

  it("sin una URL de Supabase válida no deja un 'undefined' ni un 'null' en la política", () => {
    for (const url of [undefined, "", "no es una url"]) {
      const p = politicaDeContenido("N", { supabaseUrl: url });
      assert.ok(!/undefined|null/.test(p), String(url));
      assert.match(p, /connect-src 'self'(;|$)/);
    }
  });

  it("no hay plugins, marcos ni <base> ajeno", () => {
    const p = politicaDeContenido("N");
    for (const d of ["object-src 'none'", "frame-src 'none'", "base-uri 'self'", "default-src 'self'"]) assert.ok(p.includes(d), d);
  });
});

describe("modo de la política", () => {
  it("por defecto solo avisa: no bloquea nada", () => {
    assert.equal(modoDeCsp({}), "solo-avisar");
    assert.equal(modoDeCsp({ CSP_MODO: "" }), "solo-avisar");
    assert.equal(modoDeCsp({ CSP_MODO: "APLICAR" }), "solo-avisar", "tiene que decir exactamente aplicar");
    assert.equal(modoDeCsp({ CSP_MODO: "si" }), "solo-avisar");
  });

  it("solo con CSP_MODO=aplicar bloquea", () => {
    assert.equal(modoDeCsp({ CSP_MODO: "aplicar" }), "aplicar");
  });

  it("la cabecera depende del modo", () => {
    assert.equal(cabeceraDeCsp("solo-avisar"), "Content-Security-Policy-Report-Only");
    assert.equal(cabeceraDeCsp("aplicar"), "Content-Security-Policy");
  });
});

describe("nonce", () => {
  it("es distinto en cada pedido y es base64", () => {
    const valores = new Set(Array.from({ length: 50 }, () => nuevoNonce()));
    assert.equal(valores.size, 50);
    for (const v of valores) assert.match(v, /^[A-Za-z0-9+/]+=*$/);
  });
});
