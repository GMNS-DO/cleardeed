export function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeName(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b(sri|smt|shri|mrs|mr|ms|dr|late)\b\.?/gi, "")
    .replace(/[^a-z0-9\u0b00-\u0b7f ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIdentifier(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u0b00-\u0b7f]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizePlotNumber(value) {
  return normalizeWhitespace(value).replace(/\s+/g, "").toUpperCase();
}

export function normalizeDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const direct = new Date(raw);
  if (!Number.isNaN(direct.valueOf())) return direct.toISOString().slice(0, 10);

  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (!match) return null;
  const [, dd, mm, yyyyRaw] = match;
  const yyyy = yyyyRaw.length === 2 ? `20${yyyyRaw}` : yyyyRaw;
  const date = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}

export function normalizeArea(value, unit) {
  const numeric = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return { value: null, unit: unit ?? null, squareMeters: null };
  const normalizedUnit = normalizeWhitespace(unit).toLowerCase();
  const factors = {
    sqm: 1,
    "sq m": 1,
    "square meter": 1,
    "square meters": 1,
    "square mtr": 1,
    acre: 4046.8564224,
    acres: 4046.8564224,
    dec: 40.468564224,
    decimal: 40.468564224,
    decimals: 40.468564224,
    sqft: 0.09290304,
    "sq ft": 0.09290304,
    "square feet": 0.09290304,
    sqyd: 0.83612736,
    "sq yd": 0.83612736,
    "square yard": 0.83612736,
    "square yards": 0.83612736,
  };
  return {
    value: numeric,
    unit: normalizedUnit || unit || null,
    squareMeters: factors[normalizedUnit] ? numeric * factors[normalizedUnit] : null,
  };
}

export function propertyCanonicalKey({ state = "odisha", district, tahasil, village, khata_number, plot_number }) {
  return [
    state,
    district,
    tahasil,
    village,
    khata_number,
    plot_number,
  ].map((part) => normalizeIdentifier(part || "unknown")).join(":");
}

export function yearsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return null;
  return Math.abs(end - start) / (365.25 * 24 * 60 * 60 * 1000);
}

export function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return null;
  return Math.abs(end - start) / (24 * 60 * 60 * 1000);
}

const WGS84_DEGREE_TO_METER_AT_EQUATOR = 111_320;
const WGS84_DEGREE_TO_METER_AT_LATITUDE_FACTOR = (lat) => Math.cos((lat * Math.PI) / 180);

export function degreesSquaredToSquareMeters(areaDegreesSquared, latitude) {
  const numeric = Number(areaDegreesSquared);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  const lat = Number.isFinite(Number(latitude)) ? Number(latitude) : 0;
  const metersPerDeg = WGS84_DEGREE_TO_METER_AT_EQUATOR;
  const latScale = WGS84_DEGREE_TO_METER_AT_LATITUDE_FACTOR(lat);
  return numeric * Math.pow(metersPerDeg, 2) * latScale;
}

export function projectedRingSquareMeters(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return null;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    if (![x1, y1, x2, y2].every((n) => Number.isFinite(Number(n)))) return null;
    sum += Number(x1) * Number(y2) - Number(x2) * Number(y1);
  }
  return Math.abs(sum) / 2;
}

export function projectedPolygonSquareMeters(polygon) {
  if (!polygon) return null;
  const coords = Array.isArray(polygon.coordinates) ? polygon.coordinates : polygon;
  if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null;
  return projectedRingSquareMeters(coords[0]);
}

export function wfsShapeAreaToSquareMeters({ shapeArea, geomtxt, latitude, geometry, srid = "web_mercator" }) {
  const reasons = [];
  if (geomtxt) {
    let parsed = null;
    try {
      parsed = typeof geomtxt === "string" ? JSON.parse(geomtxt) : geomtxt;
    } catch (err) {
      reasons.push("geomtxt_unparseable");
    }
    if (parsed) {
      const fromRing = projectedPolygonSquareMeters(parsed);
      if (Number.isFinite(fromRing) && fromRing > 0) {
        return { squareMeters: fromRing, method: "projected_ring_shoelace", srid, reasons };
      }
      reasons.push("projected_ring_invalid");
    }
  }
  if (geometry) {
    const fromGeom = projectedPolygonSquareMeters(geometry);
    if (Number.isFinite(fromGeom) && fromGeom > 0) {
      return { squareMeters: fromGeom, method: "projected_ring_shoelace", srid, reasons };
    }
    reasons.push("geometry_invalid");
  }
  if (Number.isFinite(Number(shapeArea)) && Number(shapeArea) > 0 && Number(shapeArea) < 1) {
    const m2 = degreesSquaredToSquareMeters(shapeArea, latitude);
    if (Number.isFinite(m2) && m2 > 0) {
      return { squareMeters: m2, method: "degrees_squared_to_m2", srid, reasons: [...reasons, "fallback_degrees_squared"] };
    }
  }
  return { squareMeters: null, method: "unknown", srid, reasons: [...reasons, "no_input_units_recognized"] };
}
