/*!
 * TFMapas — configuración y recuperación de capas base del callejero.
 *
 * Utilidad compartida por los embeds (valencia_27.html, alicante_16.html) y el
 * callejero nativo Angular. Centraliza:
 *   - el sufijo ?key=… de CARTO (clave pública de mapas, nunca anónima);
 *   - las URLs de los proveedores cartográficos;
 *   - la recuperación por capa (3 tileerror consecutivos → una transición al
 *     respaldo; si el respaldo también falla → aviso + botón Reintentar).
 *
 * Este archivo es el STUB versionado, sin clave real. El build (`pnpm build` /
 * `pnpm build:staging`) escribe únicamente la copia generada en
 * dist/front/browser/callejero-embed/mapas-config.js sustituyendo el valor de
 * cartoKey por la clave de CALLEJERO_CARTO_API_KEY. Nunca se escribe una clave
 * en el código fuente.
 */
(function (global, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    global.TFMapas = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ── Configuración (sustituida por el generador de build) ─────────────── */
  var CONFIG = {
    cartoKey: '',
  };

  var CLAVES_OPCIONES = [
    'attribution',
    'maxZoom',
    'maxNativeZoom',
    'minZoom',
    'minNativeZoom',
    'subdomains',
    'tms',
    'zoomOffset',
    'zoomReverse',
  ];

  var CARTO_OPTS = {
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '© OpenStreetMap, © CARTO',
  };
  var GOOGLE_OPTS = {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 21,
    attribution: '© Google',
  };
  var ESRI_CLARO_OPTS = {
    maxNativeZoom: 16,
    maxZoom: 21,
    attribution: 'Esri, HERE, Garmin',
  };
  var ESRI_SAT_OPTS = {
    maxZoom: 19,
    attribution: 'Esri, Maxar, Earthstar Geographics',
  };
  var ESRI_TOPO_OPTS = {
    maxZoom: 19,
    attribution: 'Esri, HERE, Garmin, FAO, NOAA',
  };
  var ESRI_RELIEVE_OPTS = {
    maxNativeZoom: 13,
    maxZoom: 21,
    attribution: 'Esri',
  };
  var IGN_OPTS = { maxZoom: 19, attribution: '© IGN' };
  var PNOA_OPTS = {
    maxZoom: 19,
    attribution: 'PNOA © Instituto Geográfico Nacional',
  };
  var OPEN_TOPO_OPTS = {
    maxZoom: 17,
    attribution: '© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)',
  };

  /* ── Clave CARTO ──────────────────────────────────────────────────────── */
  function claveCarto() {
    return typeof CONFIG.cartoKey === 'string' ? CONFIG.cartoKey.trim() : '';
  }
  function tieneCarto() {
    return claveCarto().length > 0;
  }
  function conClave(url, clave) {
    if (!url) return null;
    var k = typeof clave === 'string' ? clave.trim() : '';
    if (!k) return null; // nunca solicitar CARTO sin clave
    if (/[?&]key=/.test(url)) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'key=' + encodeURIComponent(k);
  }
  function cartoUrl(ruta) {
    return conClave(
      'https://{s}.basemaps.cartocdn.com/' + ruta + '/{z}/{x}/{y}{r}.png',
      claveCarto(),
    );
  }

  function copiar(obj) {
    var out = {};
    for (var i = 0; i < arguments.length; i += 1) {
      var src = arguments[i];
      if (!src) continue;
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
      }
    }
    return out;
  }
  function def(url, opts) {
    return { url: url, opts: opts || {} };
  }

  /* ── Proveedores cartográficos ────────────────────────────────────────── */
  function proveedores() {
    return {
      // CARTO (solo con clave; en su ausencia las funciones devuelven null).
      cartoVoyager: function (extra) {
        return tieneCarto()
          ? def(cartoUrl('rastertiles/voyager'), copiar(CARTO_OPTS, extra))
          : null;
      },
      cartoVoyagerSinEtiquetas: function (extra) {
        return tieneCarto()
          ? def(cartoUrl('rastertiles/voyager_nolabels'), copiar(CARTO_OPTS, extra))
          : null;
      },
      cartoLightSinEtiquetas: function (extra) {
        return tieneCarto()
          ? def(cartoUrl('light_nolabels'), copiar(CARTO_OPTS, extra))
          : null;
      },

      // Google (se conserva en Valencia; sin clave).
      googleCalles: function (extra) {
        return def(
          'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
          copiar(GOOGLE_OPTS, extra),
        );
      },
      googleSatelite: function (extra) {
        return def(
          'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          copiar(GOOGLE_OPTS, extra),
        );
      },

      // Esri.
      esriClaro: function (extra) {
        return def(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          copiar(ESRI_CLARO_OPTS, extra),
        );
      },
      esriSatelite: function (extra) {
        return def(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          copiar(ESRI_SAT_OPTS, extra),
        );
      },
      esriTopo: function (extra) {
        return def(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          copiar(ESRI_TOPO_OPTS, extra),
        );
      },
      esriCalles: function (extra) {
        return def(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          copiar(ESRI_TOPO_OPTS, extra),
        );
      },
      esriRelieveSombreado: function (extra) {
        return def(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
          copiar(ESRI_RELIEVE_OPTS, extra),
        );
      },

      // IGN / IDEE.
      ignBaseTodo: function (extra) {
        return def(
          'https://www.ign.es/wmts/ign-base?service=WMTS&request=GetTile&version=1.0.0&layer=IGNBaseTodo&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}',
          copiar(IGN_OPTS, extra),
        );
      },
      ignRelieve: function (extra) {
        return def(
          'https://servicios.idee.es/wmts/mdt?service=WMTS&request=GetTile&version=1.0.0&layer=Relieve&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}',
          copiar(IGN_OPTS, extra),
        );
      },
      pnoa: function (extra) {
        return def(
          'https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0&layer=OI.OrthoimageCoverage&style=default&format=image/jpeg&tilematrixset=GoogleMapsCompatible&tilematrix={z}&tilerow={y}&tilecol={x}',
          copiar(PNOA_OPTS, extra),
        );
      },
      openTopoMap: function (extra) {
        return def(
          'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          copiar(OPEN_TOPO_OPTS, extra),
        );
      },
    };
  }

  /* ── Recuperación por capa ────────────────────────────────────────────── */
  function instantaneaOpciones(capa) {
    var out = {};
    for (var i = 0; i < CLAVES_OPCIONES.length; i += 1) {
      var k = CLAVES_OPCIONES[i];
      out[k] = capa.options[k];
    }
    return out;
  }

  function aplicarOpciones(capa, opts) {
    if (!opts) return;
    var previa = capa.options.attribution;
    for (var i = 0; i < CLAVES_OPCIONES.length; i += 1) {
      var k = CLAVES_OPCIONES[i];
      if (k in opts) capa.options[k] = opts[k];
    }
    var map = capa._map;
    if (
      map &&
      map.attributionControl &&
      opts.attribution !== undefined &&
      opts.attribution !== previa
    ) {
      if (previa) map.attributionControl.removeAttribution(previa);
      if (opts.attribution) map.attributionControl.addAttribution(opts.attribution);
    }
  }

  /**
   * Redibuja la capa al zoom ACTUAL redondeado.
   *
   * `L.GridLayer.redraw()` deriva `_tileZoom` de `map.getZoom()` SIN redondear.
   * Durante un `flyTo`/animación `getZoom()` es fraccional; las plantillas de URL
   * que interpolan `{z}` (p. ej. `tilematrix` de PNOA) reciben un valor como
   * 8.99999998, el servidor responde con algo que no es imagen y el navegador lo
   * bloquea (ORB) → tileerror falsos que agotan la recuperación. Replicamos
   * `redraw()` redondeando el zoom, igual que hace Leaflet en `zoomend`
   * (`_setView` usa `Math.round`). Así nunca se piden teselas del respaldo con un
   * zoom inválido. Si la API interna no estuviera disponible, cae a `redraw()`.
   */
  function redibujar(capa) {
    var map = capa && capa._map;
    if (
      map &&
      typeof map.getCenter === 'function' &&
      typeof map.getZoom === 'function' &&
      typeof capa._removeAllTiles === 'function' &&
      typeof capa._setView === 'function'
    ) {
      capa._removeAllTiles();
      capa._setView(map.getCenter(), map.getZoom());
      return;
    }
    capa.redraw();
  }

  /**
   * ¿El evento de tesela pertenece a una tesela que la capa aún conserva?
   *
   * Tras cambiar de proveedor (`setUrl`/`redraw`) las teselas retiradas pueden
   * emitir `tileerror` tardío (Leaflet dispara el evento antes de comprobar que
   * la tesela sigue en `_tiles`); contarlas como fallos del respaldo, o dejar que
   * un `tileload` tardío reinicie el contador, corrompe la recuperación. Los
   * eventos sin objeto `tile` (pruebas) mantienen la semántica previa.
   */
  function teselaVigente(capa, event) {
    var tile = event && event.tile;
    if (!tile) return true;
    var tiles = capa && capa._tiles;
    if (!tiles) return true;
    for (var k in tiles) {
      if (
        Object.prototype.hasOwnProperty.call(tiles, k) &&
        tiles[k] &&
        tiles[k].el === tile
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Opciones a aplicar al cambiar al respaldo.
   *
   * Conserva el rango de VISTA de la capa original (minZoom/maxZoom): el
   * respaldo no debe recortar el zoom al que el mapa ya está (Leaflet deja
   * `_tileZoom` indefinido si el zoom supera `options.maxZoom`, y el mapa queda
   * vacío sin tileerror). Los límites NATIVOS son del respaldo y, si no los
   * declara, se infieren de su propio maxZoom/minZoom. Los valores de
   * visualización (subdominios, atribución, tms, zoomOffset/zoomReverse) son los
   * completos del proveedor activo. Siempre se devuelven todas las claves, para
   * limpiar restos del primario (p. ej. un maxNativeZoom 16 de Esri).
   */
  function opcionesRespaldo(primario, respaldo) {
    var p = (respaldo && respaldo.opts) || {};
    var orig = (primario && primario.opts) || {};
    var out = {};
    out.minZoom = orig.minZoom;
    out.maxZoom = orig.maxZoom;
    var maxNative = p.maxNativeZoom !== undefined ? p.maxNativeZoom : p.maxZoom;
    var minNative = p.minNativeZoom !== undefined ? p.minNativeZoom : p.minZoom;
    out.maxNativeZoom = maxNative !== undefined ? maxNative : undefined;
    out.minNativeZoom = minNative !== undefined ? minNative : undefined;
    // Leaflet llama a _getSubdomain SIEMPRE (aunque la URL no use {s}), así que
    // `subdomains` debe ser siempre un valor válido: si el proveedor no lo
    // declara se usa el DEFAULT de Leaflet ('abc'); tms/zoomOffset/zoomReverse
    // caen a false/0/false. Así se evita el TypeError al cambiar a PNOA/Esri.
    out.subdomains = p.subdomains !== undefined ? p.subdomains : 'abc';
    out.attribution = p.attribution;
    out.tms = p.tms !== undefined ? p.tms : false;
    out.zoomOffset = p.zoomOffset !== undefined ? p.zoomOffset : 0;
    out.zoomReverse = p.zoomReverse !== undefined ? p.zoomReverse : false;
    return out;
  }

  function crearErrorUI(contenedor, opciones) {
    if (!contenedor || typeof document === 'undefined') return null;
    var destino = opciones.errorContenedor || contenedor;
    var box = document.createElement('div');
    box.className = 'tf-mapa-error';
    box.setAttribute('role', 'alert');
    box.style.cssText =
      'position:absolute;z-index:1200;left:50%;top:50%;transform:translate(-50%,-50%);' +
      'background:#fff;color:#1c1c1c;border:1px solid #d0d0d0;border-radius:10px;' +
      'padding:14px 18px;box-shadow:0 6px 24px rgba(0,0,0,.25);text-align:center;' +
      'max-width:82%;display:none;font-family:inherit';
    var texto = document.createElement('p');
    texto.className = 'tf-mapa-error-texto';
    texto.textContent = opciones.textoError || 'No se puede cargar el mapa';
    texto.style.cssText = 'margin:0 0 10px;font-size:14px';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tf-mapa-reintentar';
    btn.textContent = opciones.textoReintentar || 'Reintentar';
    btn.style.cssText =
      'cursor:pointer;border:0;border-radius:8px;padding:8px 16px;' +
      'background:#BF0B1B;color:#fff;font-weight:600;font-family:inherit';
    box.appendChild(texto);
    box.appendChild(btn);
    destino.appendChild(box);
    return box;
  }

  function crearAvisoUI(contenedor, opciones) {
    if (!contenedor || typeof document === 'undefined') return null;
    var el = document.createElement('div');
    el.className = 'tf-mapa-aviso';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.textContent = opciones.textoAviso || 'Usando capa de respaldo';
    el.style.cssText =
      'position:absolute;z-index:1100;left:8px;bottom:8px;background:rgba(28,28,28,.82);' +
      'color:#fff;font-size:11px;padding:3px 9px;border-radius:11px;display:none;' +
      'pointer-events:none;font-family:inherit';
    contenedor.appendChild(el);
    return el;
  }

  /**
   * Envuelve una capa Leaflet ya creada con recuperación ante fallos.
   * Mantiene la IDENTIDAD de la capa (muta su URL/opciones) para no romper
   * referencias externas (baseActual, selección, qzMapMode…).
   *
   * opciones:
   *   respaldo         {url, opts} | null  capa alternativa (una sola transición)
   *   maxFallos        nº de tileerror consecutivos (por defecto 3)
   *   contenedor       elemento donde montar aviso/error
   *   textoError/textoReintentar/textoAviso
   *   activo           bool (por defecto true)
   *   alCambiarFase    fn(fase, capa)
   */
  function crearRecuperable(L, capa, opciones) {
    opciones = opciones || {};
    if (!L || !capa) return null;
    var maxFallos = typeof opciones.maxFallos === 'number' ? opciones.maxFallos : 3;
    var respaldo = opciones.respaldo || null;
    var primario = { url: capa._url, opts: instantaneaOpciones(capa) };
    var fase = 'primario';
    var fallos = 0;
    var activo = opciones.activo !== false;
    var destruido = false;
    var contenedor = opciones.contenedor || (capa._map ? capa._map.getContainer() : null);

    var errorBox = crearErrorUI(contenedor, opciones || {});
    var avisoEl = crearAvisoUI(contenedor, opciones || {});
    if (errorBox) {
      var btn = errorBox.querySelector('.tf-mapa-reintentar');
      if (btn) btn.addEventListener('click', function () { reintentar(); });
    }

    function actualizarUI() {
      if (destruido) return;
      if (errorBox) errorBox.style.display = fase === 'fallo' && activo ? 'block' : 'none';
      if (avisoEl) avisoEl.style.display = fase === 'respaldo' && activo ? 'block' : 'none';
    }

    function aplicarPrimario() {
      // Restablece EXACTAMENTE las opciones y la URL originales.
      aplicarOpciones(capa, primario.opts);
      if (primario.url && primario.url !== capa._url) capa.setUrl(primario.url, true);
      redibujar(capa);
    }
    function aplicarRespaldo() {
      if (!respaldo) return;
      aplicarOpciones(capa, opcionesRespaldo(primario, respaldo));
      if (respaldo.url && respaldo.url !== capa._url) capa.setUrl(respaldo.url, true);
      redibujar(capa);
    }

    function notificar() {
      if (typeof opciones.alCambiarFase === 'function') {
        opciones.alCambiarFase(fase, capa);
      }
    }

    function irARespaldo() {
      fase = 'respaldo';
      aplicarRespaldo();
      actualizarUI();
      notificar();
    }
    function irAFallo() {
      fase = 'fallo';
      actualizarUI();
      notificar();
    }
    function reintentar() {
      if (destruido) return;
      fallos = 0;
      fase = 'primario';
      aplicarPrimario();
      actualizarUI();
      notificar();
    }
    function onError(event) {
      if (destruido || !activo || fase === 'fallo') return;
      if (!teselaVigente(capa, event)) return;
      fallos += 1;
      if (fallos < maxFallos) return;
      fallos = 0;
      if (fase === 'primario' && respaldo) irARespaldo();
      else irAFallo();
    }
    function onLoad(event) {
      if (destruido) return;
      if (!teselaVigente(capa, event)) return;
      fallos = 0;
    }
    function establecerActivo(valor) {
      activo = !!valor;
      actualizarUI();
    }
    function destruir() {
      if (destruido) return;
      destruido = true;
      capa.off('tileerror', onError);
      capa.off('tileload', onLoad);
      if (errorBox && errorBox.parentNode) errorBox.parentNode.removeChild(errorBox);
      if (avisoEl && avisoEl.parentNode) avisoEl.parentNode.removeChild(avisoEl);
    }

    capa.on('tileerror', onError);
    capa.on('tileload', onLoad);
    actualizarUI();

    return {
      fase: function () { return fase; },
      reintentar: reintentar,
      establecerActivo: establecerActivo,
      destruir: destruir,
      avisoElemento: avisoEl,
      errorElemento: errorBox,
    };
  }

  return {
    config: CONFIG,
    tieneCarto: tieneCarto,
    claveCarto: claveCarto,
    proveedores: proveedores,
    crearRecuperable: crearRecuperable,
  };
});
