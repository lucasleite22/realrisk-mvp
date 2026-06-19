// Importa um export de MLS (CSV) e gera o conteudo de data.js
// Uso: node import-csv.js caminho/para/export.csv > data.js
//      node import-csv.js caminho/para/export.csv --no-enrich > data.js   (pula geocoding/flood lookup)
//
// O CSV deve ter o cabecalho exato definido em template-residential.csv.
// Linhas com campos obrigatorios vazios sao puladas (e reportadas no stderr).
//
// Enriquecimento automatico (a menos que --no-enrich seja passado):
// - lat/lng ausentes: geocoding via Nominatim (OpenStreetMap), gratuito, 1 req/seg
// - floodZone ausente: lookup via FEMA NFHL (National Flood Hazard Layer), gratuito

const fs = require("fs");

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

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(l => l.trim().length > 0);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    const row = {};
    header.forEach((key, i) => { row[key.trim()] = (cells[i] || "").trim(); });
    return row;
  });
}

// Minimal CSV line splitter supporting double-quoted fields with commas
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function toProperty(row, index) {
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
      value = value === "" ? null : Number(value);
    } else if (BOOLEAN_FIELDS.includes(key)) {
      value = /^(true|1|yes|sim)$/i.test(value);
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

function toJsModule(properties) {
  const body = properties.map(p => "  " + JSON.stringify(p, null, 2).replace(/\n/g, "\n  ")).join(",\n");
  return `// Dataset importado via import-csv.js — fonte: export MLS do Jales\n` +
    `// Gerado em ${new Date().toISOString()}\n\n` +
    `const PROPERTIES = [\n${body}\n];\n`;
}

async function main() {
  const csvPath = process.argv[2];
  const noEnrich = process.argv.includes("--no-enrich");
  if (!csvPath) {
    process.stderr.write("Uso: node import-csv.js caminho/para/export.csv [--no-enrich] > data.js\n");
    process.exit(1);
  }
  const text = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  let properties = rows.map(toProperty).filter(Boolean);

  if (!noEnrich) {
    process.stderr.write("Enriquecendo (geocoding + flood zone)...\n");
    for (const p of properties) {
      await enrichProperty(p);
    }
  }

  process.stderr.write(`${properties.length} imoveis importados de ${rows.length} linhas.\n`);
  process.stdout.write(toJsModule(properties));
}

main();
