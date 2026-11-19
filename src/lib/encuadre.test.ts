import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FOCO_POR_DEFECTO } from "./fotos";
import {
  ENCUADRE_CENTRADO,
  encuadreInicial,
  encuadreParaGuardar,
  leerEncuadre,
  moverEncuadre,
  posicionDePortada,
  sobranteDeCover,
  textoDeEncuadre,
} from "./encuadre";

describe("leerEncuadre", () => {
  it("lee «x% y%» y tolera espacios de más alrededor", () => {
    assert.deepEqual(leerEncuadre("30% 62%"), { x: 30, y: 62 });
    assert.deepEqual(leerEncuadre("  0% 100% "), { x: 0, y: 100 });
  });

  it("rechaza lo que no tiene esa forma o se pasa de la foto (nunca lanza)", () => {
    for (const malo of ["", "50%", "50 50", "50% 50", "101% 20%", "20% 150%", "-5% 20%", "5.5% 20%", "50%  50%", "50% 50%; color: red", "url(x)", null, undefined, 42, {}]) {
      assert.equal(leerEncuadre(malo), null, `«${String(malo)}» no debería ser un encuadre`);
    }
  });
});

describe("textoDeEncuadre", () => {
  it("redondea a enteros y deja el valor dentro de 0 a 100", () => {
    assert.equal(textoDeEncuadre({ x: 30.4, y: 61.5 }), "30% 62%");
    assert.equal(textoDeEncuadre({ x: -20, y: 140 }), "0% 100%");
    assert.equal(textoDeEncuadre(ENCUADRE_CENTRADO), "50% 50%");
  });

  it("lo que arma se vuelve a leer igual", () => {
    assert.deepEqual(leerEncuadre(textoDeEncuadre({ x: 12.3, y: 88.8 })), { x: 12, y: 89 });
  });
});

describe("encuadreParaGuardar", () => {
  it("sin portada no se guarda nada", () => {
    assert.equal(encuadreParaGuardar("30% 62%", false), null);
  });

  it("con portada guarda el encuadre válido y descarta el resto", () => {
    assert.equal(encuadreParaGuardar("30% 62%", true), "30% 62%");
    assert.equal(encuadreParaGuardar(" 30% 62% ", true), "30% 62%");
    assert.equal(encuadreParaGuardar("", true), null);
    assert.equal(encuadreParaGuardar("cualquier cosa", true), null);
  });
});

describe("posicionDePortada", () => {
  it("usa el encuadre elegido", () => {
    assert.equal(posicionDePortada("https://x.test/portada.jpg", "10% 80%"), "10% 80%");
  });

  it("sin encuadre (o con uno inválido) cae en el punto de siempre de esa foto", () => {
    assert.equal(posicionDePortada("https://x.test/portada.jpg", null), FOCO_POR_DEFECTO);
    assert.equal(posicionDePortada("https://x.test/portada.jpg", "basura"), FOCO_POR_DEFECTO);
    // Una foto del sitio con su propio punto de interés lo conserva.
    assert.equal(posicionDePortada("/assets/sanandres-portada-fixed.jpg", ""), "50% 62%");
  });

  it("el punto de partida de quien arrastra coincide con lo que se ve", () => {
    assert.deepEqual(encuadreInicial("https://x.test/portada.jpg", null), { x: 50, y: 35 });
    assert.deepEqual(encuadreInicial("https://x.test/portada.jpg", "10% 80%"), { x: 10, y: 80 });
  });
});

describe("sobranteDeCover", () => {
  it("una foto más alta que la caja sobra por arriba y abajo, no a los costados", () => {
    // Foto cuadrada de 1000 en una caja de 800 × 350: se escala al ancho (0,8) → 800 × 800, sobran 450 en vertical.
    assert.deepEqual(sobranteDeCover({ ancho: 1000, alto: 1000 }, { ancho: 800, alto: 350 }), { x: 0, y: 450 });
  });

  it("una foto más ancha que la caja sobra por los costados", () => {
    // Panorámica de 3000 × 1000 en 800 × 350: escala 0,35 → 1050 × 350, sobran 250 en horizontal.
    const s = sobranteDeCover({ ancho: 3000, alto: 1000 }, { ancho: 800, alto: 350 });
    assert.ok(Math.abs(s.x - 250) < 1e-9);
    assert.ok(Math.abs(s.y) < 1e-9);
  });

  it("con medidas que todavía no se conocen no sobra nada", () => {
    assert.deepEqual(sobranteDeCover({ ancho: 0, alto: 0 }, { ancho: 800, alto: 350 }), { x: 0, y: 0 });
    assert.deepEqual(sobranteDeCover({ ancho: 1000, alto: 1000 }, { ancho: 0, alto: 0 }), { x: 0, y: 0 });
  });
});

describe("moverEncuadre", () => {
  const sobrante = { x: 200, y: 400 };

  it("arrastrar la foto hacia abajo muestra más de su parte de arriba (baja y)", () => {
    assert.deepEqual(moverEncuadre({ x: 50, y: 50 }, 0, 100, sobrante), { x: 50, y: 25 });
  });

  it("arrastrarla hacia la derecha muestra más de su lado izquierdo (baja x)", () => {
    assert.deepEqual(moverEncuadre({ x: 50, y: 50 }, 50, 0, sobrante), { x: 25, y: 50 });
  });

  it("no se pasa de los bordes de la foto", () => {
    assert.deepEqual(moverEncuadre({ x: 50, y: 50 }, -10_000, 10_000, sobrante), { x: 100, y: 0 });
  });

  it("un eje sin sobrante no se mueve", () => {
    assert.deepEqual(moverEncuadre({ x: 37, y: 50 }, 80, 100, { x: 0, y: 400 }), { x: 37, y: 25 });
  });

  it("al arrastrar lo que corresponde al sobrante entero se recorre toda la foto", () => {
    assert.deepEqual(moverEncuadre({ x: 100, y: 100 }, sobrante.x, sobrante.y, sobrante), { x: 0, y: 0 });
  });
});
