import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planesPorDefecto as P } from "@/lib/planes";
import { resumenDeSemestre } from "@/lib/forma-de-pago";
import { MENSAJE_DE_MORA, QUE_SE_LIMITA, SIN_MORA, moraDe } from "@/lib/mora";
import {
  CODIGO_PLAN_INACTIVO,
  cartelDePlanSinPago,
  contenidoDelPopup,
  errorDePlanInactivo,
  motivoDePlanInactivo,
  type EntradaDePlan,
} from "@/lib/plan-activo";

const base: EntradaDePlan = { esDemo: false, esPuntual: false, precioDefinido: true, facturasPagas: 0, mora: SIN_MORA };
const limitada = moraDe([{ fechaCobro: "2026-10-01" }], "2026-11-20");
const enGracia = moraDe([{ fechaCobro: "2026-11-10" }], "2026-11-20");

describe("plan activo: cuándo se frena una cuenta", () => {
  it("una cuenta nueva con abono que todavía no pagó queda frenada («sin pago»)", () => {
    assert.equal(motivoDePlanInactivo(base), "sin-pago");
  });

  it("con una factura paga (cobro automático, efectivo o semestre al contado) el plan está activo", () => {
    assert.equal(motivoDePlanInactivo({ ...base, facturasPagas: 1 }), null);
    assert.equal(motivoDePlanInactivo({ ...base, facturasPagas: 7 }), null);
  });

  it("con la factura vencida pasada la gracia, la mora manda sobre «sin pago»", () => {
    assert.equal(motivoDePlanInactivo({ ...base, facturasPagas: 3, mora: limitada }), "mora");
    assert.equal(motivoDePlanInactivo({ ...base, facturasPagas: 0, mora: limitada }), "mora");
  });

  it("dentro de los 15 días de gracia todavía no se frena", () => {
    assert.equal(motivoDePlanInactivo({ ...base, facturasPagas: 2, mora: enGracia }), null);
  });

  it("las cuentas de ejemplo nunca se frenan", () => {
    assert.equal(motivoDePlanInactivo({ ...base, esDemo: true }), null);
    assert.equal(motivoDePlanInactivo({ ...base, esDemo: true, mora: limitada }), null);
  });

  it("la búsqueda puntual no se frena por falta de pago: publicar depende de su saldo", () => {
    assert.equal(motivoDePlanInactivo({ ...base, esPuntual: true }), null);
  });

  it("un plan sin precio con el que facturar (Multisede sin convenio) no se frena: el equipo lo acuerda a mano", () => {
    assert.equal(motivoDePlanInactivo({ ...base, precioDefinido: false }), null);
  });

  it("con las reglas reales: Colegios sin pago se frena; Multisede sin convenio y la búsqueda puntual, no", () => {
    const de = (plan: string): EntradaDePlan => ({ ...base, esPuntual: P.esPuntual(plan), precioDefinido: P.precioDefinido(plan, null) });
    assert.equal(motivoDePlanInactivo(de("colegio")), "sin-pago");
    assert.equal(motivoDePlanInactivo(de("deportiva")), "sin-pago");
    assert.equal(motivoDePlanInactivo(de("fundador")), "sin-pago");
    assert.equal(motivoDePlanInactivo(de("multisede")), null);
    assert.equal(motivoDePlanInactivo(de("puntual")), null);
  });
});

describe("plan activo: lo que se le dice a la persona", () => {
  it("el código que avisa a la pantalla es fijo", () => {
    assert.equal(CODIGO_PLAN_INACTIVO, "plan-inactivo");
  });

  it("el error de la acción dice qué se frena y cómo seguir", () => {
    assert.equal(errorDePlanInactivo("mora"), MENSAJE_DE_MORA);
    const sinPago = errorDePlanInactivo("sin-pago");
    assert.ok(sinPago.includes(QUE_SE_LIMITA));
    assert.ok(sinPago.includes("primer pago"));
    assert.ok(sinPago.includes("Plan y facturación"));
  });

  it("el popup de una cuenta sin pago muestra el plan, lo que cuesta, el semestre y cómo pagar", () => {
    const semestre = resumenDeSemestre(P, "colegio", 1);
    const c = contenidoDelPopup("sin-pago", { planNombre: P.planDe("colegio").label, mensual: semestre.mensual, semestre });
    assert.equal(c.titulo, "Activá tu plan para publicar");
    assert.ok(c.bajada.includes(QUE_SE_LIMITA));
    assert.equal(c.plan?.nombre, P.planDe("colegio").label);
    assert.ok(c.plan?.precio?.includes("por mes"));
    assert.ok(c.plan?.semestre?.includes("Pagás"));
    assert.equal(c.pasos.length, 2);
    assert.ok(c.pasos[0]!.includes("transferencia"));
  });

  it("el popup de una cuenta limitada por mora habla de la factura vencida y de que se levanta sola", () => {
    const c = contenidoDelPopup("mora", { planNombre: "Plan Colegios", mensual: 50000, semestre: null });
    assert.ok(c.titulo.includes("factura vencida"));
    assert.equal(c.plan?.semestre, null, "sin semestre no se ofrece");
    assert.ok(c.pasos.some((p) => p.includes("se levanta sola")));
  });

  it("sin datos del plan no se inventan precios", () => {
    const c = contenidoDelPopup("sin-pago", null);
    assert.equal(c.plan, null);
    assert.ok(c.pasos.length > 0);
  });

  it("sin motivo (el servidor frenó algo que la pantalla creía permitido) queda un popup genérico con lo que respondió el servidor", () => {
    const c = contenidoDelPopup(null, null, "Tu plan todavía no está activo: hasta que registremos tu primer pago…");
    assert.equal(c.titulo, "Tu plan no está activo");
    assert.ok(c.bajada.startsWith("Tu plan todavía no está activo"));
    assert.equal(c.plan, null);
    assert.equal(contenidoDelPopup(null, null).bajada.includes(QUE_SE_LIMITA), true, "sin mensaje, dice qué se frena");
  });

  it("el cartel de «sin pago» dice qué se frena", () => {
    const c = cartelDePlanSinPago();
    assert.ok(c.texto.includes(QUE_SE_LIMITA));
  });
});
