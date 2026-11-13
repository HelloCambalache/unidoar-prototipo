import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CABECERA_NO_INDEXAR, RUTAS_PROHIBIDAS_A_ROBOTS, debeNoIndexarse, urlAbsoluta, urlDelSitio } from "./indexacion";
import { MANUALES } from "./ayuda";
import { PAGINAS } from "./seo";
import { rutasFijasDelSitemap } from "./sitemap";

describe("debeNoIndexarse", () => {
  it("las áreas con cuenta no se indexan, con cualquier subruta", () => {
    for (const ruta of ["/docente", "/docente/oportunidades", "/institucion/postulantes", "/backoffice", "/backoffice/ayuda/x", "/app/docente"]) {
      assert.equal(debeNoIndexarse(ruta), true, ruta);
    }
  });

  it("el ingreso, las invitaciones, la confirmación y las pantallas de paso no se indexan", () => {
    for (const ruta of ["/ingresar", "/ingresar/recuperar", "/ingresar/nueva-contrasena", "/invitacion/abc", "/auth/confirmar", "/referido/ABCD1234", "/inicio", "/cuenta-suspendida", "/cuenta-del-equipo"]) {
      assert.equal(debeNoIndexarse(ruta), true, ruta);
    }
  });

  it("los pasos del alta no se indexan, salvo el primero (el registro, que tiene su página para buscadores)", () => {
    assert.equal(debeNoIndexarse("/onboarding/docente/1"), false);
    assert.equal(debeNoIndexarse("/onboarding/institucion/1"), false);
    assert.equal(debeNoIndexarse("/onboarding/docente/2"), true);
    assert.equal(debeNoIndexarse("/onboarding/docente/categoria"), true);
    assert.equal(debeNoIndexarse("/onboarding/institucion/3"), true);
  });

  it("lo público se indexa", () => {
    for (const ruta of ["/", "/buscar-trabajo", "/instituciones", "/instituciones/colegio-x", "/ofertas/123", "/planes", "/categorias", "/educadores", "/registro", "/contacto", "/ayuda/profesionales", "/terminos"]) {
      assert.equal(debeNoIndexarse(ruta), false, ruta);
    }
  });

  it("no confunde un prefijo parecido con un área privada", () => {
    assert.equal(debeNoIndexarse("/docentes-recomendados"), false);
    assert.equal(debeNoIndexarse("/institucionales"), false);
    assert.equal(debeNoIndexarse("/ingresarse"), false);
  });

  it("la cabecera dice noindex", () => {
    assert.match(CABECERA_NO_INDEXAR, /noindex/);
  });
});

describe("robots.txt", () => {
  it("no prohíbe nada de lo que necesita una vista previa de WhatsApp, Facebook o LinkedIn", () => {
    // Un enlace compartido a un área con cuenta llega al ingreso y una imagen de vista previa sale de /og: ninguna puede estar prohibida.
    for (const ruta of ["/ingresar", "/docente/oportunidades", "/institucion/buscar-docentes", "/og/docentes.png", "/ofertas/1", "/instituciones/x", "/profesional/token"]) {
      assert.equal(
        RUTAS_PROHIBIDAS_A_ROBOTS.some((p) => ruta.startsWith(p)),
        false,
        ruta,
      );
    }
  });
});

describe("urlDelSitio y urlAbsoluta", () => {
  it("usa la variable del sitio y se queda con el origen", () => {
    assert.equal(urlDelSitio("https://www.unidoar.com.ar/"), "https://www.unidoar.com.ar");
    assert.equal(urlDelSitio("https://www.unidoar.com.ar/algo?x=1"), "https://www.unidoar.com.ar");
  });

  it("sin variable, o con una inválida, cae en la de producción y nunca lanza", () => {
    assert.equal(urlDelSitio(undefined), "https://www.unidoar.com.ar");
    assert.equal(urlDelSitio(""), "https://www.unidoar.com.ar");
    assert.equal(urlDelSitio("esto no es una dirección"), "https://www.unidoar.com.ar");
  });

  it("arma la dirección completa de una ruta", () => {
    assert.equal(urlAbsoluta("/planes", "https://www.unidoar.com.ar"), "https://www.unidoar.com.ar/planes");
    assert.equal(urlAbsoluta("/", "https://www.unidoar.com.ar"), "https://www.unidoar.com.ar/");
    assert.equal(urlAbsoluta("/ofertas/abc-123", "https://www.unidoar.com.ar"), "https://www.unidoar.com.ar/ofertas/abc-123");
  });
});

describe("rutasFijasDelSitemap", () => {
  const rutas = rutasFijasDelSitemap();

  it("incluye las páginas públicas principales", () => {
    for (const ruta of ["/", "/buscar-trabajo", "/instituciones", "/planes", "/categorias", "/educadores", "/entrenadores", "/guardavidas", "/contacto", "/quienes-somos", "/registro", "/ayuda", "/terminos", "/privacidad"]) {
      assert.ok(rutas.includes(ruta), `falta ${ruta}`);
    }
  });

  it("incluye el registro de profesionales y de instituciones, que cuelgan de /onboarding", () => {
    assert.ok(rutas.includes("/onboarding/docente/1"));
    assert.ok(rutas.includes("/onboarding/institucion/1"));
  });

  it("no incluye nada que no se indexe (ingreso, áreas con cuenta)", () => {
    assert.ok(!rutas.includes("/ingresar"));
    for (const ruta of rutas) assert.equal(debeNoIndexarse(ruta), false, ruta);
  });

  it("no repite rutas y todas empiezan con barra", () => {
    assert.equal(new Set(rutas).size, rutas.length);
    for (const ruta of rutas) assert.match(ruta, /^\//);
  });

  it("suma las guías de los manuales públicos y nunca las del equipo", () => {
    assert.ok(rutas.some((r) => r.startsWith("/ayuda/profesionales/")));
    assert.ok(rutas.some((r) => r.startsWith("/ayuda/instituciones/")));
    assert.ok(!rutas.some((r) => r.includes("/backoffice")));
    assert.ok(MANUALES.equipo.capitulos.length > 0);
  });

  it("cada ruta fija existe como página del sitio", () => {
    const base = join(process.cwd(), "src", "app");
    const existe = (ruta: string) => {
      const partes = ruta.split("/").filter(Boolean);
      // Una página puede estar en la raíz, dentro del grupo (publico) o con un segmento dinámico ([perfil], [articulo]).
      const buscar = (dir: string, i: number): boolean => {
        if (i === partes.length) return existsSync(join(dir, "page.tsx"));
        const directo = join(dir, partes[i]);
        if (existsSync(directo) && buscar(directo, i + 1)) return true;
        for (const grupo of ["(publico)"]) {
          const g = join(dir, grupo, partes[i]);
          if (i === 0 && existsSync(g) && buscar(g, i + 1)) return true;
        }
        for (const dinamico of ["[perfil]", "[articulo]", "[id]", "[slug]"]) {
          const d = join(dir, dinamico);
          if (existsSync(d) && buscar(d, i + 1)) return true;
        }
        return false;
      };
      if (partes.length === 0) return existsSync(join(base, "(publico)", "page.tsx")) || existsSync(join(base, "page.tsx"));
      return buscar(base, 0);
    };
    for (const ruta of rutas) assert.ok(existe(ruta), `no hay página para ${ruta}`);
    assert.ok(Object.values(PAGINAS).length > 0);
  });
});
