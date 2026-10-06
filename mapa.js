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

  // Pin de ubicación clásico: la punta cae exactamente sobre la coordenada.
  // Antes era un cuadrado con una esquina en punta y rotado 45°, que terminaba
  // apuntando al costado en vez de al suelo.
  function icono(color, seleccionado, rapida) {
    var borde = seleccionado ? '#16214F' : '#ffffff';
    var grosor = seleccionado ? 2.6 : 2;
    var escala = seleccionado ? 1.12 : 1;
    var ancho = Math.round(26 * escala);
    var alto = Math.round(34 * escala);
    var svg = '<svg width="' + ancho + '" height="' + alto + '" viewBox="0 0 26 34" fill="none"'
      + ' xmlns="http://www.w3.org/2000/svg" style="display:block">'
      + '<path d="M13 33C13 33 24 20.4 24 12.9A11 11 0 1 0 2 12.9C2 20.4 13 33 13 33Z"'
      + ' fill="' + color + '" stroke="' + borde + '" stroke-width="' + grosor + '" stroke-linejoin="round"/>'
      + (rapida
        ? '<g stroke="#fff" stroke-width="1.9" stroke-linecap="round" fill="none">'
          + '<circle cx="13" cy="13.2" r="4.6"/><path d="M13 10.6v2.8l1.9 1.3"/><path d="M11.1 6.6h3.8"/></g>'
        : '<circle cx="13" cy="12.7" r="4" fill="#fff" fill-opacity=".9"/>')
      + '</svg>';
    return window.L.divIcon({
      className: '',
      html: '<span style="display:block;filter:drop-shadow(0 3px 6px rgba(31,36,33,.35))">' + svg + '</span>',
      iconSize: [ancho, alto],
      iconAnchor: [ancho / 2, alto],
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
        icon: icono(p.color, datos.sel === i, !!p.rapida),
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
