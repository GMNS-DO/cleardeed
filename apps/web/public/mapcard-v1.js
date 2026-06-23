/*!
 * ClearDeed MapCard v1 — interactive map bootstrap.
 *
 * Mounts a MapLibre GL JS map into the #mapcard-v1 div emitted by
 * agents/consumer-report-writer/src/map-card.ts. Reads all geo data
 * from data-* attributes on the div; no network calls, no
 * coordinates in JS literals.
 *
 * Source of truth: docs/superpowers/specs/REPORT_REDESIGN_PREMIUM.md §3
 * (Map Library, Map Layers, Map Interaction, Map States).
 *
 * State machine (data-state on the div):
 *   - "verified"   → full map with gold glow (success in plotDiagram)
 *   - "partial"    → full map, no glow (partial in plotDiagram)
 *   - "unverified" → bail out, leave the static SVG poster visible
 *                    (failed / not_attempted in plotDiagram)
 *
 * Failure modes (any one triggers .mapcard-failed on the frame and
 * the static SVG poster remains visible):
 *   - maplibre-gl is not loaded (CDN blocked, etc.)
 *   - data-plot is malformed JSON
 *   - the polygon is missing or has < 4 vertices
 *   - the MapLibre Map constructor throws
 *   - the MapLibre 'load' event never fires (5s timeout)
 *
 * Tested in apps/web/public/mapcard-v1.test.js (jsdom + mocked
 * maplibre-gl).
 */
(function () {
  'use strict';

  // Khordha district box — the spec's pan/zoom clamp. When a plot
  // sits outside this box, the bootstrap clamps the fitBounds
  // argument so the buyer can't pan off to Antarctica.
  var KHORDHA_BOUNDS = { minLat: 19.8, maxLat: 20.5, minLon: 85.0, maxLon: 86.0 };

  // Esri World Imagery — free, no API key, attribution required.
  // The ToS allows commercial use with attribution; founder to
  // confirm before production deployment. See commit message.
  var ESRI_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  var ESRI_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics';

  var MAPLIBRE_CDN = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
  var MAPLIBRE_LOAD_TIMEOUT_MS = 8000;
  var MAP_LOAD_TIMEOUT_MS = 5000;

  // Brand color tokens — match the spec's REPORT_REDESIGN_PREMIUM.md palette.
  var COLOR = {
    cadastralFill: '#1d6f5b',
    cadastralFillOpacity: 0.25,
    cadastralLine: '#ffffff',
    cadastralLineWidth: 0.5,
    targetFill: '#C9A961',
    targetFillOpacity: 0.6,
    targetLine: '#C9A961',
    targetLineWidth: 2,
    neighborLine: '#6b7280',
    neighborLineRisk: '#f59e0b',
    neighborLineRed: '#dc2626',
    neighborLabel: '#1f2937',
    neighborLabelHalo: '#ffffff',
    chauhaddiStroke: '#C9A961',
    // MapCard v1.1 — approximate-mode tokens. Soft slate-400 outline
    // at low opacity so the district fills the frame without competing
    // visually with the gold target marker.
    districtFill: '#94a3b8',
    districtFillOpacity: 0.04,
    districtLine: '#94a3b8',
    districtLineWidth: 1.25,
  };

  function log(msg) {
    if (window.console && window.console.log) {
      window.console.log('[mapcard] ' + msg);
    }
  }

  function warn(msg, err) {
    if (window.console && window.console.warn) {
      window.console.warn('[mapcard] ' + msg, err || '');
    }
  }

  function fail(el, reason) {
    warn(reason);
    var frame = el.closest('.map-card-frame');
    if (frame) frame.classList.add('mapcard-failed');
  }

  /**
   * Load maplibre-gl from the CDN. Returns a Promise that resolves
   * to the global maplibregl object, or rejects on timeout/error.
   * The script tag is injected once; subsequent calls reuse the
   * promise so we don't pollute <head> with duplicate <script>s.
   */
  var maplibreLoading = null;
  function loadMapLibre() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (maplibreLoading) return maplibreLoading;
    maplibreLoading = new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error('maplibre-gl load timed out after ' + MAPLIBRE_CDN_TIMEOUT_LABEL));
      }, MAPLIBRE_LOAD_TIMEOUT_MS);
      var s = document.createElement('script');
      s.src = MAPLIBRE_CDN;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = function () {
        clearTimeout(timer);
        if (window.maplibregl) resolve(window.maplibregl);
        else reject(new Error('maplibre-gl script loaded but window.maplibregl is undefined'));
      };
      s.onerror = function () {
        clearTimeout(timer);
        reject(new Error('maplibre-gl script failed to load from ' + MAPLIBRE_CDN));
      };
      document.head.appendChild(s);
    });
    // On failure, reset so a future attempt can retry.
    maplibreLoading.catch(function () { maplibreLoading = null; });
    return maplibreLoading;
  }
  var MAPLIBRE_CDN_TIMEOUT_LABEL = MAPLIBRE_LOAD_TIMEOUT_MS + 'ms';

  /**
   * Parse the data-* attributes on the #mapcard-v1 div. Returns
   * { plot, neighbors, roads, bounds, centroid, bhulekhUrl, plotNo,
   * village } or throws (which the caller catches and treats as a
   * fatal error).
   */
  function readDataAttrs(el) {
    var parse = function (name) {
      var raw = el.getAttribute('data-' + name);
      if (raw == null || raw === '') return null;
      try { return JSON.parse(raw); } catch (e) {
        throw new Error('data-' + name + ' is not valid JSON: ' + (e && e.message));
      }
    };
    var parseCsv = function (name) {
      var raw = el.getAttribute('data-' + name);
      if (!raw) return null;
      var parts = raw.split(',').map(Number);
      if (parts.length !== 4 || parts.some(isNaN)) return null;
      return { minLat: parts[0], maxLat: parts[1], minLon: parts[2], maxLon: parts[3] };
    };
    return {
      plot: parse('plot'),
      neighbors: parse('neighbors') || [],
      roads: parse('roads') || [],
      bounds: parseCsv('bounds'),
      centroid: parseCsv('target-centroid'),
      // MapCard v1.1 — approximate-mode plumbing.
      // mode = "approximate" means Bhunaksha returned no polygon, so
      // the map shows the Khordha district boundary + a centroid marker
      // instead of the target polygon. Default to "exact" so v1.0 reports
      // (no data-mode) keep their current behaviour.
      mode: el.getAttribute('data-mode') === 'approximate' ? 'approximate' : 'exact',
      // The Khordha district boundary GeoJSON, parsed from the
      // data-district attribute (only present in approximate mode).
      // ~17KB of GeoJSON — emitted by the server when the diagram
      // step took the fallback path. Tolerant of missing/empty
      // (returns null and the layer simply isn't added).
      district: parse('district'),
      bhulekhUrl: el.getAttribute('data-bhulekh-url') || null,
      plotNo: el.getAttribute('data-plot-no') || null,
      village: el.getAttribute('data-village') || null,
    };
  }

  /**
   * Clamp a bounding box to the Khordha district. The spec says
   * pan/zoom is clamped; we clamp the initial fitBounds too so
   * out-of-district reports (a misclick, a test) don't show
   * Antarctica. If the input box lies entirely outside Khordha
   * (no intersection), we fall back to the full Khordha box
   * rather than returning an inverted box.
   */
  function clampBounds(b) {
    if (!b) return b;
    var minLat = Math.max(b.minLat, KHORDHA_BOUNDS.minLat);
    var maxLat = Math.min(b.maxLat, KHORDHA_BOUNDS.maxLat);
    var minLon = Math.max(b.minLon, KHORDHA_BOUNDS.minLon);
    var maxLon = Math.min(b.maxLon, KHORDHA_BOUNDS.maxLon);
    // Inverted box (e.g. {0, 1} vs {19.8, 20.5}) → no intersection.
    if (minLat >= maxLat || minLon >= maxLon) {
      return {
        minLat: KHORDHA_BOUNDS.minLat,
        maxLat: KHORDHA_BOUNDS.maxLat,
        minLon: KHORDHA_BOUNDS.minLon,
        maxLon: KHORDHA_BOUNDS.maxLon,
      };
    }
    return { minLat: minLat, maxLat: maxLat, minLon: minLon, maxLon: maxLon };
  }

  /**
   * Build the MapLibre style object. Inline so the report HTML
   * doesn't carry a 5KB style spec. The `cadastral` GeoJSON
   * source contains the target plot (role='target') and the
   * neighbours (role='neighbor'). The map style filters by role
   * to render the layers.
   *
   * Approximate-mode extension: when `mode === 'approximate'` and a
   * Khordha district boundary is supplied, a second `district` source
   * is added (role='district') and rendered as a thin outline +
   * subtle fill — the only "context" the buyer has when no plot
   * polygon exists.
   */
  function buildStyle(plot, neighbors, visibility, district) {
    var features = [];
    if (plot) {
      features.push({
        type: 'Feature',
        properties: { role: 'target' },
        geometry: plot,
      });
    }
    if (neighbors && neighbors.length) {
      neighbors.forEach(function (n) {
        if (n && n.polygon) {
          features.push({
            type: 'Feature',
            properties: {
              role: 'neighbor',
              plotNo: n.plotNo || '',
              riskLevel: n.riskLevel || 'dim',
            },
            geometry: n.polygon,
          });
        }
      });
    }
    var sources = {
      satellite: {
        type: 'raster',
        tiles: [ESRI_TILE_URL],
        tileSize: 256,
        attribution: ESRI_ATTRIBUTION,
      },
      cad: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: features },
      },
    };
    // District outline source. Only present in approximate mode and
    // only when the boundary data survived the round-trip from the
    // server. The data-district attribute is a GeoJSON Feature (the
    // Khordha district polygon wrapped in a Feature envelope).
    if (district && district.type === 'Feature' && district.geometry) {
      sources.district = {
        type: 'geojson',
        data: district,
      };
    }
    var layers = [
      {
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: visibility.satellite ? 'visible' : 'none' },
      },
    ];
    // District outline sits below the cadastral polygons so the
    // gold target outline still reads as the foreground feature
    // even when the user is at district zoom.
    if (sources.district) {
      layers.push({
        id: 'district-fill',
        type: 'fill',
        source: 'district',
        paint: { 'fill-color': COLOR.districtFill, 'fill-opacity': COLOR.districtFillOpacity },
      });
      layers.push({
        id: 'district-line',
        type: 'line',
        source: 'district',
        paint: { 'line-color': COLOR.districtLine, 'line-width': COLOR.districtLineWidth },
      });
    }
    layers.push({
      id: 'cad-fill',
      type: 'fill',
      source: 'cad',
      filter: ['==', ['get', 'role'], 'target'],
      paint: { 'fill-color': COLOR.targetFill, 'fill-opacity': COLOR.targetFillOpacity },
    });
    layers.push({
      id: 'cad-line',
      type: 'line',
      source: 'cad',
      filter: ['==', ['get', 'role'], 'target'],
      paint: { 'line-color': COLOR.targetLine, 'line-width': COLOR.targetLineWidth },
    });
    layers.push({
      id: 'neighbors-fill',
      type: 'fill',
      source: 'cad',
      filter: ['==', ['get', 'role'], 'neighbor'],
      paint: { 'fill-color': COLOR.cadastralFill, 'fill-opacity': COLOR.cadastralFillOpacity },
    });
    layers.push({
      id: 'neighbors-line',
      type: 'line',
      source: 'cad',
      filter: ['==', ['get', 'role'], 'neighbor'],
      paint: {
        'line-color': [
          'match',
          ['get', 'riskLevel'],
          'red', COLOR.neighborLineRed,
          'risk', COLOR.neighborLineRisk,
          COLOR.neighborLine,
        ],
        'line-width': [
          'match',
          ['get', 'riskLevel'],
          'red', 2,
          'risk', 1.5,
          1,
        ],
      },
    });
    layers.push({
      id: 'neighbors-label',
      type: 'symbol',
      source: 'cad',
      filter: ['==', ['get', 'role'], 'neighbor'],
      layout: {
        'text-field': ['get', 'plotNo'],
        'text-size': 11,
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': COLOR.neighborLabel,
        'text-halo-color': COLOR.neighborLabelHalo,
        'text-halo-width': 1.5,
      },
    });
    return {
      version: 8,
      sources: sources,
      layers: layers,
    };
  }

  /**
   * Draw the 4 chauhaddi arrows (the spec's signature visual). The
   * arrows point from the target centroid to the 4 nearest
   * neighbour centroids. We re-project on every `move` event
   * throttled via requestAnimationFrame so the arrows track the
   * map as the user pans/zooms.
   *
   * Implementation: an absolutely-positioned <svg> overlay inside
   * the map div. We compute the centroids once, then re-project
   * them on every frame.
   */
  function drawChauhaddiArrows(map, el, centroid, neighbors) {
    if (!centroid || !neighbors || !neighbors.length) return;
    // Compute neighbour centroids (first 4 by Euclidean distance).
    var neighbourCentroids = neighbors
      .map(function (n) {
        if (!n || !n.polygon || !n.polygon.coordinates || !n.polygon.coordinates[0]) return null;
        var ring = n.polygon.coordinates[0];
        if (ring.length < 4) return null;
        var sumLon = 0, sumLat = 0;
        for (var i = 0; i < ring.length; i++) {
          sumLon += ring[i][0];
          sumLat += ring[i][1];
        }
        return { plotNo: n.plotNo, lon: sumLon / ring.length, lat: sumLat / ring.length };
      })
      .filter(Boolean)
      .map(function (c) {
        var dx = c.lon - centroid.lon;
        var dy = c.lat - centroid.lat;
        c.dist = dx * dx + dy * dy;
        return c;
      })
      .sort(function (a, b) { return a.dist - b.dist; })
      .slice(0, 4);

    if (!neighbourCentroids.length) return;

    // Create the SVG overlay.
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mapcard-chauhaddi-svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    el.appendChild(svg);

    var rafPending = false;
    function update() {
      rafPending = false;
      var w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      // Clear existing arrows.
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var t = map.project([centroid.lon, centroid.lat]);
      for (var i = 0; i < neighbourCentroids.length; i++) {
        var nc = neighbourCentroids[i];
        var p = map.project([nc.lon, nc.lat]);
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', t.x); line.setAttribute('y1', t.y);
        line.setAttribute('x2', p.x); line.setAttribute('y2', p.y);
        line.setAttribute('stroke', COLOR.chauhaddiStroke);
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('opacity', '0.85');
        svg.appendChild(line);
      }
    }
    function scheduleUpdate() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(update);
    }
    map.on('move', scheduleUpdate);
    map.on('zoom', scheduleUpdate);
    map.on('resize', scheduleUpdate);
    // Initial render after the map's first idle frame.
    map.once('idle', update);
  }

  /**
   * Wire the layer-toggle buttons. Click → toggle visibility on
   * the satellite + neighbors layers, save choice to localStorage.
   */
  function wireToggle(frame, map) {
    var buttons = frame.querySelectorAll('.map-card-layer-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var choice = btn.getAttribute('data-layer');
        try { window.localStorage.setItem('mapcard.layers', choice); } catch (e) {}
        buttons.forEach(function (b) {
          var isActive = b.getAttribute('data-layer') === choice;
          b.classList.toggle('is-active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        var showSat = choice !== 'cadastral';
        var showCad = choice !== 'satellite';
        if (map.getLayer('satellite')) {
          map.setLayoutProperty('satellite', 'visibility', showSat ? 'visible' : 'none');
        }
        if (map.getLayer('neighbors-fill')) {
          map.setLayoutProperty('neighbors-fill', 'visibility', showCad ? 'visible' : 'none');
          map.setLayoutProperty('neighbors-line', 'visibility', showCad ? 'visible' : 'none');
          map.setLayoutProperty('neighbors-label', 'visibility', showCad ? 'visible' : 'none');
        }
        if (map.getLayer('cad-fill')) {
          map.setLayoutProperty('cad-fill', 'visibility', showCad ? 'visible' : 'none');
          map.setLayoutProperty('cad-line', 'visibility', showCad ? 'visible' : 'none');
        }
        // District layer toggles with the cadastral layer — they're
        // both "context" the buyer turns on/off together. Tolerant of
        // missing (the layer only exists in approximate mode).
        if (map.getLayer('district-fill')) {
          map.setLayoutProperty('district-fill', 'visibility', showCad ? 'visible' : 'none');
          map.setLayoutProperty('district-line', 'visibility', showCad ? 'visible' : 'none');
        }
      });
    });
  }

  /**
   * Main entry point — called by DOMContentLoaded.
   */
  function init() {
    var el = document.getElementById('mapcard-v1');
    if (!el) return;
    if (el.dataset.state === 'unverified') {
      // v0 fallback handles this — no map.
      return;
    }

    var data;
    try {
      data = readDataAttrs(el);
    } catch (e) {
      fail(el, 'bad data-* attr: ' + e.message);
      return;
    }
    // MapCard v1.1 — approximate mode. When the diagram step fell
    // back (Bhunaksha returned no polygon), `data.plot` is null and
    // the buyer is looking at a district outline + a centroid marker
    // rather than a target polygon. We still want the interactive map;
    // we just don't have neighbors to draw chauhaddi arrows to.
    var isApproximate = data.mode === 'approximate';
    if (!isApproximate) {
      if (!data.plot || !data.plot.coordinates || !data.plot.coordinates[0] || data.plot.coordinates[0].length < 4) {
        fail(el, 'data-plot is missing or has < 4 vertices');
        return;
      }
    } else if (!data.district) {
      // Approximate mode requires a district boundary. If the server
      // somehow emitted the marker without the polygon, fall back to
      // the v0 poster (rather than rendering an empty map).
      fail(el, 'approximate mode requires data-district');
      return;
    }

    var saved;
    try { saved = window.localStorage.getItem('mapcard.layers') || 'both'; }
    catch (e) { saved = 'both'; }
    var showSat = saved !== 'cadastral';
    var showCad = saved !== 'satellite';

    var visibility = { satellite: showSat, cadastral: showCad };

    loadMapLibre().then(function (maplibregl) {
      try {
        var style = buildStyle(data.plot, data.neighbors, visibility, data.district);
        var fitBounds = clampBounds(data.bounds);
        var mapOpts = {
          container: el,
          style: style,
          attributionControl: true,
        };
        if (fitBounds) {
          mapOpts.bounds = [[fitBounds.minLon, fitBounds.minLat], [fitBounds.maxLon, fitBounds.maxLat]];
          mapOpts.fitBoundsOptions = { padding: 40, maxZoom: 19 };
        } else {
          // Fall back to the target centroid if no bounds.
          if (data.centroid) {
            mapOpts.center = [data.centroid.lon, data.centroid.lat];
          }
          mapOpts.zoom = 17;
        }
        var map = new maplibregl.Map(mapOpts);
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

        // The poster stays visible until the map's first paint.
        // We hide it on 'idle' (post-tile-load) to avoid showing
        // a half-loaded satellite under the static SVG.
        var poster = el.parentElement && el.parentElement.querySelector('.mapcard-poster');
        map.once('idle', function () {
          if (poster) poster.style.display = 'none';
        });

        // Chauhaddi arrows — only on the exact path. In approximate
        // mode there are no neighbour polygons to point at; the gold
        // marker sits on the village centroid with no chauhaddi to
        // draw, and the four-arrow overlay would be misleading.
        if (!isApproximate) {
          map.once('idle', function () {
            drawChauhaddiArrows(map, el, data.centroid, data.neighbors);
          });
        }

        // Wire the toggle buttons (they're siblings of #mapcard-v1
        // inside .map-card-frame).
        var frame = el.closest('.map-card-frame');
        if (frame) wireToggle(frame, map);

        // Map failure → fall back to the static poster.
        map.on('error', function (e) {
          warn('map error', e && e.error);
        });
      } catch (e) {
        fail(el, 'map init failed: ' + (e && e.message));
      }
    }).catch(function (e) {
      fail(el, 'maplibre-gl load failed: ' + (e && e.message));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
