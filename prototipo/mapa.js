/* Mapa real (OpenStreetMap + Leaflet) para la vista mapa del buscador del docente.
 *
 * El runtime del prototipo vuelve a dibujar el DOM en cada cambio de estado, así
 * que una instancia de Leaflet montada dentro de la plantilla se destruiría a la
 * primera interacción. Por eso el mapa vive en un div propio, que este script
 * mantiene y vuelve a enganchar dentro del hueco `#udoar-mapa-host` cada vez que
 * la plantilla lo recrea.
 *
 * Los datos llegan por window.__udMapaDatos, que la app publica en cada render.
 */
(function () {
  // El runtime ejecuta los scripts del helmet dos veces: sin este candado
  // quedaban dos mapas superpuestos y los pines duplicados.
  if (window.__udMapaIniciado) return;
  window.__udMapaIniciado = true;

  var HOST = 'udoar-mapa-host';
  // Zona Norte + CABA norte. Centro y zoom pensados para que entren todas las zonas.
  var CENTRO = [-34.495, -58.53];
  var ZOOM = 11;

  var contenedor = null; // div propio, se reusa siempre
  var mapa = null;
  var capaPines = null;
  var firmaAnterior = '';

  function crear() {
    if (contenedor || !window.L) return;
    contenedor = document.createElement('div');
    contenedor.style.cssText = 'position:absolute;inset:0;border-radius:12px;overflow:hidden';
    mapa = window.L.map(contenedor, {
      center: CENTRO,
      zoom: ZOOM,
      scrollWheelZoom: false, // que la rueda siga desplazando la página
      attributionControl: true,
    });
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    capaPines = window.L.layerGroup().addTo(mapa);
  }

  function icono(color, seleccionado) {
    var borde = seleccionado ? '3px solid #16214F' : '2.5px solid #fff';
    var escala = seleccionado ? 1.15 : 1;
    return window.L.divIcon({
      className: '',
      html: '<span style="display:block;width:24px;height:24px;border-radius:999px 999px 999px 2px;'
        + 'transform:rotate(45deg) scale(' + escala + ');background:' + color + ';border:' + borde + ';'
        + 'box-shadow:0 3px 8px rgba(31,36,33,.35)"></span>',
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
  }

  function pintar(datos) {
    if (!mapa || !datos) return;
    var firma = JSON.stringify(datos);
    if (firma === firmaAnterior) return;
    firmaAnterior = firma;

    capaPines.clearLayers();
    (datos.pines || []).forEach(function (p, i) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
      var m = window.L.marker([p.lat, p.lng], {
        icon: icono(p.color, datos.sel === i),
        title: p.titulo,
        riseOnHover: true,
      });
      m.on('click', function () {
        if (!window.__udInst) return;
        if (datos.tipo === 'inst') window.__udInst.seleccionarInstEnMapa(i);
        else window.__udInst.seleccionarEnMapa(i);
      });
      capaPines.addLayer(m);
    });
  }

  function enganchar() {
    var host = document.getElementById(HOST);
    if (host && contenedor && contenedor.parentNode !== host) {
      host.appendChild(contenedor);
      // El div estuvo fuera del documento: Leaflet necesita recalcular el tamaño.
      setTimeout(function () { if (mapa) mapa.invalidateSize(); }, 0);
    }
    if (host) pintar(window.__udMapaDatos);
  }

  function arrancar() {
    crear();
    if (!mapa) { setTimeout(arrancar, 120); return; }
    enganchar();
    setInterval(enganchar, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }
})();
