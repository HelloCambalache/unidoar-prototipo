import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TIPOS_INSTITUCION } from "@/lib/catalogo";
import {
  cambiosDeAuditoria,
  camposDeErrorDePlanes,
  cambiosDePlanes,
  catalogoDesdeLaBase,
  CATALOGO_POR_DEFECTO,
  CLAVES_PLAN,
  crearPlanes,
  describirCambioDePlanes,
  edicionDePlanesSchema,
  edicionDesdeCatalogo,
  huellaDePlanes,
  planesPorDefecto as P,
  type EdicionDePlanes,
  type FilaDeCondiciones,
  type FilaDePlan,
} from "@/lib/planes";

/** Una edición válida (la de los valores de lanzamiento) para modificar en cada prueba. */
const edicion = (): EdicionDePlanes => structuredClone(edicionDesdeCatalogo(CATALOGO_POR_DEFECTO));

const filasDeLanzamiento = (): FilaDePlan[] =>
  CLAVES_PLAN.map((clave) => {
    const p = CATALOGO_POR_DEFECTO.planes[clave];
    return { clave, etiqueta: p.label, precio: p.precio, resumen: p.resumen, detalle: p.detalle, vigente: p.vigente };
  });

const condicionesDeLanzamiento = (): FilaDeCondiciones => {
  const c = CATALOGO_POR_DEFECTO.condiciones;
  return { sedesMultisede: c.sedesMultisede, descuentoSedeExtra: c.descuentoSedeExtra, packMeses: c.pack.meses, packMesesPagos: c.pack.mesesQueSePagan, packMesesReferido: c.pack.mesesConReferido, tiposColegio: c.tiposColegio };
};

describe("planes vigentes y heredados", () => {
  it("ofrece los tres de hoy y deja afuera los que ya no se venden", () => {
    assert.deepEqual(P.vigentes, ["colegio", "deportiva", "multisede"]);
    for (const clave of ["fundador", "estandar", "anual"] as const) {
      assert.equal(P.planes[clave].vigente, false, `${clave} no debería ofrecerse`);
    }
  });

  it("sigue sabiendo el precio de un plan heredado, para las facturas ya emitidas", () => {
    assert.equal(P.planDe("fundador").precio, 54_000);
    assert.equal(P.planDe("anual").precio, 720_000);
  });

  it("ante una clave desconocida cae en el plan de colegios", () => {
    assert.equal(P.planDe("lo-que-sea").label, P.planes.colegio.label);
  });

  it("un selector ofrece los vigentes y, si la institución está en uno heredado, también el suyo", () => {
    assert.deepEqual(P.clavesParaElegir("colegio"), ["colegio", "deportiva", "multisede"]);
    assert.deepEqual(P.clavesParaElegir("fundador"), ["colegio", "deportiva", "multisede", "fundador"]);
    assert.ok(!P.clavesParaElegir("colegio").includes("fundador"));
    assert.deepEqual(P.clavesParaElegir(undefined), ["colegio", "deportiva", "multisede"]);
    assert.deepEqual(P.clavesParaElegir("lo-que-sea"), ["colegio", "deportiva", "multisede"]);
  });

  it("el anual aporta un doceavo al MRR y el resto su precio mensual", () => {
    assert.equal(P.equivalenteMensual("anual"), 60_000);
    assert.equal(P.equivalenteMensual("fundador"), 54_000);
  });

  it("escribe el precio y el nombre corto como se ven en las pantallas", () => {
    assert.equal(P.precioDePlan("deportiva"), "$ 30.000/mes");
    assert.equal(P.precioDePlan("multisede"), "$ 15.000/mes por sede");
    assert.equal(P.precioDePlan("anual"), "$ 720.000/año");
    assert.equal(P.nombreDePlan("fundador"), "Fundador");
    assert.equal(P.montoDePlan("multisede"), 15_000);
  });

  it("un plan por sede se factura por la cantidad de sedes", () => {
    assert.equal(P.montoDePlan("multisede", 6), 90_000);
    assert.equal(P.montoDePlan("multisede", 0), 15_000, "nunca menos de una sede");
    assert.equal(P.equivalenteMensual("multisede", 4), 60_000);
  });

  it("en los demás, la primera sede paga el abono y cada adicional la mitad", () => {
    assert.equal(P.montoDePlan("colegio", 1), 50_000);
    assert.equal(P.montoDePlan("colegio", 2), 75_000);
    assert.equal(P.montoDePlan("colegio", 4), 125_000);
    assert.equal(P.montoDePlan("deportiva", 3), 60_000);
    assert.equal(P.equivalenteMensual("colegio", 3), 100_000);
    assert.equal(P.equivalenteMensual("anual", 2), 90_000, "el anual suma la mitad del año por sede, y vale un doceavo por mes");
  });

  it("una cantidad rara de sedes no rompe la cuenta", () => {
    assert.equal(P.montoDePlan("colegio", 0), 50_000);
    assert.equal(P.montoDePlan("colegio", -3), 50_000);
    assert.equal(P.montoDePlan("colegio", 2.9), 75_000, "las sedes se cuentan enteras");
  });
});

describe("sedes adicionales", () => {
  const con = (descuento: number) => {
    const catalogo = structuredClone(CATALOGO_POR_DEFECTO);
    catalogo.condiciones.descuentoSedeExtra = descuento;
    return crearPlanes(catalogo);
  };

  it("el descuento lo decide el catálogo", () => {
    assert.equal(con(0).montoDePlan("colegio", 3), 150_000, "sin descuento paga todo");
    assert.equal(con(25).montoDePlan("colegio", 3), 50_000 + 2 * 37_500);
    assert.equal(con(100).montoDePlan("colegio", 9), 50_000, "con descuento total se cobra como una sola");
  });

  it("redondea al peso", () => {
    const catalogo = structuredClone(CATALOGO_POR_DEFECTO);
    catalogo.planes.colegio.precio = 48_001;
    const otros = crearPlanes(catalogo);
    assert.equal(otros.precioDeSedeExtra("colegio"), 24_001);
    assert.equal(otros.montoDePlan("colegio", 2), 48_001 + 24_001);
  });

  it("un plan por sede no recibe el descuento: cobra cada sede entera", () => {
    assert.equal(P.precioDeSedeExtra("multisede"), 15_000);
    assert.equal(P.desgloseDeMonto("multisede", 6).adicionales, 0);
  });

  it("explica el monto: la primera sede, las adicionales y el total", () => {
    assert.deepEqual(P.desgloseDeMonto("colegio", 3), { sedes: 3, base: 50_000, adicionales: 2, precioAdicional: 25_000, total: 100_000 });
    assert.deepEqual(P.desgloseDeMonto("deportiva", 1), { sedes: 1, base: 30_000, adicionales: 0, precioAdicional: 15_000, total: 30_000 });
    for (const sedes of [1, 2, 4, 7]) {
      const d = P.desgloseDeMonto("colegio", sedes);
      assert.equal(d.total, d.base + d.adicionales * d.precioAdicional, "el desglose siempre suma el total");
    }
  });

  it("la edición acepta de 0 a 100 y rechaza el resto", () => {
    for (const bien of [0, 50, 100]) {
      const e = structuredClone(edicionDesdeCatalogo(CATALOGO_POR_DEFECTO));
      e.condiciones.descuentoSedeExtra = bien;
      assert.equal(edicionDePlanesSchema.safeParse(e).success, true, `${bien} % debería pasar`);
    }
    for (const mal of [-1, 101, 12.5]) {
      const e = structuredClone(edicionDesdeCatalogo(CATALOGO_POR_DEFECTO));
      e.condiciones.descuentoSedeExtra = mal;
      assert.equal(edicionDePlanesSchema.safeParse(e).success, false, `${mal} % no debería pasar`);
    }
  });

  it("si la base todavía no tiene la columna (o trae algo roto), vale el de lanzamiento", () => {
    const sinColumna: FilaDeCondiciones = { ...condicionesDeLanzamiento(), descuentoSedeExtra: undefined };
    assert.equal(catalogoDesdeLaBase(filasDeLanzamiento(), sinColumna).condiciones.descuentoSedeExtra, 50);
    assert.equal(catalogoDesdeLaBase(filasDeLanzamiento(), { ...condicionesDeLanzamiento(), descuentoSedeExtra: 150 }).condiciones.descuentoSedeExtra, 50);
    assert.equal(catalogoDesdeLaBase(filasDeLanzamiento(), { ...condicionesDeLanzamiento(), descuentoSedeExtra: 30 }).condiciones.descuentoSedeExtra, 30);
  });
});

describe("el precio sale del tipo de institución", () => {
  it("cobra el arancel de colegios a los que dictan niveles del sistema educativo", () => {
    assert.equal(P.planPorTipo("Colegio privado"), "colegio");
    assert.equal(P.planPorTipo("Colegio público"), "colegio");
    assert.equal(P.planPorTipo("Jardín de infantes"), "colegio");
    assert.equal(P.planPorTipo("Instituto terciario"), "colegio");
    assert.equal(P.planPorTipo("Universidad"), "colegio");
  });

  it("cobra el arancel deportivo al resto", () => {
    assert.equal(P.planPorTipo("Club o gimnasio"), "deportiva");
    assert.equal(P.planPorTipo("Natatorio o colonia"), "deportiva");
    assert.equal(P.planPorTipo("Instituto de idiomas"), "deportiva");
    assert.equal(P.planPorTipo("Otro"), "deportiva");
  });

  it("todo tipo del catálogo tiene un plan: ninguno queda sin precio", () => {
    for (const tipo of TIPOS_INSTITUCION) {
      const clave = P.planPorTipo(tipo);
      assert.ok(P.planes[clave].vigente, `${tipo} quedó en un plan que ya no se vende`);
    }
  });

  it("lista los tipos de cada arancel sin repetirlos ni perder ninguno", () => {
    const listados = [...P.tiposPorPlan.colegio, ...P.tiposPorPlan.deportiva];
    assert.equal(new Set(listados).size, listados.length);
    // "Otro" no se muestra en la página: no le dice nada a quien está decidiendo.
    assert.deepEqual([...listados].sort(), TIPOS_INSTITUCION.filter((t) => t !== "Otro").toSorted());
  });

  it("si el equipo cambia qué tipos pagan el arancel de colegios, el plan por tipo lo sigue", () => {
    const catalogo = structuredClone(CATALOGO_POR_DEFECTO);
    catalogo.condiciones.tiposColegio = ["Colegio privado"];
    const otros = crearPlanes(catalogo);
    assert.equal(otros.planPorTipo("Colegio privado"), "colegio");
    assert.equal(otros.planPorTipo("Colegio público"), "deportiva");
    assert.deepEqual(otros.tiposPorPlan.colegio, ["Colegio privado"]);
  });
});

describe("multisede", () => {
  it("empieza en la quinta sede, no en la sexta", () => {
    assert.equal(P.esMultisede(4), false);
    assert.equal(P.esMultisede(5), true);
    assert.equal(P.esMultisede(9), true);
  });

  it("cobra una vez por sede", () => {
    assert.equal(P.precioMultisede(6), 90_000);
    assert.equal(P.precioMultisede(12), 180_000);
  });

  it("nunca devuelve cero, aunque le pasen cero sedes", () => {
    assert.equal(P.precioMultisede(0), P.planes.multisede.precio);
  });

  it("desde cuántas sedes corresponde lo decide el catálogo", () => {
    const catalogo = structuredClone(CATALOGO_POR_DEFECTO);
    catalogo.condiciones.sedesMultisede = 3;
    const otros = crearPlanes(catalogo);
    assert.equal(otros.esMultisede(2), false);
    assert.equal(otros.esMultisede(3), true);
  });
});

describe("pack de lanzamiento", () => {
  const pack = P.condiciones.pack;

  it("bonifica un mes pagando los seis por adelantado", () => {
    const colegio = P.packDe("colegio");
    assert.equal(colegio.lista, 300_000);
    assert.equal(colegio.anticipado, 250_000);
    assert.equal(colegio.lista - colegio.anticipado, P.planes.colegio.precio, "la bonificación es un mes");
  });

  it("bonifica un mes más con un referido que se suma", () => {
    const club = P.packDe("deportiva");
    assert.equal(club.conReferido, 120_000);
    assert.equal(club.anticipado - club.conReferido, P.planes.deportiva.precio);
  });

  it("con más de una sede, el semestre es el monto mensual (con sus sedes adicionales) por los meses que se pagan", () => {
    const dos = P.packDe("colegio", 2);
    assert.equal(dos.lista, 450_000, "6 meses de $ 75.000");
    assert.equal(dos.anticipado, 375_000, "se pagan 5");
    assert.equal(dos.conReferido, 300_000, "con referido, 4");
    assert.deepEqual(P.packDe("colegio", 1), P.packDe("colegio"), "sin sedes, como siempre");
    assert.equal(P.packDe("multisede", 6).anticipado, 90_000 * 5, "un plan por sede cobra cada sede entera");
  });

  it("los meses bonificados no tocan el precio mensual", () => {
    assert.equal(pack.meses - pack.mesesQueSePagan, 1);
    assert.equal(pack.meses - pack.mesesConReferido, 2);
    assert.equal(P.packDe("colegio").anticipado / pack.mesesQueSePagan, P.planes.colegio.precio);
  });

  it("sigue el precio que edite el equipo", () => {
    const catalogo = structuredClone(CATALOGO_POR_DEFECTO);
    catalogo.planes.colegio.precio = 60_000;
    const otros = crearPlanes(catalogo);
    assert.equal(otros.packDe("colegio").lista, 360_000);
    assert.equal(otros.packDe("colegio").anticipado, 300_000);
    assert.equal(otros.montoDePlan("colegio"), 60_000);
  });
});

describe("del dato guardado al catálogo", () => {
  it("con todo en la base, arma el mismo catálogo que los valores de lanzamiento", () => {
    assert.deepEqual(catalogoDesdeLaBase(filasDeLanzamiento(), condicionesDeLanzamiento()), CATALOGO_POR_DEFECTO);
  });

  it("toma el precio y el nombre que editó el equipo", () => {
    const filas = filasDeLanzamiento().map((f) => (f.clave === "colegio" ? { ...f, precio: 65_000, etiqueta: "  Plan Instituciones educativas " } : f));
    const c = catalogoDesdeLaBase(filas, condicionesDeLanzamiento());
    assert.equal(c.planes.colegio.precio, 65_000);
    assert.equal(c.planes.colegio.label, "Plan Instituciones educativas");
    assert.equal(c.planes.deportiva.precio, 30_000, "los demás no se tocan");
  });

  it("si la base no devuelve nada, usa los valores de lanzamiento", () => {
    assert.deepEqual(catalogoDesdeLaBase([], null), CATALOGO_POR_DEFECTO);
  });

  it("un plan que falta o una fila rota se reemplaza campo por campo, sin dejar la app sin precios", () => {
    const filas = filasDeLanzamiento()
      .filter((f) => f.clave !== "anual")
      .map((f) => (f.clave === "colegio" ? { ...f, precio: 0, etiqueta: "   " } : f));
    const c = catalogoDesdeLaBase(filas, condicionesDeLanzamiento());
    assert.equal(c.planes.anual.precio, 720_000);
    assert.equal(c.planes.colegio.precio, 50_000);
    assert.equal(c.planes.colegio.label, "Plan Colegios");
  });

  it("un pack que no bonifica ningún mes se descarta entero", () => {
    const c = catalogoDesdeLaBase(filasDeLanzamiento(), { ...condicionesDeLanzamiento(), packMeses: 6, packMesesPagos: 6 });
    assert.deepEqual(c.condiciones.pack, CATALOGO_POR_DEFECTO.condiciones.pack);
  });

  it("una lista de tipos vacía vuelve a la de lanzamiento", () => {
    const c = catalogoDesdeLaBase(filasDeLanzamiento(), { ...condicionesDeLanzamiento(), tiposColegio: [] });
    assert.deepEqual(c.condiciones.tiposColegio, CATALOGO_POR_DEFECTO.condiciones.tiposColegio);
  });
});

describe("la edición del backoffice", () => {
  const validar = (e: unknown) => edicionDePlanesSchema.safeParse(e);

  it("acepta los valores de lanzamiento tal cual", () => {
    assert.equal(validar(edicion()).success, true);
  });

  it("acepta un precio nuevo", () => {
    const e = edicion();
    e.planes.colegio.precio = 62_500;
    assert.equal(validar(e).success, true);
  });

  it("rechaza un precio en cero, negativo, con centavos o disparatado", () => {
    for (const precio of [0, -1, 1000.5, 99_000_000]) {
      const e = edicion();
      e.planes.colegio.precio = precio;
      const r = validar(e);
      assert.equal(r.success, false, `el precio ${precio} no debería pasar`);
      if (!r.success) assert.ok(camposDeErrorDePlanes(r.error)["planes.colegio.precio"]);
    }
  });

  it("no deja apagar Colegios ni Clubes: reciben a las instituciones nuevas", () => {
    for (const clave of ["colegio", "deportiva"] as const) {
      const e = edicion();
      e.planes[clave].vigente = false;
      const r = validar(e);
      assert.equal(r.success, false);
      if (!r.success) assert.ok(camposDeErrorDePlanes(r.error)[`planes.${clave}.vigente`]);
    }
  });

  it("sí deja apagar o prender los que se venden de más", () => {
    const e = edicion();
    e.planes.multisede.vigente = false;
    e.planes.fundador.vigente = true;
    assert.equal(validar(e).success, true);
  });

  it("pide un nombre de plan", () => {
    const e = edicion();
    e.planes.colegio.etiqueta = "  ";
    assert.equal(validar(e).success, false);
  });

  it("el pack tiene que bonificar al menos un mes, y el referido sumar otro", () => {
    const sinBono = edicion();
    sinBono.condiciones.pack = { meses: 6, mesesQueSePagan: 6, mesesConReferido: 4 };
    assert.equal(validar(sinBono).success, false);

    const sinReferido = edicion();
    sinReferido.condiciones.pack = { meses: 6, mesesQueSePagan: 5, mesesConReferido: 5 };
    assert.equal(validar(sinReferido).success, false);

    const bien = edicion();
    bien.condiciones.pack = { meses: 12, mesesQueSePagan: 10, mesesConReferido: 9 };
    assert.equal(validar(bien).success, true);
  });

  it("pide al menos un tipo para el arancel de colegios y rechaza tipos inventados", () => {
    const vacio = edicion();
    vacio.condiciones.tiposColegio = [];
    assert.equal(validar(vacio).success, false);

    const inventado = edicion();
    (inventado.condiciones.tiposColegio as string[]) = ["Universidad de Marte"];
    assert.equal(validar(inventado).success, false);
  });

  it("limita las sedes para el plan Multisede", () => {
    for (const n of [1, 101]) {
      const e = edicion();
      e.condiciones.sedesMultisede = n;
      assert.equal(validar(e).success, false, `${n} sedes no debería pasar`);
    }
  });

  it("la pantalla abre con lo que hay guardado: pasarlo por la edición no cambia nada", () => {
    assert.deepEqual(edicionDesdeCatalogo(CATALOGO_POR_DEFECTO), edicion());
    assert.deepEqual(cambiosDePlanes(edicion(), edicion()), []);
  });
});

describe("qué cambió entre una edición y otra", () => {
  it("anota el precio de antes y el de después", () => {
    const despues = edicion();
    despues.planes.colegio.precio = 62_500;
    assert.deepEqual(cambiosDePlanes(edicion(), despues), [{ tipo: "precio", plan: "colegio", antes: 50_000, despues: 62_500 }]);
  });

  it("de lo demás anota solo qué campos se tocaron, no los textos", () => {
    const despues = edicion();
    despues.planes.deportiva.etiqueta = "Plan Clubes";
    despues.planes.deportiva.vigente = true;
    despues.planes.multisede.vigente = false;
    despues.planes.deportiva.resumen = "Otro resumen";
    assert.deepEqual(cambiosDePlanes(edicion(), despues), [
      { tipo: "plan", plan: "deportiva", campos: ["nombre", "resumen"] },
      { tipo: "plan", plan: "multisede", campos: ["si se ofrece"] },
    ]);
  });

  it("anota las condiciones que cambiaron", () => {
    const despues = edicion();
    despues.condiciones.sedesMultisede = 4;
    despues.condiciones.descuentoSedeExtra = 40;
    despues.condiciones.pack = { meses: 12, mesesQueSePagan: 10, mesesConReferido: 9 };
    despues.condiciones.tiposColegio = ["Colegio privado"];
    assert.deepEqual(cambiosDePlanes(edicion(), despues), [
      {
        tipo: "condiciones",
        campos: ["sedes para el plan Multisede", "descuento por sede adicional", "pack por adelantado", "tipos que pagan el arancel de colegios"],
      },
    ]);
  });

  it("el orden en que se tildan los tipos no cuenta como un cambio", () => {
    const despues = edicion();
    despues.condiciones.tiposColegio = [...despues.condiciones.tiposColegio].reverse();
    assert.deepEqual(cambiosDePlanes(edicion(), despues), []);
  });
});

describe("cómo se cuentan los cambios", () => {
  it("escribe cada cambio en una línea", () => {
    assert.equal(describirCambioDePlanes({ tipo: "precio", plan: "colegio", antes: 50_000, despues: 62_500 }, P.nombreDePlan), "Colegios · precio de $ 50.000 a $ 62.500");
    assert.equal(describirCambioDePlanes({ tipo: "plan", plan: "multisede", campos: ["nombre", "resumen"] }, (c) => c.toUpperCase()), "MULTISEDE · nombre, resumen");
    assert.equal(describirCambioDePlanes({ tipo: "condiciones", campos: ["pack por adelantado"] }, P.nombreDePlan), "Condiciones · pack por adelantado");
  });

  it("lee de la auditoría solo lo que tiene la forma de un cambio", () => {
    const guardado = { cambios: [{ tipo: "precio", plan: "colegio", antes: 1, despues: 2 }, { tipo: "plan", plan: "inventado", campos: ["nombre"] }, { tipo: "condiciones", campos: ["a", 3] }, "basura", null, { tipo: "condiciones", campos: ["pack por adelantado"] }] };
    assert.deepEqual(cambiosDeAuditoria(guardado), [
      { tipo: "precio", plan: "colegio", antes: 1, despues: 2 },
      { tipo: "condiciones", campos: ["pack por adelantado"] },
    ]);
    assert.deepEqual(cambiosDeAuditoria(null), []);
    assert.deepEqual(cambiosDeAuditoria({ cambios: "no es una lista" }), []);
  });

  it("la huella cambia cuando cambia cualquier cosa guardada", () => {
    const base = edicion();
    const otra = edicion();
    assert.equal(huellaDePlanes(base), huellaDePlanes(otra));
    otra.planes.anual.detalle = "otro";
    assert.notEqual(huellaDePlanes(base), huellaDePlanes(otra));
  });
});

describe("el plan sigue al tipo de institución", () => {
  const P = crearPlanes(CATALOGO_POR_DEFECTO);

  it("si el plan era el que le tocaba por su tipo, acompaña al nuevo tipo", () => {
    assert.equal(P.planTrasCambiarElTipo("deportiva", "Otro", "Colegio privado"), "colegio");
    assert.equal(P.planTrasCambiarElTipo("colegio", "Colegio privado", "Club o gimnasio"), "deportiva");
  });

  it("un plan que el equipo cambió a mano no se toca", () => {
    assert.equal(P.planTrasCambiarElTipo("multisede", "Colegio privado", "Club o gimnasio"), "multisede");
    assert.equal(P.planTrasCambiarElTipo("fundador", "Otro", "Colegio privado"), "fundador");
    assert.equal(P.planTrasCambiarElTipo("colegio", "Otro", "Club o gimnasio"), "colegio", "uno que no era el derivado de su tipo anterior");
  });

  it("si el tipo no cambia de arancel, el plan queda igual", () => {
    assert.equal(P.planTrasCambiarElTipo("colegio", "Colegio privado", "Jardín de infantes"), "colegio");
    assert.equal(P.planTrasCambiarElTipo("deportiva", "Club o gimnasio", "Natatorio o colonia"), "deportiva");
  });
});
