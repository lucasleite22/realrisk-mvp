# Setup Google Cloud — Maps, Distance Matrix e Sheets

Guia para habilitar as integracoes opcionais do RealRisk que dependem de APIs do Google.
Nenhuma delas e obrigatoria para o dashboard funcionar — sem isso, continua tudo no
Leaflet/OpenStreetMap (gratuito) e na importacao via CSV (`import-csv.js`).

## 1. Criar o projeto e habilitar billing

1. Acesse https://console.cloud.google.com/ e crie um projeto novo (ex: `realrisk-mvp`).
2. Vá em **Billing** e vincule um cartao. As APIs abaixo tem cota gratuita mensal
   (Maps/Distance Matrix: ~$200 de credito/mes via Google Maps Platform), mas exigem
   billing habilitado mesmo para usar a cota gratuita.

## 2. API Key para Maps / Distance Matrix

1. No menu lateral, vá em **APIs & Services > Library**.
2. Habilite: **Maps JavaScript API** e **Distance Matrix API** (busque pelo nome).
3. Vá em **APIs & Services > Credentials > Create Credentials > API Key**.
4. **Restrinja a key** (importante, evita uso indevido se a key for exposta no front-end):
   - Application restrictions: HTTP referrers — adicione o dominio onde o site vai rodar
     (ex: `https://*.github.io/*` ou o dominio do Vercel/Netlify escolhido).
   - API restrictions: limite as duas APIs habilitadas no passo 2.
5. Copie a key gerada. Quando for usar no front-end (`app.js`/`index.html`), ela fica
   visivel no código-fonte do navegador — isso e esperado para Maps JS API, e por isso
   a restricao por dominio no passo 4 e essencial.

Quando tiver a key, me envie (ou cole direto no `index.html`/variavel de config) que eu
faço a troca do Leaflet pelo Google Maps e/ou adiciono o calculo de distancia (ex:
minutos até a Disney, que o Jales mencionou como criterio de STR) via Distance Matrix.

## 3. Service Account para Google Sheets (planilha privada)

1. No mesmo projeto, vá em **APIs & Services > Library** e habilite **Google Sheets API**.
2. Vá em **IAM & Admin > Service Accounts > Create Service Account**.
   - Nome: ex `realrisk-sheets-reader`.
   - Não precisa de nenhuma role de projeto (a permissão é dada na planilha, não no projeto).
3. Na lista de service accounts, clique na conta criada > aba **Keys** > **Add Key > Create
   new key > JSON**. Isso baixa um arquivo `.json` — **trate como senha, nunca commite**
   (o `.gitignore` já bloqueia `*.key.json` e `google-service-account*.json`).
4. Copie o campo `client_email` desse JSON (algo como
   `realrisk-sheets-reader@realrisk-mvp.iam.gserviceaccount.com`).
5. Abra a planilha do Jales no Google Sheets > **Compartilhar** > cole esse e-mail com
   permissão de **Leitor**.
6. Pegue o ID da planilha na URL: `https://docs.google.com/spreadsheets/d/{ESTE_ID}/edit`.

### Rodando a importação

```bash
npm install
export GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/caminho/para/chave.json
export GOOGLE_SHEET_ID=o_id_da_planilha
export GOOGLE_SHEET_RANGE="Imoveis!A1:T500"   # nome da aba + range
node import-sheets.js > data.js
```

A primeira linha da planilha deve ter os mesmos nomes de coluna do
`template-residential.csv` (address, city, zip, price, sqft, etc.).

## Status atual

- [ ] Projeto Google Cloud criado
- [ ] Billing habilitado
- [ ] Maps JavaScript API + Distance Matrix API habilitadas
- [ ] API Key criada e restringida
- [ ] Google Sheets API habilitada
- [ ] Service Account criada, JSON baixado
- [ ] Planilha do Jales compartilhada com a Service Account
