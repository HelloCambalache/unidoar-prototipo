import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aliasDeZonas,
  claveDeDireccion,
  coincidenPistas,
  desdeGeoref,
  desdeOsm,
  esCaba,
  firmarUbicacion,
  nombreDeCalle,
  ordenarPorPistas,
  separarDireccion,
  titulo,
  ubicacionDeInstitucion,
  verificarUbicacion,
  zonaDeUbicacion,
  type Ubicacion,
} from "./ubicacion";
import { buscarUbicacionesEn, ubicarEntrada } from "./ubicacion-busqueda";

/* Respuestas con la forma real de Georef (/direcciones) y de Nominatim (/search?addressdetails=1). */
const georef = (calle: string, valor: number, provincia: string, departamento: string, localidad: string, lat: number, lon: number) => ({
  altura: { unidad: null, valor },
  calle: { categoria: "AV", id: "x", nombre: calle },
  departamento: { id: "d", nombre: departamento },
  localidad_censal: { id: "l", nombre: localidad },
  nomenclatura: `${calle} ${valor}`,
  provincia: { id: "p", nombre: provincia },
  ubicacion: { lat, lon },
});
const MAIPU_BA = georef("AV MAIPU", 1234, "Buenos Aires", "Vicente López", "Vicente López", -34.5264, -58.48234);
const MAIPU_CORRIENTES = georef("AV MAIPU", 1234, "Corrientes", "Capital", "Corrientes", -27.48868, -58.8214);
const MAIPU_SANTA_FE = georef("AV MAIPU", 1234, "Santa Fe", "Iriondo", "Totoras", -32.58828, -61.16388);
const LIBERTADOR_CABA = georef("AV DEL LIBERTADOR", 4800, "Ciudad Autónoma de Buenos Aires", "Comuna 14", "Ciudad Autónoma de Buenos Aires", -34.56489, -58.43441);

const OSM_NORDELTA = {
  lat: "-34.41096",
  lon: "-58.66758",
  type: "tertiary",
  address: { road: "Avenida de los Lagos", city: "Nordelta", county: "Partido de Tigre", state: "Buenos Aires", country_code: "ar" },
};
const OSM_LIBERTADOR = {
  lat: "-34.56513",
  lon: "-58.43444",
  type: "house",
  address: { road: "Avenida Del Libertador", house_number: "4800", suburb: "Palermo", city: "Buenos Aires", county: "Comuna 14", state: "Ciudad Autónoma de Buenos Aires", country_code: "ar" },
};
const OSM_EQUIVOCADO = {
  lat: "-34.61821",
  lon: "-58.64921",
  address: { road: "Mar del Plata", city: "Villa Tesei", county: "Partido de Hurlingham", state: "Buenos Aires", country_code: "ar" },
};

describe("texto de direcciones", () => {
  it("pasa las calles de Georef (mayúsculas, sin tildes) a un formato legible", () => {
    assert.equal(titulo("AV DEL LIBERTADOR"), "Av. del Libertador");
    assert.equal(titulo("SAN MARTIN"), "San Martin");
    assert.equal(titulo("GRAL PAZ"), "Gral. Paz");
    assert.equal(titulo("  "), "");
  });

  it("reconoce a la Ciudad con cualquiera de sus nombres", () => {
    for (const n of ["CABA", "Capital Federal", "Ciudad Autónoma de Buenos Aires", "ciudad de buenos aires"]) assert.ok(esCaba(n), n);
    assert.ok(!esCaba("Buenos Aires"));
    assert.ok(!esCaba(null));
  });

  it("separa la calle de las pistas de lugar", () => {
    assert.deepEqual(separarDireccion("Av. Maipú 1234, Vicente López"), { calle: "Av. Maipú 1234", pistas: ["Vicente López"] });
    assert.deepEqual(separarDireccion("Av. de los Lagos 800, Nordelta, Tigre"), { calle: "Av. de los Lagos 800", pistas: ["Nordelta", "Tigre"] });
    assert.deepEqual(separarDireccion("Mitre 500"), { calle: "Mitre 500", pistas: [] });
    assert.deepEqual(separarDireccion(" ,, "), { calle: "", pistas: [] });
  });

  it("dos direcciones que solo difieren en tildes o mayúsculas son la misma", () => {
    assert.equal(claveDeDireccion("Av. Maipú 1234, Vicente López"), claveDeDireccion("av maipu 1234 vicente lopez"));
    assert.notEqual(claveDeDireccion("Av. Maipú 1234"), claveDeDireccion("Av. Maipú 1235"));
  });
});

describe("resultados de Georef y OpenStreetMap", () => {
  it("Georef: partido, provincia, altura y etiqueta", () => {
    const u = desdeGeoref(MAIPU_BA)!;
    assert.equal(u.partido, "Vicente López");
    assert.equal(u.provincia, "Buenos Aires");
    assert.equal(u.exacta, true);
    assert.equal(u.fuente, "georef");
    assert.equal(u.calle, "Av. Maipu 1234");
    assert.equal(u.etiqueta, "Av. Maipu 1234, Vicente López, Buenos Aires");
    assert.equal(u.lat, -34.5264);
  });

  it("Georef: la Ciudad queda como partido CABA (así lo usa el catálogo de zonas)", () => {
    const u = desdeGeoref(LIBERTADOR_CABA)!;
    assert.equal(u.partido, "CABA");
    assert.equal(u.provincia, "Ciudad Autónoma de Buenos Aires");
    assert.equal(u.etiqueta, "Av. del Libertador 4800, CABA");
  });

  it("Georef: descarta lo que no trae coordenadas o provincia", () => {
    assert.equal(desdeGeoref(null), null);
    assert.equal(desdeGeoref({ ...MAIPU_BA, ubicacion: { lat: null, lon: null } }), null);
    assert.equal(desdeGeoref({ ...MAIPU_BA, provincia: null }), null);
    assert.equal(desdeGeoref({ ...MAIPU_BA, altura: { valor: null } })!.exacta, false);
  });

  it("OpenStreetMap: quita «Partido de», toma la localidad y distingue calle de altura", () => {
    const n = desdeOsm(OSM_NORDELTA)!;
    assert.equal(n.partido, "Tigre");
    assert.equal(n.localidad, "Nordelta");
    assert.equal(n.exacta, false);
    assert.equal(n.etiqueta, "Avenida de los Lagos, Nordelta, Tigre, Buenos Aires");
    const l = desdeOsm(OSM_LIBERTADOR)!;
    assert.equal(l.partido, "CABA");
    assert.equal(l.exacta, true);
    assert.equal(l.calle, "Avenida Del Libertador 4800");
  });

  it("OpenStreetMap: ignora lo que no es una calle de Argentina", () => {
    assert.equal(desdeOsm({ lat: "1", lon: "2", address: { city: "Montevideo", state: "Montevideo", country_code: "uy" } }), null);
    assert.equal(desdeOsm({ lat: "1", lon: "2", address: { city: "Rosario", state: "Santa Fe", country_code: "ar" } }), null);
    assert.equal(desdeOsm({ lat: "x", lon: "2", address: { road: "Mitre", state: "Santa Fe", country_code: "ar" } }), null);
  });
});

describe("nombre de la calle", () => {
  it("se compara sin el tipo de calle ni la altura", () => {
    assert.equal(nombreDeCalle("Av. Maipú 1234"), "maipu");
    assert.equal(nombreDeCalle("Avenida del Libertador 4800"), "del libertador");
    assert.equal(nombreDeCalle("Calle 25 de Mayo 300"), "25 de mayo");
    assert.equal(nombreDeCalle("Mitre"), "mitre");
    assert.equal(nombreDeCalle(""), "");
  });
});

describe("pistas de lugar", () => {
  const lista = [MAIPU_CORRIENTES, MAIPU_SANTA_FE, MAIPU_BA].map((d) => desdeGeoref(d)!);

  it("las pistas coinciden con el partido, la localidad o la provincia", () => {
    const ba = lista[2]!;
    assert.ok(coincidenPistas(ba, ["Vicente López"]));
    assert.ok(coincidenPistas(ba, ["vicente lopez", "buenos aires"]));
    assert.ok(!coincidenPistas(ba, ["Vicente López", "Rosario"]));
    assert.ok(!coincidenPistas(ba, []));
    assert.ok(coincidenPistas(desdeGeoref(LIBERTADOR_CABA)!, ["CABA"]));
    assert.ok(coincidenPistas(desdeGeoref(LIBERTADOR_CABA)!, ["Capital Federal"]));
  });

  it("pone primero lo que coincide con lo escrito", () => {
    const ordenada = ordenarPorPistas(lista, ["Vicente López"]);
    assert.equal(ordenada[0]!.partido, "Vicente López");
    assert.equal(ordenada[0]!.coincide, true);
    assert.ok(ordenada.slice(1).every((u) => !u.coincide));
  });

  it("una pista que es una zona conocida coincide con el partido de esa zona", () => {
    const ba = lista[2]!;
    const alias = aliasDeZonas([{ nombre: "Olivos", partido: "Vicente López" }, { nombre: "Sin partido", partido: null }]);
    assert.ok(!coincidenPistas(ba, ["Olivos"]));
    assert.ok(coincidenPistas(ba, ["Olivos"], alias));
    assert.ok(coincidenPistas(ba, ["olivos", "Buenos Aires"], alias));
    assert.ok(!coincidenPistas(lista[0]!, ["Olivos"], alias));
    assert.equal(alias.size, 1);
  });

  it("sin pistas conserva el orden de la fuente", () => {
    assert.deepEqual(
      ordenarPorPistas(lista, []).map((u) => u.provincia),
      ["Corrientes", "Santa Fe", "Buenos Aires"],
    );
  });
});

describe("firma de la sugerencia elegida", () => {
  const ENTORNO = { SUPABASE_SERVICE_ROLE_KEY: "una-clave-de-servicio-larga-0123456789" };
  const u: Ubicacion = { ...desdeGeoref(MAIPU_BA)!, coincide: true };
  const ahora = 1_800_000_000_000;

  it("se acepta con la misma dirección (aunque cambien tildes o mayúsculas), la firma y a tiempo", () => {
    const token = firmarUbicacion(u, "Av. Maipú 1234, Vicente López", ENTORNO, ahora)!;
    assert.ok(token.includes("."));
    assert.deepEqual(verificarUbicacion(token, "av maipu 1234 vicente lopez", ENTORNO, ahora + 1000), u);
  });

  it("se rechaza si la dirección cambió, venció, o la firma o la clave no son las nuestras", () => {
    const token = firmarUbicacion(u, "Av. Maipú 1234, Vicente López", ENTORNO, ahora)!;
    assert.equal(verificarUbicacion(token, "Av. Maipú 1235, Vicente López", ENTORNO, ahora), null);
    assert.equal(verificarUbicacion(token, "Av. Maipú 1234, Vicente López", ENTORNO, ahora + 7 * 3_600_000), null);
    assert.equal(verificarUbicacion(token, "Av. Maipú 1234, Vicente López", { SUPABASE_SERVICE_ROLE_KEY: "otra-clave-de-servicio-0123456789" }, ahora), null);
    const [cuerpo] = token.split(".");
    assert.equal(verificarUbicacion(`${cuerpo}.${"A".repeat(43)}`, "Av. Maipú 1234, Vicente López", ENTORNO, ahora), null);
    assert.equal(verificarUbicacion(`${cuerpo}.x.y`, "Av. Maipú 1234, Vicente López", ENTORNO, ahora), null);
  });

  it("no se pueden forjar coordenadas: cambiar el contenido invalida la firma", () => {
    const token = firmarUbicacion(u, "Av. Maipú 1234, Vicente López", ENTORNO, ahora)!;
    const [cuerpo, firma] = token.split(".");
    const carga = JSON.parse(Buffer.from(cuerpo!, "base64url").toString());
    carga.u.lat = 0;
    const falso = `${Buffer.from(JSON.stringify(carga)).toString("base64url")}.${firma}`;
    assert.equal(verificarUbicacion(falso, "Av. Maipú 1234, Vicente López", ENTORNO, ahora), null);
  });

  it("sin clave del servidor o sin token no se firma ni se acepta nada", () => {
    assert.equal(firmarUbicacion(u, "x", {}, ahora), null);
    assert.equal(verificarUbicacion(null, "x", ENTORNO, ahora), null);
    assert.equal(verificarUbicacion("", "x", ENTORNO, ahora), null);
    assert.equal(verificarUbicacion("basura", "x", ENTORNO, ahora), null);
  });
});

describe("búsqueda de una dirección", () => {
  type Llamada = { host: string; params: Record<string, string> };
  function fetchFalso(respuestas: { georef?: unknown[][]; osm?: unknown[]; georefEstado?: number[] }) {
    const llamadas: Llamada[] = [];
    let g = 0;
    const impl = (async (url: URL) => {
      const u = new URL(url);
      llamadas.push({ host: u.host, params: Object.fromEntries(u.searchParams) });
      if (u.host.includes("datos.gob.ar")) {
        const estado = respuestas.georefEstado?.[g] ?? 200;
        const direcciones = respuestas.georef?.[g] ?? [];
        g += 1;
        return new Response(JSON.stringify({ direcciones }), { status: estado });
      }
      return new Response(JSON.stringify(respuestas.osm ?? []), { status: 200 });
    }) as unknown as typeof fetch;
    return { impl, llamadas };
  }

  it("con una pista de lugar ofrece solo lo que coincide y no consulta OpenStreetMap si Georef alcanzó", async () => {
    const { impl, llamadas } = fetchFalso({ georef: [[MAIPU_CORRIENTES, MAIPU_SANTA_FE, MAIPU_BA]] });
    const r = await buscarUbicacionesEn({ texto: "Av. Maipú 1234, Vicente López", osm: true }, { fetchImpl: impl });
    assert.equal(r.length, 1);
    assert.equal(r[0]!.partido, "Vicente López");
    assert.equal(r[0]!.coincide, true);
    assert.deepEqual(llamadas.map((l) => l.host), ["apis.datos.gob.ar"]);
    // A Georef se le pregunta solo por la calle y el número.
    assert.equal(llamadas[0]!.params.direccion, "Av. Maipú 1234");
  });

  it("sin pistas ofrece las opciones de distintos lugares para que la persona elija", async () => {
    const { impl } = fetchFalso({ georef: [[MAIPU_CORRIENTES, MAIPU_SANTA_FE, MAIPU_BA]] });
    const r = await buscarUbicacionesEn({ texto: "Av. Maipú 1234", osm: true }, { fetchImpl: impl });
    assert.equal(r.length, 3);
    assert.ok(r.every((u) => !u.coincide), "sin pistas ninguna cuenta como coincidencia: el servidor no la acepta sola");
  });

  it("si Georef no encuentra nada, prueba en OpenStreetMap con el texto completo", async () => {
    const { impl, llamadas } = fetchFalso({ georef: [[]], osm: [OSM_NORDELTA] });
    let esperas = 0;
    const r = await buscarUbicacionesEn(
      { texto: "Av. de los Lagos 800, Nordelta", osm: true },
      { fetchImpl: impl, esperarOsm: async () => void (esperas += 1) },
    );
    assert.equal(r.length, 1);
    assert.equal(r[0]!.fuente, "osm");
    assert.equal(r[0]!.partido, "Tigre");
    assert.equal(r[0]!.coincide, true);
    assert.equal(esperas, 1);
    // Georef se prueba con la pista como partido y sin filtros; recién después, OpenStreetMap.
    assert.deepEqual(llamadas.map((l) => l.host), ["apis.datos.gob.ar", "apis.datos.gob.ar", "nominatim.openstreetmap.org"]);
    assert.equal(llamadas[2]!.params.q, "Av. de los Lagos 800, Nordelta");
    assert.equal(llamadas[2]!.params.countrycodes, "ar");
  });

  it("con osm apagado (el domicilio de una persona) la dirección nunca sale hacia OpenStreetMap", async () => {
    const { impl, llamadas } = fetchFalso({ georef: [[]], osm: [OSM_NORDELTA] });
    const r = await buscarUbicacionesEn({ texto: "Av. de los Lagos 800, Nordelta", osm: false }, { fetchImpl: impl });
    assert.deepEqual(r, []);
    assert.ok(llamadas.every((l) => l.host === "apis.datos.gob.ar"));
  });

  it("descarta lo de OpenStreetMap que no coincide con lo escrito (el caso «Mitre 500, Mar del Plata»)", async () => {
    const { impl } = fetchFalso({ georef: [[]], osm: [OSM_EQUIVOCADO] });
    const r = await buscarUbicacionesEn({ texto: "Mitre 500, Mar del Plata", osm: true }, { fetchImpl: impl });
    assert.deepEqual(r, []);
  });

  it("acota por el partido ya cargado y, si Georef no lo conoce, reintenta con menos filtros", async () => {
    const { impl, llamadas } = fetchFalso({ georef: [[], [], [MAIPU_BA]], georefEstado: [400, 200, 200] });
    const r = await buscarUbicacionesEn({ texto: "Av. Maipú 1234", partido: "Vicente López", provincia: "Buenos Aires (provincia)", osm: false }, { fetchImpl: impl });
    assert.equal(r.length, 1);
    assert.equal(r[0]!.coincide, true, "el partido cargado cuenta como pista");
    assert.deepEqual(llamadas.map((l) => [l.params.provincia, l.params.departamento]), [
      ["Buenos Aires (provincia)", "Vicente López"],
      [undefined, "Vicente López"],
      [undefined, undefined],
    ]);
  });

  it("para la Ciudad acota por provincia y no por comuna", async () => {
    const { impl, llamadas } = fetchFalso({ georef: [[LIBERTADOR_CABA]] });
    const r = await buscarUbicacionesEn({ texto: "Av. del Libertador 4800", partido: "CABA", osm: false }, { fetchImpl: impl });
    assert.equal(r[0]!.partido, "CABA");
    assert.equal(llamadas[0]!.params.provincia, "Ciudad Autónoma de Buenos Aires");
    assert.equal(llamadas[0]!.params.departamento, undefined);
  });

  it("una zona conocida («Olivos») vale por su partido: Georef se consulta por Vicente López y el resultado coincide", async () => {
    const { impl, llamadas } = fetchFalso({ georef: [[MAIPU_BA]] });
    const zonas = [{ nombre: "Olivos", partido: "Vicente López" }, { nombre: "Nordelta", partido: "Tigre" }];
    const r = await buscarUbicacionesEn({ texto: "Av. Maipú 1234, Olivos", osm: false, zonas }, { fetchImpl: impl });
    assert.equal(r.length, 1);
    assert.equal(r[0]!.partido, "Vicente López");
    assert.equal(r[0]!.coincide, true);
    assert.equal(llamadas[0]!.params.departamento, "Vicente López");
  });

  it("sin esa zona en el catálogo, «Olivos» no coincide con un resultado de Vicente López", async () => {
    const { impl } = fetchFalso({ georef: [[MAIPU_BA], [MAIPU_BA]] });
    assert.deepEqual(await buscarUbicacionesEn({ texto: "Av. Maipú 1234, Olivos", osm: false }, { fetchImpl: impl }), []);
  });

  it("dos resultados con la misma etiqueta son una sola opción", async () => {
    const otraAltura = georef("AV MAIPU", 1234, "Buenos Aires", "Vicente López", "Vicente López", -34.5054, -58.4937);
    const { impl } = fetchFalso({ georef: [[MAIPU_BA, otraAltura]] });
    const r = await buscarUbicacionesEn({ texto: "Av. Maipú 1234, Vicente López", osm: false }, { fetchImpl: impl });
    assert.equal(r.length, 1);
    assert.equal(r[0]!.lat, -34.5264);
  });

  it("sin pistas, primero las provincias donde la app tiene zonas y después el resto del país", async () => {
    const { impl } = fetchFalso({ georef: [[MAIPU_CORRIENTES, MAIPU_SANTA_FE, MAIPU_BA]] });
    const zonas = [{ nombre: "Olivos", partido: "Vicente López", provincia: "Buenos Aires" }];
    const r = await buscarUbicacionesEn({ texto: "Av. Maipú 1234", osm: false, zonas }, { fetchImpl: impl });
    assert.deepEqual(r.map((u) => u.provincia), ["Buenos Aires", "Corrientes", "Santa Fe"]);
    assert.ok(r.every((u) => !u.coincide));
  });

  it("entre varios resultados que coinciden, primero el de la calle escrita y no una parecida", async () => {
    const parecida = georef("REMEDIOS ESCALADA DE SAN MARTIN", 1500, "Buenos Aires", "Vicente López", "Vicente López", -34.5265, -58.48);
    const igual = georef("SAN MARTIN", 1500, "Buenos Aires", "Vicente López", "Vicente López", -34.52, -58.47);
    const { impl } = fetchFalso({ georef: [[parecida, igual]] });
    const r = await buscarUbicacionesEn({ texto: "San Martín 1500, Vicente López", osm: false }, { fetchImpl: impl });
    assert.equal(r[0]!.calle, "San Martin 1500");
  });

  it("textos muy cortos no consultan a nadie, y una caída de la red no rompe nada", async () => {
    const { impl, llamadas } = fetchFalso({});
    assert.deepEqual(await buscarUbicacionesEn({ texto: "Av", osm: true }, { fetchImpl: impl }), []);
    assert.equal(llamadas.length, 0);
    const caido = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    assert.deepEqual(await buscarUbicacionesEn({ texto: "Av. Maipú 1234, Vicente López", osm: true }, { fetchImpl: caido }), []);
  });

  it("no repite el mismo lugar si lo traen dos resultados y ofrece como mucho cinco", async () => {
    const parecidos = Array.from({ length: 8 }, (_, i) => georef("AV MAIPU", 1234 + i, "Buenos Aires", "Vicente López", "Vicente López", -34.5264 - i * 0.01, -58.48234));
    const { impl } = fetchFalso({ georef: [[...parecidos, MAIPU_BA, MAIPU_BA]] });
    const r = await buscarUbicacionesEn({ texto: "Av. Maipú 1234, Vicente López", osm: false }, { fetchImpl: impl });
    assert.equal(r.length, 5);
    assert.equal(new Set(r.map((u) => `${u.lat}|${u.lng}`)).size, 5);
  });
});

describe("ubicación al guardar un formulario", () => {
  const ENTORNO = { SUPABASE_SERVICE_ROLE_KEY: "una-clave-de-servicio-larga-0123456789" };
  const ahora = 1_800_000_000_000;
  const vicenteLopez: Ubicacion = { ...desdeGeoref(MAIPU_BA)!, coincide: true };
  const corrientes: Ubicacion = { ...desdeGeoref(MAIPU_CORRIENTES)!, coincide: false };

  const buscadorQueDevuelve = (lista: Ubicacion[]) => {
    const pedidos: unknown[] = [];
    return { pedidos, buscar: async (p: unknown) => (pedidos.push(p), lista) };
  };

  it("acepta la sugerencia firmada sin volver a buscar", async () => {
    const token = firmarUbicacion(vicenteLopez, "Av. Maipú 1234", ENTORNO, ahora)!;
    const { buscar, pedidos } = buscadorQueDevuelve([]);
    const u = await ubicarEntrada({ direccion: "Av. Maipú 1234", partido: "Vicente López", token, osm: true }, buscar, ENTORNO, ahora);
    assert.deepEqual(u, vicenteLopez);
    assert.equal(pedidos.length, 0);
  });

  it("no acepta una firma de otra dirección: busca por su cuenta", async () => {
    const token = firmarUbicacion(vicenteLopez, "Av. Maipú 1234", ENTORNO, ahora)!;
    const { buscar, pedidos } = buscadorQueDevuelve([]);
    const u = await ubicarEntrada({ direccion: "Av. Maipú 9999", partido: "Vicente López", token, osm: true }, buscar, ENTORNO, ahora);
    assert.equal(u, null);
    assert.equal(pedidos.length, 1);
  });

  it("si la persona cambió el partido a mano y contradice la sugerencia, la firma no vale", async () => {
    const token = firmarUbicacion(corrientes, "Av. Maipú 1234", ENTORNO, ahora)!;
    const { buscar } = buscadorQueDevuelve([vicenteLopez]);
    const u = await ubicarEntrada({ direccion: "Av. Maipú 1234", partido: "Vicente López", token, osm: true }, buscar, ENTORNO, ahora);
    assert.equal(u?.partido, "Vicente López", "se usó lo que encontró el servidor, no las coordenadas de Corrientes");
  });

  it("sin firma toma el primer resultado que coincide y nunca uno que solo se parece", async () => {
    const { buscar } = buscadorQueDevuelve([corrientes, vicenteLopez]);
    const u = await ubicarEntrada({ direccion: "Av. Maipú 1234", partido: "Vicente López", osm: false }, buscar, ENTORNO, ahora);
    assert.equal(u?.partido, "Vicente López");
    assert.equal(await ubicarEntrada({ direccion: "Av. Maipú 1234", osm: true }, buscadorQueDevuelve([corrientes]).buscar, ENTORNO, ahora), null);
  });

  it("le pasa a la búsqueda el partido cargado y si puede usar OpenStreetMap", async () => {
    const { buscar, pedidos } = buscadorQueDevuelve([]);
    await ubicarEntrada({ direccion: " Av. Maipú 1234 ", partido: " Vicente López ", provincia: "Buenos Aires", osm: false }, buscar, ENTORNO, ahora);
    assert.deepEqual(pedidos, [{ texto: "Av. Maipú 1234", partido: "Vicente López", provincia: "Buenos Aires", osm: false }]);
  });

  it("una dirección vacía o muy corta no busca nada", async () => {
    const { buscar, pedidos } = buscadorQueDevuelve([vicenteLopez]);
    assert.equal(await ubicarEntrada({ direccion: "   ", osm: true }, buscar, ENTORNO, ahora), null);
    assert.equal(await ubicarEntrada({ direccion: "Av", osm: true }, buscar, ENTORNO, ahora), null);
    assert.equal(pedidos.length, 0);
  });
});

describe("zona de la institución", () => {
  const ba = desdeGeoref(georef("AV MAIPU", 1234, "Buenos Aires", "Vicente López", "Villa Adelina", -34.5, -58.5))!;
  const caba = desdeGeoref(LIBERTADOR_CABA)!;

  it("arma «localidad, partido» y, si la localidad es el mismo partido o la Ciudad, solo el partido", () => {
    assert.equal(zonaDeUbicacion(ba), "Villa Adelina, Vicente López");
    assert.equal(zonaDeUbicacion(desdeGeoref(MAIPU_BA)!), "Vicente López");
    assert.equal(zonaDeUbicacion(caba), "CABA");
    assert.equal(zonaDeUbicacion(desdeOsm(OSM_LIBERTADOR)!), "Palermo, CABA");
  });

  it("usa las coordenadas de la dirección y la zona del catálogo si salió de una zona conocida", () => {
    const catalogo = { zona: "Olivos, Vicente López", lat: -34.51, lng: -58.49, enCatalogo: true };
    assert.deepEqual(ubicacionDeInstitucion(catalogo, ba), { zona: "Olivos, Vicente López", lat: -34.5, lng: -58.5 });
  });

  it("si el catálogo solo conocía el partido, toma la localidad de la dirección", () => {
    const catalogo = { zona: "Vicente López", lat: -34.51, lng: -58.49, enCatalogo: false };
    assert.deepEqual(ubicacionDeInstitucion(catalogo, ba), { zona: "Villa Adelina, Vicente López", lat: -34.5, lng: -58.5 });
  });

  it("sin dirección ubicada queda lo del catálogo, como antes", () => {
    const catalogo = { zona: "Tigre", lat: null, lng: null, enCatalogo: false };
    assert.deepEqual(ubicacionDeInstitucion(catalogo, null), { zona: "Tigre", lat: null, lng: null });
  });
});
