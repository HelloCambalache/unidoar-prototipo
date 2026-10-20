import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cabecerasDeCsp, modoDeCsp, nuevoNonce, politicaDeContenido } from "@/lib/csp";

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

});

describe("cabeceras de cada modo", () => {
  const politica = politicaDeContenido("N1", { supabaseUrl: SUPABASE });

  it("solo avisar: la política va solo como \"avisar\", en el pedido y en la respuesta", () => {
    const { delPedido, deLaRespuesta } = cabecerasDeCsp("solo-avisar", politica);
    assert.deepEqual(delPedido, [["content-security-policy-report-only", politica]]);
    assert.deepEqual(deLaRespuesta, [["Content-Security-Policy-Report-Only", politica]]);
  });

  it("solo avisar: ninguna cabecera Content-Security-Policy que bloquee (taparía al nonce: Next la lee primero)", () => {
    const { delPedido, deLaRespuesta } = cabecerasDeCsp("solo-avisar", politica);
    for (const [nombre] of [...delPedido, ...deLaRespuesta]) {
      assert.notEqual(nombre.toLowerCase(), "content-security-policy", nombre);
    }
  });

  it("aplicar: el pedido lleva la política completa y la respuesta una sola, con lo fijo adentro", () => {
    const { delPedido, deLaRespuesta } = cabecerasDeCsp("aplicar", politica);
    assert.deepEqual(delPedido, [["content-security-policy", politica]]);
    assert.equal(deLaRespuesta.length, 1);
    assert.equal(deLaRespuesta[0][0], "Content-Security-Policy");
    assert.ok(deLaRespuesta[0][1].startsWith(politica));
    assert.match(deLaRespuesta[0][1], /frame-ancestors 'none'$/);
  });

  it("al pedido le llega una sola política, la del nonce, en los dos modos", () => {
    for (const modo of ["solo-avisar", "aplicar"] as const) {
      const { delPedido } = cabecerasDeCsp(modo, politica);
      assert.equal(delPedido.length, 1, modo);
      assert.equal(delPedido[0][1], politica, modo);
      assert.match(delPedido[0][1], /script-src [^;]*'nonce-N1'/, modo);
    }
  });

  it("aplicar cubre también marcos, <base> y plugins", () => {
    const [[, valor]] = cabecerasDeCsp("aplicar", politica).deLaRespuesta;
    for (const d of ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'"]) assert.ok(valor.includes(d), d);
  });
});

describe("nonce", () => {
  it("es distinto en cada pedido y es base64", () => {
    const valores = new Set(Array.from({ length: 50 }, () => nuevoNonce()));
    assert.equal(valores.size, 50);
    for (const v of valores) assert.match(v, /^[A-Za-z0-9+/]+=*$/);
  });
});
