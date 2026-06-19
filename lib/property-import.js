// Logica compartilhada de importacao de imoveis (nicho residencial)
// Usada por import-csv.js e import-sheets.js

const REQUIRED = ["address", "city", "zip", "price", "sqft"];

const NUMERIC_FIELDS = [
  "lat", "lng", "price", "sqft", "bedrooms", "bathrooms", "yearBuilt",
  "daysOnMarket", "hoaMonthly", "propertyTaxAnnual", "capexEstimated",
  "arvEstimated", "roofAgeYears", "hvacAgeYears"
];

const BOOLEAN_FIELDS = ["strAllowed"];

const NOMINATIM_USER_AGENT = "RealRisk-MVP-Import/1.0 (contato interno)";
const NOMINATIM_DELAY_MS = 1100; // respeita o limite de 1 req/seg da Nominatim
const FEMA_NFHL_FLOOD_ZONE_LAYER =
  "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query";

function rowToProperty(row, index) {
  const missing = REQUIRED.filter(f => !row[f]);
  if (missing.length > 0) {
    process.stderr.write(`Linha ${index + 2}: pulada (faltando ${missing.join(", ")})\n`);
    return null;
  }

  const p = { id: index + 1 };
  for (const key of Object.keys(row)) {
    if (key === "") continue;
    let value = row[key];
    if (NUMERIC_FIELDS.includes(key)) {
      value = value === "" || value == null ? null : Number(value);
    } else if (BOOLEAN_FIELDS.includes(key)) {
      value = /^(true|1|yes|sim)$/i.test(String(value));
    }
    p[key] = value;
  }
  return p;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeAddress(p) {
  const query = encodeURIComponent(`${p.address}, ${p.city}, FL ${p.zip}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`);
  const results = await res.json();
  if (results.length === 0) return null;
  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}

async function lookupFloodZone(lat, lng) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "FLD_ZONE",
    returnGeometry: "false",
    f: "json"
  });
  const res = await fetch(`${FEMA_NFHL_FLOOD_ZONE_LAYER}?${params}`);
  if (!res.ok) throw new Error(`FEMA NFHL respondeu ${res.status}`);
  const data = await res.json();
  const zone = data.features && data.features[0] && data.features[0].attributes.FLD_ZONE;
  return zone || null;
}

async function enrichProperty(p) {
  if (p.lat == null || p.lng == null || Number.isNaN(p.lat) || Number.isNaN(p.lng)) {
    try {
      const coords = await geocodeAddress(p);
      await sleep(NOMINATIM_DELAY_MS);
      if (coords) {
        p.lat = coords.lat;
        p.lng = coords.lng;
        process.stderr.write(`  geocoded: ${p.address} -> ${coords.lat}, ${coords.lng}\n`);
      } else {
        process.stderr.write(`  AVISO: nao foi possivel geocodificar "${p.address}"\n`);
      }
    } catch (e) {
      process.stderr.write(`  AVISO: erro ao geocodificar "${p.address}": ${e.message}\n`);
    }
  }

  if (!p.floodZone && p.lat != null && p.lng != null) {
    try {
      const zone = await lookupFloodZone(p.lat, p.lng);
      if (zone) {
        p.floodZone = zone;
        process.stderr.write(`  flood zone (FEMA): ${p.address} -> ${zone}\n`);
      } else {
        process.stderr.write(`  AVISO: FEMA NFHL nao retornou zona para "${p.address}"\n`);
      }
    } catch (e) {
      process.stderr.write(`  AVISO: erro ao consultar FEMA NFHL para "${p.address}": ${e.message}\n`);
    }
  }

  return p;
}

async function enrichAll(properties, noEnrich) {
  if (noEnrich) return properties;
  process.stderr.write("Enriquecendo (geocoding + flood zone)...\n");
  for (const p of properties) {
    await enrichProperty(p);
  }
  return properties;
}

function toJsModule(properties, sourceLabel) {
  const body = properties.map(p => "  " + JSON.stringify(p, null, 2).replace(/\n/g, "\n  ")).join(",\n");
  return `// Dataset importado via ${sourceLabel}\n` +
    `// Gerado em ${new Date().toISOString()}\n\n` +
    `const PROPERTIES = [\n${body}\n];\n`;
}

module.exports = { rowToProperty, enrichAll, toJsModule, REQUIRED, NUMERIC_FIELDS, BOOLEAN_FIELDS };
