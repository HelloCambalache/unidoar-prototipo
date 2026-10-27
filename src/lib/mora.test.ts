import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cartelDeMora, DIAS_DE_GRACIA, moraDe, motivoDeLimite, planificarAvisosDeMora, SIN_MORA, ultimoDiaDeGracia } from "@/lib/mora";

const HOY = "2026-11-20";
/** Una fecha de cobro con tantos días de atraso a HOY. */
const conAtraso = (dias: number) => new Date(Date.UTC(2026, 10, 20 - dias)).toISOString().slice(0, 10);

describe("mora: el plazo de gracia de 15 días", () => {
  it("la gracia es de 15 días", () => {
    assert.equal(DIAS_DE_GRACIA, 15);
  });

  it("sin facturas impagas, o con las que todavía no vencieron, no hay mora", () => {
    assert.deepEqual(moraDe([], HOY), SIN_MORA);
    assert.deepEqual(moraDe([{ fechaCobro: HOY }], HOY), SIN_MORA, "vence hoy: todavía no está vencida");
    assert.deepEqual(moraDe([{ fechaCobro: conAtraso(-5) }], HOY), SIN_MORA, "vence en 5 días");
  });

  it("vencida pero dentro de la gracia: hay mora y la cuenta NO está limitada", () => {
    for (const dias of [1, 7, 14, 15]) {
      const m = moraDe([{ fechaCobro: conAtraso(dias) }], HOY);
      assert.equal(m.conMora, true, `${dias} días`);
      assert.equal(m.limitada, false, `${dias} días`);
      assert.equal(m.diasDeAtraso, dias);
    }
  });

  it("pasados los 15 días, la cuenta queda limitada (desde el día 16)", () => {
    for (const dias of [16, 20, 45]) {
      const m = moraDe([{ fechaCobro: conAtraso(dias) }], HOY);
      assert.equal(m.limitada, true, `${dias} días`);
    }
  });

  it("manda la factura impaga más vieja, no la última", () => {
    const m = moraDe([{ fechaCobro: conAtraso(3) }, { fechaCobro: conAtraso(40) }, { fechaCobro: conAtraso(-10) }], HOY);
    assert.equal(m.diasDeAtraso, 40);
    assert.equal(m.limitada, true);
  });

  it("el último día de gracia es el vencimiento más 15 días", () => {
    assert.equal(ultimoDiaDeGracia("2026-11-10"), "2026-11-25");
    assert.equal(moraDe([{ fechaCobro: "2026-11-10" }], HOY).ultimoDiaDeGracia, "2026-11-25");
    assert.equal(ultimoDiaDeGracia("2026-12-20"), "2027-01-04", "cruza de año");
  });

  it("al pagar la factura vieja se levanta sola: se calcula con lo que queda impago", () => {
    assert.equal(moraDe([{ fechaCobro: conAtraso(40) }], HOY).limitada, true);
    assert.equal(moraDe([], HOY).limitada, false);
    assert.equal(moraDe([{ fechaCobro: conAtraso(5) }], HOY).limitada, false, "queda otra más nueva y en gracia");
  });
});

describe("mora: lo que se le dice a la institución", () => {
  it("una cuenta limitada recibe el motivo; una en gracia o sin mora, no", () => {
    const limitada = motivoDeLimite(moraDe([{ fechaCobro: conAtraso(20) }], HOY));
    assert.match(limitada ?? "", /más de 15 días/);
    assert.match(limitada ?? "", /no podés publicar búsquedas, invitar a postularse ni publicar cursos/);
    assert.equal(motivoDeLimite(moraDe([{ fechaCobro: conAtraso(5) }], HOY)), null);
    assert.equal(motivoDeLimite(SIN_MORA), null);
  });

  it("el cartel avisa hasta cuándo hay tiempo, y cuando se pasó dice que está limitada", () => {
    assert.equal(cartelDeMora(SIN_MORA), null);
    const enGracia = cartelDeMora(moraDe([{ fechaCobro: conAtraso(5) }], HOY))!;
    assert.equal(enGracia.tono, "gracia");
    assert.match(enGracia.texto, /Tenés hasta el 30 nov 2026 para pagarla/);
    const limitada = cartelDeMora(moraDe([{ fechaCobro: conAtraso(20) }], HOY))!;
    assert.equal(limitada.tono, "limite");
    assert.match(limitada.titulo, /limitada/);
    assert.match(limitada.texto, /se levanta sola/);
  });
});

describe("mora: avisos por mail", () => {
  const f = (id: string, institucionId: string, dias: number, estado = "vencida") => ({ id, institucionId, estado, fechaCobro: conAtraso(dias) });

  it("no hay aviso mientras falta para el final de la gracia, ni para lo que no está vencido ni para lo pagado", () => {
    assert.deepEqual(planificarAvisosDeMora([f("a", "x", 5), f("b", "y", 11), f("c", "z", -2), f("d", "w", 30, "pagada")], HOY), []);
  });

  it("desde 3 días antes de que termine la gracia sale el último aviso (días 12 a 15), una vez por factura", () => {
    for (const dias of [12, 13, 14, 15]) {
      const [aviso, ...resto] = planificarAvisosDeMora([f("a", "x", dias)], HOY);
      assert.equal(aviso!.etapa, "previo", `${dias} días`);
      assert.equal(resto.length, 0);
      assert.equal(aviso!.clave, "M68:a:previo", "la misma clave todos los días: la cola no lo repite");
    }
  });

  it("cuando la gracia termina sale el aviso de que quedó limitada (día 16 en adelante)", () => {
    for (const dias of [16, 22, 30]) {
      const [aviso] = planificarAvisosDeMora([f("a", "x", dias)], HOY);
      assert.equal(aviso!.etapa, "limitada", `${dias} días`);
      assert.equal(aviso!.clave, "M68:a:limitada");
    }
  });

  it("por institución cuenta solo su factura impaga más vieja", () => {
    const avisos = planificarAvisosDeMora([f("nueva", "x", 13), f("vieja", "x", 25), f("otra", "y", 13)], HOY);
    assert.equal(avisos.length, 2);
    const deX = avisos.find((a) => a.institucionId === "x")!;
    assert.deepEqual([deX.facturaId, deX.etapa], ["vieja", "limitada"]);
    assert.equal(avisos.find((a) => a.institucionId === "y")!.etapa, "previo");
  });
});
