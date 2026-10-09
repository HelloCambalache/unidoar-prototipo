import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TIPOS_INSTITUCION } from "@/lib/catalogo";
import {
  esMultisede,
  packDe,
  PACK_LANZAMIENTO,
  PLANES,
  PLANES_VIGENTES,
  planDe,
  planPorTipo,
  precioMultisede,
  TIPOS_POR_PLAN,
} from "@/lib/planes";

describe("planes vigentes y heredados", () => {
  it("ofrece los tres de hoy y deja afuera los que ya no se venden", () => {
    assert.deepEqual(PLANES_VIGENTES, ["colegio", "deportiva", "multisede"]);
    for (const clave of ["fundador", "estandar", "anual"] as const) {
      assert.equal(PLANES[clave].vigente, false, `${clave} no debería ofrecerse`);
    }
  });

  it("sigue sabiendo el precio de un plan heredado, para las facturas ya emitidas", () => {
    assert.equal(planDe("fundador").precio, 54_000);
    assert.equal(planDe("anual").precio, 720_000);
  });

  it("ante una clave desconocida cae en el plan de colegios", () => {
    assert.equal(planDe("lo-que-sea").label, PLANES.colegio.label);
  });
});

describe("el precio sale del tipo de institución", () => {
  it("cobra el arancel de colegios a los que dictan niveles del sistema educativo", () => {
    assert.equal(planPorTipo("Colegio privado"), "colegio");
    assert.equal(planPorTipo("Colegio público"), "colegio");
    assert.equal(planPorTipo("Jardín de infantes"), "colegio");
    assert.equal(planPorTipo("Instituto terciario"), "colegio");
  });

  it("cobra el arancel deportivo al resto", () => {
    assert.equal(planPorTipo("Club o gimnasio"), "deportiva");
    assert.equal(planPorTipo("Natatorio o colonia"), "deportiva");
    assert.equal(planPorTipo("Instituto de idiomas"), "deportiva");
    assert.equal(planPorTipo("Otro"), "deportiva");
  });

  it("todo tipo del catálogo tiene un plan: ninguno queda sin precio", () => {
    for (const tipo of TIPOS_INSTITUCION) {
      const clave = planPorTipo(tipo);
      assert.ok(PLANES[clave].vigente, `${tipo} quedó en un plan que ya no se vende`);
    }
  });

  it("lista los tipos de cada arancel sin repetirlos ni perder ninguno", () => {
    const listados = [...TIPOS_POR_PLAN.colegio, ...TIPOS_POR_PLAN.deportiva];
    assert.equal(new Set(listados).size, listados.length);
    // "Otro" no se muestra en la página: no le dice nada a quien está decidiendo.
    assert.deepEqual([...listados].sort(), TIPOS_INSTITUCION.filter((t) => t !== "Otro").toSorted());
  });
});

describe("multisede", () => {
  it("empieza en la quinta sede, no en la sexta", () => {
    assert.equal(esMultisede(4), false);
    assert.equal(esMultisede(5), true);
    assert.equal(esMultisede(9), true);
  });

  it("cobra una vez por sede", () => {
    assert.equal(precioMultisede(6), 90_000);
    assert.equal(precioMultisede(12), 180_000);
  });

  it("nunca devuelve cero, aunque le pasen cero sedes", () => {
    assert.equal(precioMultisede(0), PLANES.multisede.precio);
  });
});

describe("pack de lanzamiento", () => {
  it("bonifica un mes pagando los seis por adelantado", () => {
    const colegio = packDe("colegio");
    assert.equal(colegio.lista, 300_000);
    assert.equal(colegio.anticipado, 250_000);
    assert.equal(colegio.lista - colegio.anticipado, PLANES.colegio.precio, "la bonificación es un mes");
  });

  it("bonifica un mes más con un referido que se suma", () => {
    const club = packDe("deportiva");
    assert.equal(club.conReferido, 120_000);
    assert.equal(club.anticipado - club.conReferido, PLANES.deportiva.precio);
  });

  it("los meses bonificados no tocan el precio mensual", () => {
    assert.equal(PACK_LANZAMIENTO.meses - PACK_LANZAMIENTO.mesesQueSePagan, 1);
    assert.equal(PACK_LANZAMIENTO.meses - PACK_LANZAMIENTO.mesesConReferido, 2);
    assert.equal(packDe("colegio").anticipado / PACK_LANZAMIENTO.mesesQueSePagan, PLANES.colegio.precio);
  });
});
