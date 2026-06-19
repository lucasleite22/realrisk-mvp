// Importa um export de MLS (CSV) e gera o conteudo de data.js
// Uso: node import-csv.js caminho/para/export.csv > data.js
//
// O CSV deve ter o cabecalho exato definido em template-residential.csv.
// Linhas com campos obrigatorios vazios sao puladas (e reportadas no stderr).

const fs = require("fs");

const REQUIRED = ["address", "city", "zip", "lat", "lng", "price", "sqft"];

const NUMERIC_FIELDS = [
  "lat", "lng", "price", "sqft", "bedrooms", "bathrooms", "yearBuilt",
  "daysOnMarket", "hoaMonthly", "propertyTaxAnnual", "capexEstimated",
  "arvEstimated", "roofAgeYears", "hvacAgeYears"
];

const BOOLEAN_FIELDS = ["strAllowed"];

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

function toJsModule(properties) {
  const body = properties.map(p => "  " + JSON.stringify(p, null, 2).replace(/\n/g, "\n  ")).join(",\n");
  return `// Dataset importado via import-csv.js — fonte: export MLS do Jales\n` +
    `// Gerado em ${new Date().toISOString()}\n\n` +
    `const PROPERTIES = [\n${body}\n];\n`;
}

function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    process.stderr.write("Uso: node import-csv.js caminho/para/export.csv > data.js\n");
    process.exit(1);
  }
  const text = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  const properties = rows.map(toProperty).filter(Boolean);

  process.stderr.write(`${properties.length} imoveis importados de ${rows.length} linhas.\n`);
  process.stdout.write(toJsModule(properties));
}

main();
