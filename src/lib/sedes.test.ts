import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aSedePublica,
  cambiosDeSedes,
  espejoDePrincipal,
  huellaDeSedes,
  MAX_SEDES,
  MAX_SEDES_POR_PUBLICACION,
  nombreVisibleDeSede,
  numerarSedes,
  ordenarSedes,
  puedeQuitarSede,
  puntosDeReferencia,
  resumenDeSedes,
  sedeMasCercana,
  sedeParaMedir,
  sedePrincipal,
  sedesElegidas,
  sedesEntradaSchema,
  validarSedes,
} from "@/lib/sedes";

const sede = (nombre: string, extra: Partial<{ esPrincipal: boolean; lat: number | null; lng: number | null }> = {}) => ({
  id: nombre,
  nombre,
  esPrincipal: false,
  lat: null as number | null,
  lng: null as number | null,
  ...extra,
});

// Puntos reales del conurbano norte: Olivos y Pilar están a unos 40 km; San Isidro queda entre ambas, cerca de Olivos.
const OLIVOS = { lat: -34.5085, lng: -58.4966 };
const SAN_ISIDRO = { lat: -34.4708, lng: -58.5286 };
const PILAR = { lat: -34.4587, lng: -58.9142 };

describe("orden y sede principal", () => {
  it("la principal va primero y el resto por nombre, sin importar tildes ni mayúsculas", () => {
    const lista = [sede("Pilar"), sede("Álvarez"), sede("Olivos", { esPrincipal: true }), sede("belgrano")];
    assert.deepEqual(ordenarSedes(lista).map((s) => s.nombre), ["Olivos", "Álvarez", "belgrano", "Pilar"]);
  });

  it("no modifica la lista original", () => {
    const lista = [sede("B"), sede("A", { esPrincipal: true })];
    ordenarSedes(lista);
    assert.deepEqual(lista.map((s) => s.nombre), ["B", "A"]);
  });

  it("la principal es la marcada; sin marca, la primera; sin sedes, nada", () => {
    assert.equal(sedePrincipal([sede("A"), sede("B", { esPrincipal: true })])?.nombre, "B");
    assert.equal(sedePrincipal([sede("A"), sede("B")])?.nombre, "A");
    assert.equal(sedePrincipal([]), null);
  });
});

describe("sede más cercana", () => {
  const sedes = [sede("Olivos", { ...OLIVOS, esPrincipal: true }), sede("Pilar", PILAR), sede("Sin ubicar")];

  it("elige la más cercana al punto, ignorando las que no tienen coordenadas", () => {
    assert.equal(sedeMasCercana(SAN_ISIDRO, sedes)?.sede.nombre, "Olivos");
    assert.equal(sedeMasCercana({ lat: -34.46, lng: -58.85 }, sedes)?.sede.nombre, "Pilar");
  });

  it("devuelve los kilómetros a esa sede", () => {
    const r = sedeMasCercana(SAN_ISIDRO, sedes);
    assert.ok(r && r.km > 2 && r.km < 6, String(r?.km));
  });

  it("sin punto de referencia o sin sedes ubicadas devuelve null", () => {
    assert.equal(sedeMasCercana(null, sedes), null);
    assert.equal(sedeMasCercana({ lat: null, lng: -58 }, sedes), null);
    assert.equal(sedeMasCercana(SAN_ISIDRO, [sede("A"), sede("B")]), null);
    assert.equal(sedeMasCercana(SAN_ISIDRO, []), null);
  });
});

describe("lo que se publica de una sede", () => {
  it("lleva nombre, dirección, zona y ubicación, y nunca el CUE ni el id", () => {
    const completa = { id: "x", nombre: "Pilar", direccion: "Ruta 8", zona: "Pilar", lat: 1, lng: 2, cue: "0600123/00", esPrincipal: false, partido: "Pilar", provincia: "BA" };
    const publica = aSedePublica(completa);
    assert.deepEqual(Object.keys(publica).sort(), ["direccion", "lat", "lng", "nombre", "zona"]);
    assert.ok(!JSON.stringify(publica).includes("0600123"));
  });
});

describe("desde dónde se mide la cercanía de los profesionales", () => {
  const olivos = { id: "a", nombre: "Olivos", ...OLIVOS };
  const pilar = { id: "b", nombre: "Pilar", ...PILAR };
  const sinUbicar = { id: "c", nombre: "Sin ubicar", lat: null, lng: null };

  it("con una búsqueda elegida, solo desde su sede", () => {
    assert.deepEqual(puntosDeReferencia([olivos, pilar], "b"), [{ nombre: "Pilar", ...PILAR }]);
  });

  it("sin búsqueda, desde todas las sedes ubicadas", () => {
    assert.deepEqual(puntosDeReferencia([olivos, pilar, sinUbicar], null).map((p) => p.nombre), ["Olivos", "Pilar"]);
  });

  it("si la sede de la búsqueda no está ubicada, no mide nada (no cae en otra sede)", () => {
    assert.deepEqual(puntosDeReferencia([olivos, sinUbicar], "c"), []);
  });

  it("una sede que ya no existe se trata como sin búsqueda", () => {
    assert.deepEqual(puntosDeReferencia([olivos], "borrada").map((p) => p.nombre), ["Olivos"]);
  });

  it("solo una institución sin ninguna sede usa de respaldo su propia ubicación", () => {
    assert.deepEqual(puntosDeReferencia([], null, { nombre: "Institución", ...OLIVOS }), [{ nombre: "Institución", ...OLIVOS }]);
    assert.deepEqual(puntosDeReferencia([sinUbicar], null, { nombre: "Institución", ...OLIVOS }), []);
    assert.deepEqual(puntosDeReferencia([], null, null), []);
  });
});

describe("qué sede se usa para medir", () => {
  const sedes = [sede("Olivos", { esPrincipal: true }), sede("Pilar")];
  it("la de la búsqueda; si no tiene, la principal", () => {
    assert.equal(sedeParaMedir(sedes, sedes[1])?.nombre, "Pilar");
    assert.equal(sedeParaMedir(sedes, null)?.nombre, "Olivos");
    assert.equal(sedeParaMedir(sedes, undefined)?.nombre, "Olivos");
    assert.equal(sedeParaMedir([], null), null);
  });
});

describe("cómo se nombran", () => {
  it("con una sola sede no se dice nada; con varias, cuántas son", () => {
    assert.equal(resumenDeSedes([sede("A")]), null);
    assert.equal(resumenDeSedes([]), null);
    assert.equal(resumenDeSedes([sede("A"), sede("B")]), "2 sedes");
    assert.equal(resumenDeSedes([sede("A"), sede("B"), sede("C")]), "3 sedes");
  });

  it("el nombre de la sede solo se muestra si hay más de una", () => {
    assert.equal(nombreVisibleDeSede({ nombre: "Pilar" }, 1), null);
    assert.equal(nombreVisibleDeSede({ nombre: "Pilar" }, 2), "Pilar");
  });

  it("el espejo de la principal lleva exactamente lo que guarda la ficha de la institución", () => {
    const espejo = espejoDePrincipal({
      direccion: "Av. Maipú 1",
      partido: "Vicente López",
      provincia: "Buenos Aires",
      zona: "Olivos, Vicente López",
      lat: 1,
      lng: 2,
      cue: "0600123/00",
    });
    assert.deepEqual(Object.keys(espejo).sort(), ["cue", "direccion", "lat", "lng", "partido", "provincia", "zona"]);
    assert.equal(espejo.cue, "0600123/00");
  });
});

describe("validar la lista de sedes", () => {
  const ok = [
    { nombre: "Olivos", esPrincipal: true },
    { nombre: "Pilar", esPrincipal: false },
  ];

  it("acepta una lista correcta, también con una sola sede", () => {
    assert.equal(validarSedes(ok), null);
    assert.equal(validarSedes([{ nombre: "Sede principal", esPrincipal: true }]), null);
  });

  it("exige al menos una y no más del tope", () => {
    assert.ok(validarSedes([])?.error.includes("al menos una"));
    const muchas = Array.from({ length: MAX_SEDES + 1 }, (_, i) => ({ nombre: `Sede ${i}`, esPrincipal: i === 0 }));
    assert.ok(validarSedes(muchas)?.error.includes(String(MAX_SEDES)));
    assert.equal(validarSedes(muchas.slice(0, MAX_SEDES)), null);
  });

  it("pide un nombre de 2 a 60 caracteres y marca cuál sede falla", () => {
    const r = validarSedes([
      { nombre: "Olivos", esPrincipal: true },
      { nombre: " A ", esPrincipal: false },
      { nombre: "x".repeat(61), esPrincipal: false },
    ]);
    assert.ok(r);
    assert.deepEqual(Object.keys(r.campos).sort(), ["sedes.1.nombre", "sedes.2.nombre"]);
  });

  it("no deja dos sedes con el mismo nombre (sin distinguir mayúsculas ni tildes)", () => {
    const r = validarSedes([
      { nombre: "Álvarez", esPrincipal: true },
      { nombre: "alvarez ", esPrincipal: false },
    ]);
    assert.ok(r);
    assert.deepEqual(Object.keys(r.campos), ["sedes.1.nombre"]);
  });

  it("exige exactamente una principal", () => {
    assert.ok(validarSedes([{ nombre: "A1", esPrincipal: false }, { nombre: "B1", esPrincipal: false }])?.error.includes("exactamente una"));
    assert.ok(validarSedes([{ nombre: "A1", esPrincipal: true }, { nombre: "B1", esPrincipal: true }])?.error.includes("exactamente una"));
  });
});

describe("quitar una sede", () => {
  it("no se quita la principal", () => {
    assert.equal(puedeQuitarSede({ esPrincipal: true }, 0).ok, false);
  });

  it("no se quita una con búsquedas abiertas, y el mensaje cuenta cuántas", () => {
    const una = puedeQuitarSede({ esPrincipal: false }, 1);
    const varias = puedeQuitarSede({ esPrincipal: false }, 3);
    assert.ok(!una.ok && una.error.includes("una búsqueda abierta"));
    assert.ok(!varias.ok && varias.error.includes("3 búsquedas abiertas"));
  });

  it("sin búsquedas abiertas se puede", () => {
    assert.deepEqual(puedeQuitarSede({ esPrincipal: false }, 0), { ok: true });
  });
});

describe("lo que manda el editor de sedes", () => {
  const valida = { nombre: "Olivos", direccion: "Av. Maipú 1234", zona: "Olivos, Vicente López", esPrincipal: true };

  it("acepta una sede completa y recorta los espacios", () => {
    const r = sedesEntradaSchema.parse({ sedes: [{ ...valida, direccion: "  Av. Maipú 1234  ", zona: " Olivos " }] });
    assert.equal(r.sedes[0]?.direccion, "Av. Maipú 1234");
    assert.equal(r.sedes[0]?.zona, "Olivos");
  });

  it("pide la dirección y no acepta ids que no sean uuid", () => {
    assert.equal(sedesEntradaSchema.safeParse({ sedes: [{ ...valida, direccion: "ab" }] }).success, false);
    assert.equal(sedesEntradaSchema.safeParse({ sedes: [{ ...valida, id: "no-es-uuid" }] }).success, false);
    assert.equal(sedesEntradaSchema.safeParse({ sedes: [{ ...valida, id: "0d9f1d3e-6f0a-4b6b-9a52-0f6a8a4b3c11" }] }).success, true);
  });

  it("exige entre una y MAX_SEDES sedes", () => {
    assert.equal(sedesEntradaSchema.safeParse({ sedes: [] }).success, false);
    assert.equal(sedesEntradaSchema.safeParse({ sedes: Array.from({ length: MAX_SEDES + 1 }, () => valida) }).success, false);
  });
});

describe("qué cambió en las sedes (para la actividad del equipo)", () => {
  const A = "0d9f1d3e-6f0a-4b6b-9a52-0f6a8a4b3c11";
  const B = "1e8a2e4f-7a1b-4c7c-8b63-1a7b9b5c4d22";
  const olivos = { id: A, nombre: "Olivos", direccion: "Av. Maipú 1", zona: "Olivos", cue: null, esPrincipal: true };
  const pilar = { id: B, nombre: "Pilar", direccion: "Ruta 8 km 50", zona: "Pilar", cue: null, esPrincipal: false };

  it("no anota nada si no se tocó nada, ni por espacios de más", () => {
    assert.deepEqual(cambiosDeSedes([olivos, pilar], [olivos, { ...pilar, nombre: " Pilar " }]), []);
  });

  it("anota solo los nombres de lo que cambió, nunca los valores", () => {
    const r = cambiosDeSedes([olivos, pilar], [{ ...olivos, direccion: "Av. Maipú 999" }, { ...pilar, zona: "Pilar, Pilar", cue: "0600123/00" }]);
    assert.deepEqual(r, ["dirección de sede", "zona de sede", "CUE de sede"]);
    assert.ok(!r.join(" ").includes("999"));
  });

  it("distingue agregar, quitar y cambiar de principal", () => {
    assert.deepEqual(cambiosDeSedes([olivos], [olivos, { nombre: "Nueva", direccion: "X 123", zona: "", cue: null, esPrincipal: false }]), ["sedes agregadas"]);
    assert.deepEqual(cambiosDeSedes([olivos, pilar], [olivos]), ["sedes quitadas"]);
    assert.deepEqual(cambiosDeSedes([olivos, pilar], [{ ...olivos, esPrincipal: false }, { ...pilar, esPrincipal: true }]), ["sede principal"]);
  });

  it("un id que no existía se trata como sede nueva", () => {
    assert.deepEqual(cambiosDeSedes([olivos], [olivos, { ...pilar, id: "2f9b3f50-8b2c-4d8d-9c74-2b8c0c6d5e33" }]), ["sedes agregadas"]);
  });
});

describe("huella de las sedes (detecta que otra persona las cambió mientras tanto)", () => {
  const s = (id: string, extra: Partial<{ nombre: string; direccion: string | null; zona: string | null; cue: string | null; esPrincipal: boolean }> = {}) => ({
    id,
    nombre: "Sede",
    direccion: "Calle 1",
    zona: "Olivos",
    cue: null as string | null,
    esPrincipal: false,
    ...extra,
  });

  it("es la misma sin importar el orden ni los espacios de más", () => {
    const a = huellaDeSedes([s("a", { esPrincipal: true }), s("b")], { conCue: false });
    const b = huellaDeSedes([s("b", { nombre: " Sede " }), s("a", { esPrincipal: true, direccion: "Calle 1 " })], { conCue: false });
    assert.equal(a, b);
  });

  it("cambia si cambia el nombre, la dirección, la zona, cuál es la principal o si se suma o se quita una sede", () => {
    const base = huellaDeSedes([s("a", { esPrincipal: true }), s("b")], { conCue: false });
    assert.notEqual(huellaDeSedes([s("a", { esPrincipal: true, nombre: "Otra" }), s("b")], { conCue: false }), base);
    assert.notEqual(huellaDeSedes([s("a", { esPrincipal: true, direccion: "Calle 2" }), s("b")], { conCue: false }), base);
    assert.notEqual(huellaDeSedes([s("a", { esPrincipal: true, zona: "Pilar" }), s("b")], { conCue: false }), base);
    assert.notEqual(huellaDeSedes([s("a"), s("b", { esPrincipal: true })], { conCue: false }), base);
    assert.notEqual(huellaDeSedes([s("a", { esPrincipal: true })], { conCue: false }), base);
    assert.notEqual(huellaDeSedes([s("a", { esPrincipal: true }), s("b"), s("c")], { conCue: false }), base);
  });

  it("el CUE cuenta solo para quien puede cargarlo (si no, un cambio del equipo falsearía un conflicto a la institución)", () => {
    const sin = [s("a", { esPrincipal: true })];
    const con = [s("a", { esPrincipal: true, cue: "600123" })];
    assert.equal(huellaDeSedes(sin, { conCue: false }), huellaDeSedes(con, { conCue: false }));
    assert.notEqual(huellaDeSedes(sin, { conCue: true }), huellaDeSedes(con, { conCue: true }));
  });

  it("las sedes sin id (la que se ofrece cuando todavía no hay ninguna guardada) no cuentan", () => {
    assert.equal(huellaDeSedes([{ ...s("x"), id: undefined }], { conCue: false }), huellaDeSedes([], { conCue: false }));
  });

  it("numera las sedes: la principal es la 1 y después por nombre", () => {
    const lista = [
      { nombre: "Pilar", esPrincipal: false },
      { nombre: "Olivos", esPrincipal: true },
      { nombre: "Belgrano", esPrincipal: false },
    ];
    assert.deepEqual(
      numerarSedes(lista).map((s) => `${s.numero} ${s.nombre}`),
      ["1 Olivos", "2 Belgrano", "3 Pilar"],
    );
  });

  it("valida las sedes elegidas al publicar en varias", () => {
    const propias = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(sedesElegidas(["c", "a", "a"], propias), { ok: true, sedes: [{ id: "a" }, { id: "c" }] });
    assert.equal(sedesElegidas([], propias).ok, false);
    assert.equal(sedesElegidas(["", ""], propias).ok, false);
    const ajena = sedesElegidas(["a", "z"], propias);
    assert.ok(!ajena.ok && /de la lista/.test(ajena.error));
    const muchas = Array.from({ length: MAX_SEDES_POR_PUBLICACION + 1 }, (_, i) => ({ id: `s${i}` }));
    assert.equal(sedesElegidas(muchas.map((s) => s.id), muchas).ok, false);
  });
});
