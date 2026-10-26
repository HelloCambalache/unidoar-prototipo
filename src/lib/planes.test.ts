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
  esClavePlan,
  edicionDesdeCatalogo,
  huellaDePlanes,
  planesPorDefecto as P,
  type AcuerdoDePrecio,
  type EdicionDePlanes,
  type FilaDeCondiciones,
  type FilaDePlan,
} from "@/lib/planes";

/** Una edición válida (la de los valores de lanzamiento) para modificar en cada prueba. */
const edicion = (): EdicionDePlanes => structuredClone(edicionDesdeCatalogo(CATALOGO_POR_DEFECTO));

const filasDeLanzamiento = (): FilaDePlan[] =>
  CLAVES_PLAN.map((clave) => {
    const p = CATALOGO_POR_DEFECTO.planes[clave];
    return { clave, etiqueta: p.label, precio: p.precio, precioMinimo: p.precioMinimo, resumen: p.resumen, detalle: p.detalle, vigente: p.vigente };
  });

const condicionesDeLanzamiento = (): FilaDeCondiciones => {
  const c = CATALOGO_POR_DEFECTO.condiciones;
  return {
    sedesMultisede: c.sedesMultisede,
    descuentoSedeExtra: c.descuentoSedeExtra,
    packMeses: c.pack.meses,
    packMesesPagos: c.pack.mesesQueSePagan,
    packMesesReferido: c.pack.mesesConReferido,
    tiposColegio: c.tiposColegio,
    puntualVigenciaDias: c.puntual.vigenciaDias,
    puntualBusquedasAbiertas: c.puntual.busquedasAbiertas,
    puntualIncluyeCursos: c.puntual.incluyeCursos,
    puntualIncluyeBuscador: c.puntual.incluyeBuscador,
  };
};

describe("planes vigentes y heredados", () => {
  const sinMultisede = crearPlanes({
    ...CATALOGO_POR_DEFECTO,
    planes: { ...CATALOGO_POR_DEFECTO.planes, multisede: { ...CATALOGO_POR_DEFECTO.planes.multisede, vigente: false } },
  });

  it("hay cuatro planes (los de Fundador, Estándar y Anual se retiraron) y todos se ofrecen de lanzamiento", () => {
    assert.deepEqual([...CLAVES_PLAN], ["colegio", "deportiva", "multisede", "puntual"]);
    assert.deepEqual(P.vigentes, ["colegio", "deportiva", "multisede", "puntual"]);
    for (const retirado of ["fundador", "estandar", "anual"]) assert.equal(esClavePlan(retirado), false, retirado);
  });

  it("sigue sabiendo el precio de un plan que el equipo dejó de ofrecer, para las facturas ya emitidas", () => {
    assert.equal(sinMultisede.planDe("multisede").precio, 15_000);
    assert.deepEqual(sinMultisede.vigentes, ["colegio", "deportiva", "puntual"]);
  });

  it("ante una clave desconocida (o de un plan retirado) cae en el plan de colegios", () => {
    assert.equal(P.planDe("lo-que-sea").label, P.planes.colegio.label);
    assert.equal(P.planDe("fundador").label, P.planes.colegio.label);
  });

  it("un selector ofrece los vigentes y, si la institución está en uno apagado, también el suyo", () => {
    assert.deepEqual(P.clavesParaElegir("colegio"), ["colegio", "deportiva", "multisede", "puntual"]);
    assert.deepEqual(sinMultisede.clavesParaElegir("colegio"), ["colegio", "deportiva", "puntual"]);
    assert.deepEqual(sinMultisede.clavesParaElegir("multisede"), ["colegio", "deportiva", "puntual", "multisede"]);
    assert.deepEqual(P.clavesParaElegir(undefined), ["colegio", "deportiva", "multisede", "puntual"]);
    assert.deepEqual(P.clavesParaElegir("lo-que-sea"), ["colegio", "deportiva", "multisede", "puntual"]);
  });

  it("cada plan aporta al MRR lo que paga por mes (la búsqueda puntual no es recurrente)", () => {
    assert.equal(P.equivalenteMensual("colegio"), 50_000);
    assert.equal(P.equivalenteMensual("deportiva"), 30_000);
    assert.equal(P.equivalenteMensual("puntual"), 0);
  });

  it("escribe el precio y el nombre corto como se ven en las pantallas", () => {
    assert.equal(P.precioDePlan("deportiva"), "$ 30.000/mes");
    assert.equal(P.precioDePlan("multisede"), "$ 15.000/mes por sede");
    assert.equal(P.nombreDePlan("multisede"), "Multisede");
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
    assert.deepEqual(P.desgloseDeMonto("colegio", 3), { sedes: 3, base: 50_000, adicionales: 2, precioAdicional: 25_000, total: 100_000, convenio: false, acordado: false });
    assert.deepEqual(P.desgloseDeMonto("deportiva", 1), { sedes: 1, base: 30_000, adicionales: 0, precioAdicional: 15_000, total: 30_000, convenio: false, acordado: false });
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

describe("precio acordado con una institución", () => {
  const abono = (monto: number): AcuerdoDePrecio => ({ modalidad: "abono", monto });
  const convenio = (monto: number): AcuerdoDePrecio => ({ modalidad: "total", monto });

  it("sin acuerdo paga el de lista, como siempre", () => {
    assert.equal(P.montoDePlan("colegio", 3, null), P.montoDePlan("colegio", 3));
    assert.equal(P.abonoDe("colegio"), 50_000);
  });

  it("un abono acordado reemplaza al de lista, y las sedes adicionales siguen con su descuento sobre ESE abono", () => {
    assert.equal(P.montoDePlan("colegio", 1, abono(48_000)), 48_000);
    assert.equal(P.montoDePlan("colegio", 2, abono(48_000)), 48_000 + 24_000);
    assert.equal(P.montoDePlan("colegio", 4, abono(48_000)), 48_000 + 3 * 24_000);
    assert.equal(P.precioDeSedeExtra("deportiva", abono(28_000)), 14_000);
  });

  it("un convenio a medida es un monto fijo: no depende de las sedes", () => {
    for (const sedes of [1, 4, 9, 30]) assert.equal(P.montoDePlan("colegio", sedes, convenio(180_000)), 180_000);
    assert.equal(P.montoDePlan("multisede", 12, convenio(95_000)), 95_000, "tampoco en un plan por sede");
  });

  it("en un plan por sede, un abono acordado es el precio de cada sede", () => {
    assert.equal(P.montoDePlan("multisede", 6, abono(12_000)), 72_000);
  });

  it("un abono acordado nunca cobra más que la lista (cambió el plan o bajó la lista)", () => {
    assert.equal(P.montoDePlan("deportiva", 1, abono(48_000)), 30_000, "un abono de colegio aplicado a un club");
    assert.equal(P.abonoDe("colegio", abono(60_000)), 50_000);
  });

  it("explica el monto con un acuerdo: abono, convenio y sedes", () => {
    assert.deepEqual(P.desgloseDeMonto("colegio", 3, abono(48_000)), {
      sedes: 3,
      base: 48_000,
      adicionales: 2,
      precioAdicional: 24_000,
      total: 96_000,
      convenio: false,
      acordado: true,
    });
    assert.deepEqual(P.desgloseDeMonto("colegio", 5, convenio(200_000)), {
      sedes: 5,
      base: 200_000,
      adicionales: 0,
      precioAdicional: 0,
      total: 200_000,
      convenio: true,
      acordado: true,
    });
  });

  it("el MRR y el semestre siguen el acuerdo", () => {
    assert.equal(P.equivalenteMensual("colegio", 1, abono(48_000)), 48_000);
    assert.equal(P.equivalenteMensual("colegio", 1, convenio(180_000)), 180_000);
    assert.equal(P.packDe("colegio", 1, abono(48_000)).anticipado, 240_000, "el ejemplo del esquema: 5 meses de $ 48.000");
    assert.equal(P.packDe("colegio", 1, abono(48_000)).conReferido, 192_000, "y con referido, 4");
    assert.equal(P.packDe("deportiva", 1, abono(28_000)).anticipado, 140_000);
    assert.equal(P.packDe("deportiva", 1, abono(28_000)).conReferido, 112_000);
  });

  it("el rango de un abono va del piso a la lista; sin piso es un solo valor", () => {
    assert.deepEqual(P.rangoDeAbono("colegio"), { minimo: 48_000, maximo: 50_000 });
    assert.deepEqual(P.rangoDeAbono("deportiva"), { minimo: 28_000, maximo: 30_000 });
    assert.deepEqual(P.rangoDeAbono("multisede"), { minimo: 15_000, maximo: 15_000 });
  });

  it("acepta un abono dentro del rango y rechaza el que se sale", () => {
    assert.equal(P.errorDeAcuerdo("colegio", abono(48_000)), null);
    assert.equal(P.errorDeAcuerdo("colegio", abono(49_000)), null);
    assert.equal(P.errorDeAcuerdo("colegio", abono(50_000)), null);
    assert.match(P.errorDeAcuerdo("colegio", abono(47_999))!, /entre \$ 48\.000 y \$ 50\.000/);
    assert.match(P.errorDeAcuerdo("colegio", abono(50_001))!, /entre \$ 48\.000 y \$ 50\.000/);
  });

  it("sin piso no hay abono para acordar: hace falta un piso o un convenio", () => {
    assert.match(P.errorDeAcuerdo("multisede", abono(14_000))!, /no tiene un piso/);
    assert.equal(P.errorDeAcuerdo("multisede", abono(15_000)), null);
    assert.equal(P.errorDeAcuerdo("multisede", convenio(14_000)), null, "un convenio no tiene rango");
  });

  it("un convenio puede estar por arriba o por debajo del rango, pero tiene que ser un monto válido", () => {
    assert.equal(P.errorDeAcuerdo("colegio", convenio(400_000)), null);
    assert.equal(P.errorDeAcuerdo("colegio", convenio(20_000)), null);
    for (const mal of [0, -5, 1000.5, 99_000_000]) assert.ok(P.errorDeAcuerdo("colegio", convenio(mal)), `${mal} no debería pasar`);
  });
});

describe("el piso del rango de precio", () => {
  it("los planes de colegios y clubes arrancan con el piso del esquema; el resto, sin piso", () => {
    assert.equal(P.planes.colegio.precioMinimo, 48_000);
    assert.equal(P.planes.deportiva.precioMinimo, 28_000);
    assert.equal(P.planes.multisede.precioMinimo, null);
  });

  it("de la base toma el piso que cargó el equipo, y null es 'sin piso' (no vuelve al de lanzamiento)", () => {
    const con = (clave: string, precioMinimo: number | null | undefined) =>
      filasDeLanzamiento().map((f) => (f.clave === clave ? { ...f, precioMinimo } : f));
    assert.equal(catalogoDesdeLaBase(con("colegio", 45_000), condicionesDeLanzamiento()).planes.colegio.precioMinimo, 45_000);
    assert.equal(catalogoDesdeLaBase(con("colegio", null), condicionesDeLanzamiento()).planes.colegio.precioMinimo, null, "el equipo lo sacó");
    assert.equal(catalogoDesdeLaBase(con("colegio", undefined), condicionesDeLanzamiento()).planes.colegio.precioMinimo, 48_000, "sin el dato vale el de lanzamiento");
  });

  it("un piso que no tiene sentido (más alto que la lista, cero o con centavos) se descarta", () => {
    for (const roto of [60_000, 0, -1, 1000.5]) {
      const filas = filasDeLanzamiento().map((f) => (f.clave === "colegio" ? { ...f, precioMinimo: roto } : f));
      assert.equal(catalogoDesdeLaBase(filas, condicionesDeLanzamiento()).planes.colegio.precioMinimo, null, `${roto}`);
    }
  });

  it("la edición acepta un piso igual o menor a la lista y no uno más alto", () => {
    const e = structuredClone(edicionDesdeCatalogo(CATALOGO_POR_DEFECTO));
    e.planes.colegio.precioMinimo = 50_000;
    assert.equal(edicionDePlanesSchema.safeParse(e).success, true);
    e.planes.colegio.precioMinimo = null;
    assert.equal(edicionDePlanesSchema.safeParse(e).success, true, "sin piso");
    e.planes.colegio.precioMinimo = 50_001;
    const r = edicionDePlanesSchema.safeParse(e);
    assert.equal(r.success, false);
    if (!r.success) assert.ok(camposDeErrorDePlanes(r.error)["planes.colegio.precioMinimo"]);
    e.planes.colegio.precioMinimo = 0;
    assert.equal(edicionDePlanesSchema.safeParse(e).success, false);
  });

  it("cambiar el piso queda anotado como cambio del plan", () => {
    const despues = structuredClone(edicionDesdeCatalogo(CATALOGO_POR_DEFECTO));
    despues.planes.deportiva.precioMinimo = 25_000;
    assert.deepEqual(cambiosDePlanes(edicionDesdeCatalogo(CATALOGO_POR_DEFECTO), despues), [{ tipo: "plan", plan: "deportiva", campos: ["precio mínimo"] }]);
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

  it("las pymes y entidades de barrio del esquema (escuelas deportivas, sociedades de fomento, idiomas, gimnasios) pagan el arancel de clubes", () => {
    for (const tipo of ["Escuela deportiva", "Sociedad de fomento", "Instituto de idiomas", "Club o gimnasio"]) {
      assert.ok((TIPOS_INSTITUCION as readonly string[]).includes(tipo), `${tipo} tiene que poder elegirse`);
      assert.equal(P.planPorTipo(tipo), "deportiva", tipo);
      assert.ok((P.tiposPorPlan.deportiva as readonly string[]).includes(tipo), `${tipo} se lista en el arancel de clubes`);
    }
    assert.ok(!(P.tiposPorPlan.colegio as readonly string[]).includes("Escuela deportiva"));
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
      .filter((f) => f.clave !== "multisede")
      .map((f) => (f.clave === "colegio" ? { ...f, precio: 0, etiqueta: "   " } : f));
    const c = catalogoDesdeLaBase(filas, condicionesDeLanzamiento());
    assert.equal(c.planes.multisede.precio, 15_000);
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
    e.planes.puntual.vigente = false;
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
    otra.planes.multisede.detalle = "otro";
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
    assert.equal(P.planTrasCambiarElTipo("colegio", "Otro", "Club o gimnasio"), "colegio", "uno que no era el derivado de su tipo anterior");
  });

  it("si el tipo no cambia de arancel, el plan queda igual", () => {
    assert.equal(P.planTrasCambiarElTipo("colegio", "Colegio privado", "Jardín de infantes"), "colegio");
    assert.equal(P.planTrasCambiarElTipo("deportiva", "Club o gimnasio", "Natatorio o colonia"), "deportiva");
  });
});

describe("el plan que queda al guardar el alta", () => {
  const apagado = crearPlanes({
    ...CATALOGO_POR_DEFECTO,
    planes: { ...CATALOGO_POR_DEFECTO.planes, puntual: { ...CATALOGO_POR_DEFECTO.planes.puntual, vigente: false } },
  });

  it("una cuenta nueva arranca con el arancel de su tipo, o con una sola búsqueda si lo eligió", () => {
    assert.equal(P.planDelAlta({ tipo: "Colegio privado" }), "colegio");
    assert.equal(P.planDelAlta({ tipo: "Colegio privado", modalidad: "abono" }), "colegio");
    assert.equal(P.planDelAlta({ tipo: "Club o gimnasio", modalidad: "abono" }), "deportiva");
    assert.equal(P.planDelAlta({ tipo: "Colegio privado", modalidad: "puntual" }), "puntual");
    assert.equal(P.planDelAlta({ tipo: "Escuela deportiva", modalidad: "puntual" }), "puntual");
  });

  it("si la búsqueda puntual ya no se ofrece, elegirla (un formulario viejo) no sirve: queda el arancel de su tipo", () => {
    assert.equal(apagado.planDelAlta({ tipo: "Colegio privado", modalidad: "puntual" }), "colegio");
  });

  it("al volver al paso 2: del arancel de su tipo pasa a una sola búsqueda, y de ahí vuelve al abono", () => {
    assert.equal(P.planDelAlta({ actual: "colegio", tipoAnterior: "Colegio privado", tipo: "Colegio privado", modalidad: "puntual" }), "puntual");
    assert.equal(P.planDelAlta({ actual: "puntual", tipoAnterior: "Colegio privado", tipo: "Colegio privado", modalidad: "puntual" }), "puntual");
    assert.equal(P.planDelAlta({ actual: "puntual", tipoAnterior: "Colegio privado", tipo: "Colegio privado", modalidad: "abono" }), "colegio");
    assert.equal(P.planDelAlta({ actual: "puntual", tipoAnterior: "Colegio privado", tipo: "Club o gimnasio", modalidad: "abono" }), "deportiva");
  });

  it("un plan que el equipo asignó a mano no se pisa, elija lo que elija", () => {
    for (const modalidad of ["abono", "puntual", undefined] as const) {
      assert.equal(P.planDelAlta({ actual: "multisede", tipoAnterior: "Colegio privado", tipo: "Colegio privado", modalidad }), "multisede", String(modalidad));
    }
  });

  it("sin elección (la opción no se mostró) el plan sigue al tipo, como siempre, y una cuenta en puntual se queda ahí", () => {
    assert.equal(P.planDelAlta({ actual: "deportiva", tipoAnterior: "Otro", tipo: "Colegio privado" }), "colegio");
    assert.equal(P.planDelAlta({ actual: "colegio", tipoAnterior: "Colegio privado", tipo: "Club o gimnasio" }), "deportiva");
    assert.equal(P.planDelAlta({ actual: "puntual", tipoAnterior: "Colegio privado", tipo: "Club o gimnasio" }), "puntual");
  });

  it("cambiar el tipo sin elegir una sola búsqueda no deja quedarse con el arancel más barato", () => {
    // "Otro" paga el arancel de clubes; pasar después a Colegio antes de verificarse tiene que subirlo al de colegios.
    assert.equal(P.planDelAlta({ actual: "deportiva", tipoAnterior: "Otro", tipo: "Colegio privado", modalidad: "abono" }), "colegio");
  });
});

describe("qué planes puede pedir una institución", () => {
  it("un colegio puede pedir el arancel de colegios y la búsqueda puntual, no el de clubes (que es más barato)", () => {
    assert.deepEqual(P.planesParaPedir("Colegio privado", 1, "colegio"), ["colegio", "puntual"]);
    assert.ok(!P.planesParaPedir("Colegio privado", 1, "colegio").includes("deportiva"));
  });

  it("un club (o un tipo escrito a mano) puede pedir el arancel de clubes y la búsqueda puntual", () => {
    assert.deepEqual(P.planesParaPedir("Club o gimnasio", 1, "deportiva"), ["deportiva", "puntual"]);
    assert.deepEqual(P.planesParaPedir("Sociedad de fomento", 2, "deportiva"), ["deportiva", "puntual"]);
  });

  it("Multisede solo aparece con sedes para una red (desde las de Planes)", () => {
    assert.ok(!P.planesParaPedir("Colegio privado", 4, "colegio").includes("multisede"));
    assert.deepEqual(P.planesParaPedir("Colegio privado", 5, "colegio"), ["colegio", "multisede", "puntual"]);
  });

  it("quien está en un plan que no es el de su tipo (asignado a mano) lo ve como actual y puede volver al de su tipo", () => {
    assert.deepEqual(P.planesParaPedir("Colegio privado", 1, "multisede"), ["colegio", "multisede", "puntual"]);
    assert.deepEqual(P.planesParaPedir("Colegio privado", 1, "puntual"), ["colegio", "puntual"]);
  });

  it("un plan que el equipo apagó no se ofrece, salvo a quien ya lo tiene", () => {
    const apagado = crearPlanes({
      ...CATALOGO_POR_DEFECTO,
      planes: { ...CATALOGO_POR_DEFECTO.planes, puntual: { ...CATALOGO_POR_DEFECTO.planes.puntual, vigente: false } },
    });
    assert.deepEqual(apagado.planesParaPedir("Colegio privado", 1, "colegio"), ["colegio"]);
    assert.deepEqual(apagado.planesParaPedir("Colegio privado", 1, "puntual"), ["colegio", "puntual"]);
  });

  it("sigue lo que cambie el equipo en Planes: qué tipos pagan el arancel de colegios", () => {
    const catalogo = structuredClone(CATALOGO_POR_DEFECTO);
    catalogo.condiciones.tiposColegio = ["Colegio privado"];
    assert.deepEqual(crearPlanes(catalogo).planesParaPedir("Universidad", 1, "deportiva"), ["deportiva", "puntual"]);
  });
});

describe("meses bonificados por recomendación (mes a mes)", () => {
  const con = (referidoMesesMensual: number | undefined) =>
    catalogoDesdeLaBase(filasDeLanzamiento(), { ...condicionesDeLanzamiento(), referidoMesesMensual }).condiciones.referidoMesesMensual;

  it("de lanzamiento son 2 meses", () => {
    assert.equal(CATALOGO_POR_DEFECTO.condiciones.referidoMesesMensual, 2);
  });

  it("se lee lo que guardó el equipo, incluido 0 (no se ofrece)", () => {
    assert.equal(con(3), 3);
    assert.equal(con(1), 1);
    assert.equal(con(12), 12);
    assert.equal(con(0), 0);
  });

  it("un valor roto o una base sin la columna vuelve al de lanzamiento", () => {
    for (const roto of [-1, 13, 1.5, undefined]) assert.equal(con(roto), 2, `${roto}`);
  });

  it("la edición acepta de 0 a 12 y rechaza lo demás", () => {
    for (const valor of [0, 1, 2, 12]) {
      const e = edicion();
      e.condiciones.referidoMesesMensual = valor;
      assert.equal(edicionDePlanesSchema.safeParse(e).success, true, `${valor}`);
    }
    for (const valor of [-1, 13, 2.5]) {
      const e = edicion();
      e.condiciones.referidoMesesMensual = valor;
      assert.equal(edicionDePlanesSchema.safeParse(e).success, false, `${valor}`);
    }
  });

  it("un cambio queda anotado en los últimos cambios", () => {
    const antes = edicion();
    const despues = edicion();
    despues.condiciones.referidoMesesMensual = 3;
    assert.deepEqual(cambiosDePlanes(antes, despues), [{ tipo: "condiciones", campos: ["meses bonificados por recomendación"] }]);
    assert.deepEqual(cambiosDePlanes(antes, edicion()), []);
  });
});

describe("la búsqueda puntual", () => {
  it("es un plan por evento: se paga cada búsqueda, sin abono ni ingreso mensual", () => {
    assert.equal(P.esPuntual("puntual"), true);
    for (const clave of ["colegio", "deportiva", "multisede"]) assert.equal(P.esPuntual(clave), false, clave);
    assert.equal(P.equivalenteMensual("puntual"), 0, "no entra en el MRR");
    assert.equal(P.planDe("puntual").precio, 110_000);
    assert.equal(P.planDe("puntual").precioMinimo, 95_000);
  });

  it("escribe el precio por búsqueda y no por mes", () => {
    assert.equal(P.precioDePlan("puntual"), "$ 110.000 por búsqueda");
    assert.equal(P.sufijoDePrecio("puntual"), " por búsqueda");
    assert.equal(P.sufijoDePrecio("colegio"), "/mes");
  });

  it("los planes con abono incluyen todo y la búsqueda puntual solo lo que se tildó", () => {
    for (const beneficio of ["cursos", "buscador"] as const) {
      assert.equal(P.incluye("colegio", beneficio), true);
      assert.equal(P.incluye("puntual", beneficio), false, "de lanzamiento no incluye ninguno");
    }
    const abierto = crearPlanes({
      ...CATALOGO_POR_DEFECTO,
      condiciones: { ...CATALOGO_POR_DEFECTO.condiciones, puntual: { ...CATALOGO_POR_DEFECTO.condiciones.puntual, incluyeCursos: true } },
    });
    assert.equal(abierto.incluye("puntual", "cursos"), true);
    assert.equal(abierto.incluye("puntual", "buscador"), false);
  });

  it("las condiciones de la base se leen y una rota se reemplaza campo por campo", () => {
    const con = (c: Partial<FilaDeCondiciones>) => catalogoDesdeLaBase(filasDeLanzamiento(), { ...condicionesDeLanzamiento(), ...c }).condiciones.puntual;
    assert.deepEqual(con({ puntualVigenciaDias: 45, puntualBusquedasAbiertas: 2, puntualIncluyeCursos: true }), {
      vigenciaDias: 45,
      busquedasAbiertas: 2,
      incluyeCursos: true,
      incluyeBuscador: false,
    });
    assert.equal(con({ puntualVigenciaDias: 0 }).vigenciaDias, 30);
    assert.equal(con({ puntualVigenciaDias: 400 }).vigenciaDias, 30);
    assert.equal(con({ puntualVigenciaDias: 7.5 }).vigenciaDias, 30);
    assert.equal(con({ puntualBusquedasAbiertas: 0 }).busquedasAbiertas, 1);
    assert.equal(con({ puntualBusquedasAbiertas: 21 }).busquedasAbiertas, 1);
    assert.equal(con({ puntualIncluyeBuscador: undefined }).incluyeBuscador, false, "sin la columna vale el de lanzamiento");
  });

  it("sin las columnas nuevas (una base a la que todavía no se le corrió el script) vale todo lo de lanzamiento", () => {
    const { tiposColegio, sedesMultisede, descuentoSedeExtra, packMeses, packMesesPagos, packMesesReferido } = condicionesDeLanzamiento();
    const vieja: FilaDeCondiciones = { tiposColegio, sedesMultisede, descuentoSedeExtra, packMeses, packMesesPagos, packMesesReferido };
    assert.deepEqual(catalogoDesdeLaBase(filasDeLanzamiento(), vieja).condiciones.puntual, CATALOGO_POR_DEFECTO.condiciones.puntual);
  });

  it("la edición acepta las condiciones de lanzamiento y rechaza una vigencia o un tope fuera de rango", () => {
    assert.equal(edicionDePlanesSchema.safeParse(edicion()).success, true);
    for (const [campo, valor] of [
      ["vigenciaDias", 0],
      ["vigenciaDias", 366],
      ["vigenciaDias", 30.5],
      ["busquedasAbiertas", 0],
      ["busquedasAbiertas", 21],
    ] as const) {
      const e = edicion();
      e.condiciones.puntual[campo] = valor;
      assert.equal(edicionDePlanesSchema.safeParse(e).success, false, `${campo} = ${valor} no debería pasar`);
    }
  });

  it("un cambio de las condiciones queda anotado, y el piso no puede pasar el precio", () => {
    const antes = edicion();
    const despues = edicion();
    despues.condiciones.puntual.vigenciaDias = 45;
    assert.deepEqual(cambiosDePlanes(antes, despues), [{ tipo: "condiciones", campos: ["condiciones de la búsqueda puntual"] }]);

    const roto = edicion();
    roto.planes.puntual.precioMinimo = roto.planes.puntual.precio + 1;
    assert.equal(edicionDePlanesSchema.safeParse(roto).success, false);
  });
});
