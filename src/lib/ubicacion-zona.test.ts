import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consultaDeZona, desdeGeorefLocalidad, elegirZona, primeraZonaUbicada, type ZonaUbicada } from "./ubicacion-zona";

// Con la forma real de lo que devuelve https://apis.datos.gob.ar/georef/api/localidades (medida el 2026-11-12).
const LA_PLATA_CRUDA = {
  centroide: { lat: -34.9154959630273, lon: -57.9479884807815 },
  departamento: { id: "06441", nombre: "La Plata" },
  id: "0644103015",
  municipio: { id: "060441", nombre: "La Plata" },
  nombre: "La Plata",
  provincia: { id: "06", nombre: "Buenos Aires" },
};

const zona = (nombre: string, provincia: string): ZonaUbicada => ({ nombre, provincia, partido: null, lat: -34.9, lng: -57.9 });

describe("desdeGeorefLocalidad", () => {
  it("lee nombre, provincia, partido y punto central", () => {
    assert.deepEqual(desdeGeorefLocalidad(LA_PLATA_CRUDA), {
      nombre: "La Plata",
      provincia: "Buenos Aires",
      partido: "La Plata",
      lat: -34.9154959630273,
      lng: -57.9479884807815,
    });
  });

  it("sin departamento usa el municipio, y sin ninguno de los dos el partido queda en null", () => {
    const sinDepto = { ...LA_PLATA_CRUDA, departamento: undefined };
    assert.equal(desdeGeorefLocalidad(sinDepto)?.partido, "La Plata");
    assert.equal(desdeGeorefLocalidad({ ...sinDepto, municipio: undefined })?.partido, null);
  });

  it("descarta lo que no trae un punto, un nombre o una provincia", () => {
    assert.equal(desdeGeorefLocalidad({ ...LA_PLATA_CRUDA, centroide: undefined }), null);
    assert.equal(desdeGeorefLocalidad({ ...LA_PLATA_CRUDA, centroide: { lat: "x", lon: 1 } }), null);
    assert.equal(desdeGeorefLocalidad({ ...LA_PLATA_CRUDA, nombre: "  " }), null);
    assert.equal(desdeGeorefLocalidad({ ...LA_PLATA_CRUDA, provincia: undefined }), null);
    assert.equal(desdeGeorefLocalidad(null), null);
  });
});

describe("elegirZona", () => {
  const BA = new Set(["buenos aires", "ciudad autonoma de buenos aires"]);

  it("solo sirve un nombre igual al escrito: Georef también trae los parecidos", () => {
    const candidatas = [zona("Mar del Plata", "Buenos Aires"), zona("La Plata", "Buenos Aires"), zona("Cordón del Plata", "Mendoza")];
    assert.equal(elegirZona("la plata", candidatas, BA)?.nombre, "La Plata");
    assert.equal(elegirZona("Plata", candidatas, BA), null);
  });

  it("no mira tildes ni mayúsculas", () => {
    assert.equal(elegirZona("MARTINEZ", [zona("Martínez", "Buenos Aires")], BA)?.nombre, "Martínez");
  });

  it("dos iguales en la misma provincia (la localidad y su área) se resuelve con la primera", () => {
    const a = { ...zona("La Plata", "Buenos Aires"), lat: -34.91 };
    const b = { ...zona("La Plata", "Buenos Aires"), lat: -34.92 };
    assert.equal(elegirZona("La Plata", [a, b], BA), a);
  });

  it("con iguales en varias provincias prefiere donde la app ya tiene zonas", () => {
    const candidatas = [zona("San Martín", "Mendoza"), zona("San Martín", "Buenos Aires"), zona("San Martín", "Córdoba")];
    assert.equal(elegirZona("San Martín", candidatas, BA)?.provincia, "Buenos Aires");
  });

  it("si es ambiguo y ninguna es de una provincia conocida, no adivina", () => {
    const candidatas = [zona("San Martín", "Mendoza"), zona("San Martín", "Córdoba")];
    assert.equal(elegirZona("San Martín", candidatas, BA), null);
    assert.equal(elegirZona("San Martín", candidatas), null);
  });

  it("una sola en una provincia lejana sirve (no hay con qué confundirla)", () => {
    assert.equal(elegirZona("Ushuaia", [zona("Ushuaia", "Tierra del Fuego, Antártida e Islas del Atlántico Sur")], BA)?.nombre, "Ushuaia");
  });

  it("sin texto o sin candidatas no hay zona", () => {
    assert.equal(elegirZona("", [zona("La Plata", "Buenos Aires")], BA), null);
    assert.equal(elegirZona("La Plata", [], BA), null);
  });
});

describe("primeraZonaUbicada", () => {
  const OLIVOS = { lat: -34.5, lng: -58.5 };
  const LA_PLATA = { lat: -34.9, lng: -57.9 };
  const catalogo = (z: string) => (z === "Olivos" ? OLIVOS : null);

  it("respeta el orden: la primera zona manda aunque una de más abajo esté en el catálogo", async () => {
    const r = await primeraZonaUbicada(["La Plata", "Olivos"], catalogo, async (z) => (z === "La Plata" ? LA_PLATA : null));
    assert.deepEqual(r, LA_PLATA);
  });

  it("una zona del catálogo no consulta a Georef antes de ser la elegida", async () => {
    const consultadas: string[] = [];
    const r = await primeraZonaUbicada(["Olivos", "La Plata"], catalogo, async (z) => {
      consultadas.push(z);
      return LA_PLATA;
    });
    assert.deepEqual(r, OLIVOS);
    // Las zonas que el catálogo no conoce se consultan juntas; la del catálogo nunca.
    assert.deepEqual(consultadas, ["La Plata"]);
  });

  it("si la primera no se puede ubicar sigue con la siguiente", async () => {
    const r = await primeraZonaUbicada(["Lugar inventado", "La Plata"], catalogo, async (z) => (z === "La Plata" ? LA_PLATA : null));
    assert.deepEqual(r, LA_PLATA);
  });

  it("una consulta que falla cuenta como no ubicada, no rompe", async () => {
    const r = await primeraZonaUbicada(
      ["La Plata", "Olivos"],
      catalogo,
      async () => {
        throw new Error("sin red");
      },
    );
    assert.deepEqual(r, OLIVOS);
  });

  it("consulta como mucho a Georef por el máximo pedido", async () => {
    let consultas = 0;
    const r = await primeraZonaUbicada(
      ["A1", "B2", "C3", "D4"],
      () => null,
      async (z) => {
        consultas += 1;
        return z === "D4" ? LA_PLATA : null;
      },
      3,
    );
    assert.equal(consultas, 3);
    assert.equal(r, null);
  });

  it("sin zonas no hay punto", async () => {
    assert.equal(await primeraZonaUbicada([], catalogo, async () => LA_PLATA), null);
  });
});

describe("consultaDeZona", () => {
  it("limpia los espacios y acota el largo", () => {
    assert.equal(consultaDeZona("  La   Plata "), "La Plata");
    assert.equal(consultaDeZona("ab"), null);
    assert.equal(consultaDeZona("x".repeat(81)), null);
  });
});
