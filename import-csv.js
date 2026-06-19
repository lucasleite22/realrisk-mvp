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
const { rowToProperty, enrichAll, toJsModule } = require("./lib/property-import");

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

async function main() {
  const csvPath = process.argv[2];
  const noEnrich = process.argv.includes("--no-enrich");
  if (!csvPath) {
    process.stderr.write("Uso: node import-csv.js caminho/para/export.csv [--no-enrich] > data.js\n");
    process.exit(1);
  }
  const text = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  let properties = rows.map(rowToProperty).filter(Boolean);
  properties = await enrichAll(properties, noEnrich);

  process.stderr.write(`${properties.length} imoveis importados de ${rows.length} linhas.\n`);
  process.stdout.write(toJsModule(properties, "import-csv.js (export MLS)"));
}

main();
