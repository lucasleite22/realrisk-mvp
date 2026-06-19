// Importa imoveis de uma planilha privada do Google Sheets e gera o conteudo de data.js
//
// Setup necessario (ver SETUP-GOOGLE.md para o passo a passo completo):
// 1. Criar uma Service Account no Google Cloud Console, baixar a chave JSON.
// 2. Compartilhar a planilha do Google Sheets com o e-mail da Service Account (acesso de leitura).
// 3. Habilitar a Google Sheets API no projeto.
// 4. Definir as variaveis de ambiente abaixo (ou um arquivo .env, nao versionado).
//
// Variaveis de ambiente:
//   GOOGLE_SERVICE_ACCOUNT_KEY_FILE = caminho para o JSON da service account
//   GOOGLE_SHEET_ID                = ID da planilha (da URL: /d/{ID}/edit)
//   GOOGLE_SHEET_RANGE              = ex: "Imoveis!A1:T200" (primeira linha = header)
//
// Uso: node import-sheets.js > data.js
//      node import-sheets.js --no-enrich > data.js

const fs = require("fs");
const { rowToProperty, enrichAll, toJsModule } = require("./lib/property-import");

async function getAccessToken(keyFilePath) {
  const { JWT } = require("google-auth-library");
  const key = JSON.parse(fs.readFileSync(keyFilePath, "utf8"));
  const client = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
  const { token } = await client.getAccessToken();
  return token;
}

async function fetchSheetRows(sheetId, range, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API respondeu ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.values || [];
}

function rowsToObjects(rows) {
  const [header, ...dataRows] = rows;
  return dataRows
    .filter(r => r.some(cell => cell !== ""))
    .map(r => {
      const obj = {};
      header.forEach((key, i) => { obj[key.trim()] = (r[i] || "").trim(); });
      return obj;
    });
}

async function main() {
  const noEnrich = process.argv.includes("--no-enrich");
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const range = process.env.GOOGLE_SHEET_RANGE || "Imoveis!A1:T500";

  if (!keyFile || !sheetId) {
    process.stderr.write(
      "Defina GOOGLE_SERVICE_ACCOUNT_KEY_FILE e GOOGLE_SHEET_ID (ver SETUP-GOOGLE.md).\n" +
      "Uso: GOOGLE_SERVICE_ACCOUNT_KEY_FILE=chave.json GOOGLE_SHEET_ID=... node import-sheets.js > data.js\n"
    );
    process.exit(1);
  }

  const token = await getAccessToken(keyFile);
  const rawRows = await fetchSheetRows(sheetId, range, token);
  const objectRows = rowsToObjects(rawRows);
  let properties = objectRows.map(rowToProperty).filter(Boolean);
  properties = await enrichAll(properties, noEnrich);

  process.stderr.write(`${properties.length} imoveis importados de ${objectRows.length} linhas da planilha.\n`);
  process.stdout.write(toJsModule(properties, "import-sheets.js (Google Sheets)"));
}

main().catch(e => {
  process.stderr.write(`Erro: ${e.message}\n`);
  process.exit(1);
});
