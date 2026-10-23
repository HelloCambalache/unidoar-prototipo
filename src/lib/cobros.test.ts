import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conflictosDeSemestre,
  errorDeFechaDePago,
  errorDeInicioDeSemestre,
  estadoEfectivo,
  etiquetaDeCobertura,
  etiquetaPeriodo,
  fechaCobroDelPeriodo,
  pagoEfectivoSchema,
  pagoHastaDeMes,
  pagoSchema,
  planificarFacturas,
  semestreSchema,
  situacionDelMes,
  sumarMeses,
  textoRecordatorio,
  ultimoMesCubierto,
  type FacturaReciente,
  type InstitucionFacturable,
} from "@/lib/cobros";
import { CATALOGO_POR_DEFECTO, crearPlanes } from "@/lib/planes";

describe("períodos y fechas de cobro", () => {
  it("suma meses cruzando de año", () => {
    assert.equal(sumarMeses("2026-11", 3), "2027-02");
    assert.equal(sumarMeses("2026-10", -11), "2025-11");
    assert.equal(sumarMeses("2026-01", -1), "2025-12");
  });

  it("arma la fecha de cobro con el día de la institución, o el 10 por defecto", () => {
    assert.equal(fechaCobroDelPeriodo("2026-10"), "2026-10-10");
    assert.equal(fechaCobroDelPeriodo("2026-10", 25), "2026-10-25");
    assert.equal(fechaCobroDelPeriodo("2026-10", null), "2026-10-10");
  });

  it("acota el día al largo del mes", () => {
    assert.equal(fechaCobroDelPeriodo("2027-02", 31), "2027-02-28");
    assert.equal(fechaCobroDelPeriodo("2028-02", 31), "2028-02-29");
    assert.equal(fechaCobroDelPeriodo("2026-04", 0), "2026-04-01");
  });

  it("escribe el período en español", () => {
    assert.equal(etiquetaPeriodo("2026-09"), "Septiembre 2026");
  });

  it("una factura pendiente con la fecha vencida cuenta como vencida; la paga nunca", () => {
    assert.equal(estadoEfectivo("pendiente", "2026-10-05", "2026-10-07"), "vencida");
    assert.equal(estadoEfectivo("pendiente", "2026-10-07", "2026-10-07"), "pendiente");
    assert.equal(estadoEfectivo("pagada", "2026-01-01", "2026-10-07"), "pagada");
    assert.equal(estadoEfectivo("vencida", "2026-12-01", "2026-10-07"), "vencida");
  });
});

describe("registrar un pago", () => {
  it("acepta una fecha real (la expresión regular no debe perder las barras invertidas)", () => {
    assert.equal(pagoSchema.safeParse({ medio: "Transferencia", fecha: "2026-10-03" }).success, true);
    assert.equal(pagoSchema.safeParse({ medio: "Transferencia" }).success, true);
  });

  it("rechaza fechas con otro formato o que no existen", () => {
    for (const fecha of ["03/10/2026", "2026-13-45", "2026-02-30", "hoy"]) {
      assert.equal(pagoSchema.safeParse({ medio: "Transferencia", fecha }).success, false, fecha);
    }
  });

  it("rechaza un medio de pago desconocido", () => {
    assert.equal(pagoSchema.safeParse({ medio: "Bitcoin" }).success, false);
  });

  it("la fecha del pago no puede ser futura ni de hace más de un año", () => {
    assert.equal(errorDeFechaDePago("2026-10-07", "2026-10-07"), null);
    assert.equal(errorDeFechaDePago("2026-09-01", "2026-10-07"), null);
    assert.match(errorDeFechaDePago("2026-10-08", "2026-10-07") ?? "", /futura/);
    assert.match(errorDeFechaDePago("2025-01-01", "2026-10-07") ?? "", /más de un año/);
  });
});

describe("pago en efectivo en un solo paso", () => {
  const base = { periodo: "2026-10", plan: "estandar", fecha: "2026-10-03", avisar: true };

  it("acepta un pago completo y recorta la nota", () => {
    const r = pagoEfectivoSchema.parse({ ...base, nota: "  Recibo 0001  " });
    assert.equal(r.nota, "Recibo 0001");
    assert.equal(r.avisar, true);
  });

  it("la nota es optativa: vacía queda sin nota", () => {
    assert.equal(pagoEfectivoSchema.parse({ ...base, nota: "   " }).nota, undefined);
    assert.equal(pagoEfectivoSchema.parse(base).nota, undefined);
  });

  it("rechaza un mes, un plan o una fecha inválidos", () => {
    assert.equal(pagoEfectivoSchema.safeParse({ ...base, periodo: "2026-13" }).success, false);
    assert.equal(pagoEfectivoSchema.safeParse({ ...base, periodo: "octubre" }).success, false);
    assert.equal(pagoEfectivoSchema.safeParse({ ...base, plan: "gratis" }).success, false);
    assert.equal(pagoEfectivoSchema.safeParse({ ...base, fecha: "" }).success, false);
    assert.equal(pagoEfectivoSchema.safeParse({ ...base, fecha: "2026-02-30" }).success, false);
  });

  it("exige saber si se avisa y limita la nota", () => {
    assert.equal(pagoEfectivoSchema.safeParse({ periodo: base.periodo, plan: base.plan, fecha: base.fecha }).success, false);
    assert.equal(pagoEfectivoSchema.safeParse({ ...base, nota: "x".repeat(121) }).success, false);
  });

  it("el monto no viaja en el pedido: lo que se mande de más se ignora", () => {
    const r = pagoEfectivoSchema.parse({ ...base, monto: 1 });
    assert.equal("monto" in r, false);
  });

  it("distingue un mes pago, impago y sin factura", () => {
    assert.equal(situacionDelMes(undefined), "sinFactura");
    assert.equal(situacionDelMes(null), "sinFactura");
    assert.equal(situacionDelMes({ estado: "pagada" }), "pagada");
    assert.equal(situacionDelMes({ estado: "pendiente" }), "impaga");
    assert.equal(situacionDelMes({ estado: "vencida" }), "impaga");
  });
});

describe("semestre al contado (una factura paga que cubre varios meses)", () => {
  const semestre = { periodo: "2026-10", estado: "pagada", mesesCubiertos: 6 };

  it("cubre los meses desde su período, y una mensual solo el suyo", () => {
    assert.equal(ultimoMesCubierto(semestre), "2027-03");
    assert.equal(ultimoMesCubierto({ periodo: "2026-10", mesesCubiertos: 1 }), "2026-10");
    assert.equal(ultimoMesCubierto({ periodo: "2026-10" }), "2026-10");
    assert.equal(ultimoMesCubierto({ periodo: "2026-10", mesesCubiertos: 0 }), "2026-10", "nunca menos de un mes");
  });

  it("dice hasta qué mes está pago un mes, mirando solo facturas pagas", () => {
    assert.equal(pagoHastaDeMes("2026-10", [semestre]), "2027-03");
    assert.equal(pagoHastaDeMes("2027-03", [semestre]), "2027-03", "el último mes cubierto todavía cuenta");
    assert.equal(pagoHastaDeMes("2027-04", [semestre]), null, "el mes siguiente ya no");
    assert.equal(pagoHastaDeMes("2026-09", [semestre]), null, "ni uno anterior");
    assert.equal(pagoHastaDeMes("2026-12", [{ ...semestre, estado: "pendiente" }]), null, "una impaga no cubre nada");
    assert.equal(pagoHastaDeMes("2026-10", [{ periodo: "2026-10", estado: "pagada" }]), "2026-10", "una mensual paga cubre su mes");
  });

  it("con varias facturas que cubren el mes, vale la que llega más lejos", () => {
    assert.equal(pagoHastaDeMes("2026-11", [{ periodo: "2026-11", estado: "pagada" }, semestre]), "2027-03");
  });

  it("cruza de año al contar los meses", () => {
    assert.equal(ultimoMesCubierto({ periodo: "2026-08", mesesCubiertos: 6 }), "2027-01");
    assert.equal(pagoHastaDeMes("2027-01", [{ periodo: "2026-08", estado: "pagada", mesesCubiertos: 6 }]), "2027-01");
  });

  it("etiqueta una mensual como siempre y un semestre con su rango", () => {
    assert.equal(etiquetaDeCobertura("2026-10"), "Octubre 2026");
    assert.equal(etiquetaDeCobertura("2026-10", 1), "Octubre 2026");
    assert.equal(etiquetaDeCobertura("2026-10", 6), "6 meses (octubre 2026 a marzo 2027)");
  });

  it("detecta lo que impide registrar un semestre: meses ya pagos y facturas sin pagar adentro", () => {
    assert.deepEqual(conflictosDeSemestre("2026-10", 6, []), { pagos: [], impagas: [] });
    // Una factura del mes en que empieza, sin pagar, no estorba: se convierte en la del semestre.
    assert.deepEqual(conflictosDeSemestre("2026-10", 6, [{ periodo: "2026-10", estado: "pendiente" }]), { pagos: [], impagas: [] });
    assert.deepEqual(conflictosDeSemestre("2026-10", 6, [{ periodo: "2026-10", estado: "pagada" }]), { pagos: ["2026-10"], impagas: [] });
    assert.deepEqual(conflictosDeSemestre("2026-10", 6, [{ periodo: "2026-12", estado: "vencida" }]), { pagos: [], impagas: ["2026-12"] });
    // Otro semestre que ya cubre parte de la ventana también la bloquea.
    assert.deepEqual(conflictosDeSemestre("2026-12", 6, [semestre]), { pagos: ["2026-10"], impagas: [] });
    // Facturas de antes o de después de la ventana no cuentan.
    assert.deepEqual(
      conflictosDeSemestre("2026-10", 6, [
        { periodo: "2026-09", estado: "pagada" },
        { periodo: "2027-04", estado: "pendiente" },
      ]),
      { pagos: [], impagas: [] },
    );
  });

  it("el mes de inicio se puede elegir de hace un año a dentro de dos meses", () => {
    assert.equal(errorDeInicioDeSemestre("2026-10", "2026-10"), null);
    assert.equal(errorDeInicioDeSemestre("2025-11", "2026-10"), null, "hace once meses todavía vale");
    assert.equal(errorDeInicioDeSemestre("2026-12", "2026-10"), null);
    assert.ok(errorDeInicioDeSemestre("2025-10", "2026-10"), "hace más de un año");
    assert.ok(errorDeInicioDeSemestre("2027-01", "2026-10"), "demasiado adelante");
  });

  it("el formulario pide el mes, cómo pagó y la fecha; el monto nunca viene del cliente", () => {
    const bien = { periodo: "2026-10", medio: "Transferencia", fecha: "2026-10-05", avisar: true, cancelarDebito: false };
    assert.equal(semestreSchema.safeParse(bien).success, true);
    assert.equal(semestreSchema.safeParse({ ...bien, medio: "Efectivo", nota: "Recibo 0042" }).success, true);
    for (const malo of [
      { ...bien, medio: "Tarjeta" },
      { ...bien, medio: "Débito automático" },
      { ...bien, periodo: "2026-13" },
      { ...bien, fecha: "2026-02-30" },
      { ...bien, nota: "x".repeat(121) },
    ]) {
      assert.equal(semestreSchema.safeParse(malo).success, false, JSON.stringify(malo));
    }
    const r = semestreSchema.safeParse({ ...bien, monto: 1 });
    assert.equal(r.success, true);
    assert.ok(!("monto" in r.data!), "un monto que venga del cliente se descarta");
  });
});

describe("recordatorio de cobro", () => {
  const cobro = { periodo: "2026-10", monto: 54_000, fechaCobro: "2026-10-10" };

  it("menciona el mes, el monto y el vencimiento de una factura", () => {
    const t = textoRecordatorio("María Gómez", "Colegio Norte", [cobro]);
    assert.match(t, /^Hola María,/);
    assert.match(t, /Octubre 2026/);
    assert.match(t, /54\.000/);
    assert.match(t, /10\/10\/2026/);
  });

  it("junta varias facturas pendientes con el total", () => {
    const t = textoRecordatorio(null, "Colegio Norte", [cobro, { ...cobro, periodo: "2026-09", fechaCobro: "2026-09-10" }]);
    assert.match(t, /2 cobros pendientes/);
    assert.match(t, /108\.000/);
  });

  it("avisa que está todo al día si no hay nada pendiente", () => {
    assert.match(textoRecordatorio(null, "Colegio Norte", []), /todo al día/);
  });
});

describe("facturas automáticas (planificarFacturas)", () => {
  const P = "2026-10";
  const HOY = "2026-10-07";
  const inst = (id: string, plan: string, diaCobro: number | null = null, medioPago: string | null = null): InstitucionFacturable => ({
    id,
    plan,
    diaCobro,
    medioPago,
  });
  const f = (institucionId: string, periodo: string, plan: string, estado: string): FacturaReciente => ({
    institucionId,
    periodo,
    plan,
    estado,
  });
  const una = (i: InstitucionFacturable, recientes: FacturaReciente[], periodo = P, hoy = HOY) =>
    planificarFacturas([i], recientes, periodo, hoy);

  it("factura una multisede por la cantidad de sedes que tiene", () => {
    const r = planificarFacturas([{ ...inst("m", "multisede"), sedes: 6 }], [f("m", "2026-09", "multisede", "pagada")], P, HOY);
    assert.equal(r.crear[0]!.monto, 90_000, "6 sedes × $ 15.000");
    assert.deepEqual(r.omitidas, []);
    const sinDato = planificarFacturas([inst("m", "multisede")], [f("m", "2026-09", "multisede", "pagada")], P, HOY);
    assert.equal(sinDato.crear[0]!.monto, 15_000, "sin saber las sedes, una");
  });

  it("no factura los meses cubiertos por un semestre pagado al contado, y retoma al terminar", () => {
    const semestre = (periodo: string, estado = "pagada"): FacturaReciente => ({ ...f("a", periodo, "colegio", estado), mesesCubiertos: 6 });
    // El semestre empezó en agosto: cubre hasta enero, así que ni octubre ni noviembre se facturan.
    const cubierto = planificarFacturas([inst("a", "colegio")], [semestre("2026-08")], "2026-10", HOY);
    assert.deepEqual(cubierto.crear, []);
    assert.deepEqual(cubierto.omitidas, [{ institucionId: "a", motivo: "cubierta_por_semestre" }]);
    assert.equal(planificarFacturas([inst("a", "colegio")], [semestre("2026-08")], "2027-01", "2027-01-07").crear.length, 0, "el último mes cubierto tampoco");
    // Terminado, vuelve a facturarse mes a mes.
    const siguiente = planificarFacturas([inst("a", "colegio")], [semestre("2026-08")], "2027-02", "2027-02-07");
    assert.equal(siguiente.crear.length, 1);
    assert.equal(siguiente.crear[0]!.monto, 50_000);
    // Un semestre sin pagar no cubre nada.
    assert.equal(planificarFacturas([inst("a", "colegio")], [semestre("2026-08", "pendiente")], "2026-10", HOY).crear.length, 1);
    // Una factura mensual común (sin meses cubiertos) sigue como antes: no cubre el mes siguiente.
    assert.equal(planificarFacturas([inst("a", "colegio")], [f("a", "2026-09", "colegio", "pagada")], "2026-10", HOY).crear.length, 1);
  });

  it("factura las sedes adicionales de un colegio a la mitad del abono", () => {
    const dos = planificarFacturas([{ ...inst("a", "colegio"), sedes: 2 }], [f("a", "2026-09", "colegio", "pagada")], P, HOY);
    assert.equal(dos.crear[0]!.monto, 75_000, "$ 50.000 la primera + $ 25.000 la segunda");
    const cuatro = planificarFacturas([{ ...inst("a", "deportiva"), sedes: 4 }], [f("a", "2026-09", "deportiva", "pagada")], P, HOY);
    assert.equal(cuatro.crear[0]!.monto, 75_000, "$ 30.000 + 3 × $ 15.000");
    const unaSola = planificarFacturas([{ ...inst("a", "colegio"), sedes: 1 }], [f("a", "2026-09", "colegio", "pagada")], P, HOY);
    assert.equal(unaSola.crear[0]!.monto, 50_000, "con una sola sede, el abono de siempre");
  });

  it("crea la del mes con el monto del plan y el día de cobro por defecto", () => {
    const r = una(inst("a", "fundador", null, "Transferencia"), [f("a", "2026-09", "fundador", "pagada")]);
    assert.deepEqual(r.crear, [
      { institucionId: "a", plan: "fundador", monto: 54_000, periodo: P, fechaCobro: "2026-10-10", medio: "Transferencia" },
    ]);
    assert.deepEqual(r.omitidas, []);
  });

  it("usa el monto de cada plan", () => {
    assert.equal(una(inst("a", "estandar"), []).crear[0]!.monto, 89_000);
    assert.equal(una(inst("a", "anual"), []).crear[0]!.monto, 720_000);
  });

  it("el monto sale de los planes vigentes: si el equipo cambió el precio, la factura del mes sale con el nuevo", () => {
    const catalogo = structuredClone(CATALOGO_POR_DEFECTO);
    catalogo.planes.fundador.precio = 58_000;
    const r = planificarFacturas([inst("a", "fundador")], [], P, HOY, crearPlanes(catalogo));
    assert.equal(r.crear[0]!.monto, 58_000);
    assert.equal(planificarFacturas([inst("a", "fundador")], [], P, HOY).crear[0]!.monto, 54_000, "sin planes, los de lanzamiento");
  });

  it("respeta el día de cobro de la institución, y si ya pasó cobra hoy (no nace vencida)", () => {
    assert.equal(una(inst("a", "fundador", 25), []).crear[0]!.fechaCobro, "2026-10-25");
    assert.equal(una(inst("a", "fundador", 3), []).crear[0]!.fechaCobro, HOY);
  });

  it("acota el día de cobro al largo del mes", () => {
    assert.equal(una(inst("a", "fundador", 31), [], "2027-02", "2027-02-01").crear[0]!.fechaCobro, "2027-02-28");
  });

  it("no toca un mes que ya tiene factura, en cualquier estado", () => {
    for (const estado of ["pagada", "pendiente", "vencida"]) {
      const r = una(inst("a", "fundador"), [f("a", P, "fundador", estado)]);
      assert.equal(r.crear.length, 0, estado);
      assert.equal(r.omitidas[0]!.motivo, "ya_tiene", estado);
    }
  });

  it("plan anual: con una factura anual en la ventana (paga o por pagar) no genera otra", () => {
    for (const estado of ["pagada", "pendiente", "vencida"]) {
      const r = una(inst("a", "anual"), [f("a", "2026-05", "anual", estado)]);
      assert.equal(r.crear.length, 0, estado);
      assert.equal(r.omitidas[0]!.motivo, "anual_vigente", estado);
    }
  });

  it("plan anual: cuando la anterior salió de la ventana de 12 meses, genera la del año nuevo", () => {
    const r = una(inst("a", "anual"), [f("a", "2026-03", "fundador", "pagada")]);
    assert.equal(r.crear.length, 1);
    assert.equal(r.crear[0]!.plan, "anual");
    assert.equal(r.crear[0]!.monto, 720_000);
  });

  it("plan mensual: una anual paga que todavía cubre el mes evita el cobro; una impaga no", () => {
    const cubierta = una(inst("a", "fundador"), [f("a", "2026-06", "anual", "pagada")]);
    assert.deepEqual([cubierta.crear.length, cubierta.omitidas[0]!.motivo], [0, "cubierta_por_anual"]);
    assert.equal(una(inst("a", "fundador"), [f("a", "2026-06", "anual", "pendiente")]).crear.length, 1);
  });

  it("no factura un plan que no existe", () => {
    const r = una(inst("a", "inventado"), []);
    assert.deepEqual([r.crear.length, r.omitidas[0]!.motivo], [0, "plan_desconocido"]);
  });

  it("las facturas de una institución no afectan a otra", () => {
    const r = planificarFacturas([inst("a", "fundador"), inst("b", "fundador")], [f("a", P, "fundador", "pagada")], P, HOY);
    assert.deepEqual(r.crear.map((x) => x.institucionId), ["b"]);
    assert.deepEqual(r.omitidas.map((x) => x.institucionId), ["a"]);
  });
});
