# RealRisk MVP

Plataforma de identificacao e analise de oportunidades imobiliarias na Florida (regiao de Orlando).

MVP em HTML/CSS/JS vanilla, sem build step, pronto para deploy em qualquer hosting estatico (GitHub Pages, Netlify, Vercel).

## Estrutura de arquivos

Coloque todos esses arquivos na raiz do seu repositorio:

```
realrisk-mvp/
├── index.html      # markup principal
├── styles.css      # estilos (variaveis CSS no topo - facil de re-tema)
├── data.js         # dataset de exemplo com 20 imoveis
├── scoring.js      # engine de scoring (ROI, risco, niveis)
├── app.js          # logica de UI, filtros, mapa, modal
└── README.md       # este arquivo
```

## Como rodar localmente

Como tudo e estatico, basta abrir o index.html no navegador. Mas o Leaflet (mapa) precisa de servidor para funcionar bem com tile providers. Use qualquer servidor local:

**Com Python:**
```bash
cd realrisk-mvp
python -m http.server 8000
```
Abra http://localhost:8000

**Com Node:**
```bash
npx serve
```

**Com VS Code:**
Instale a extensao "Live Server" e clique direito no index.html > "Open with Live Server".

## Como subir no git e deploy no GitHub Pages

### 1. Criar repositorio
```bash
cd realrisk-mvp
git init
git add .
git commit -m "feat: initial MVP - dashboard, scoring, map, list views"
git branch -M main
```

### 2. Criar repo no GitHub
Va em github.com/new, crie um repo (ex: `realrisk-mvp`), e conecte:
```bash
git remote add origin https://github.com/SEU_USUARIO/realrisk-mvp.git
git push -u origin main
```

### 3. Ativar GitHub Pages
1. No repo no GitHub: Settings > Pages
2. Source: Deploy from a branch
3. Branch: main, folder: / (root)
4. Save

Em ~1 minuto, o site estara em `https://SEU_USUARIO.github.io/realrisk-mvp/`

## Funcionalidades implementadas

### Filtros (sidebar)
- Niveis 1/2/3 (toggle por chip)
- Faixa de preco (min/max)
- ROI minimo (slider)
- Cidade
- Apenas zona Flood X (sem risco de inundacao)
- Apenas STR/Airbnb permitido
- Busca livre por endereco/cidade/ZIP (topbar)

### Calibracao de criterios (sidebar)
- Sliders de peso para Score Financeiro vs Score Risco
- Total fixo em 100% (mover um ajusta o outro)
- Re-rankeia todos os imoveis em tempo real
- Persiste em localStorage

### Tres modos de visualizacao
- **Cards**: grid responsivo com metricas-chave e badges de risco
- **Mapa**: Leaflet + OpenStreetMap, pinos coloridos por nivel, popup com info
- **Lista**: tabela densa com sorting (em desenvolvimento - dropdown ja funciona)

### Modal de detalhe
- Abre ao clicar em qualquer card ou linha
- Mostra todos os calculos (CAPEX, closing, all-in, lucro, ROI)
- Scores detalhados (financeiro + risco + total)
- Descricao do imovel
- Botao "Sinalizar interesse" (placeholder para mecanica de bloqueio de deal)

### Watchlist
- Botao de coracao em cada card
- Contador no topo
- Persiste em localStorage entre sessoes

### Stats agregados
- Atualizam em tempo real conforme filtros
- Total visivel, Nivel 1 count, ROI medio, $/sqft medio

## Como importar dados reais (export MLS)

1. Peca ao Jales (ou exporte do MLS/SimplyRETS) um CSV no formato de `template-residential.csv` (cabecalho fixo, uma linha por imovel). `lat`, `lng` e `floodZone` podem ficar em branco — sao preenchidos automaticamente (ver abaixo).
2. Rode: `node import-csv.js caminho/para/export.csv > data.js`
3. Linhas com campos obrigatorios (address, city, zip, price, sqft) vazios sao puladas e reportadas no terminal — confira antes de commitar.
4. Abra `index.html` (com servidor local) e valide visualmente os scores antes de subir para staging.

Esse fluxo cobre apenas o nicho **residencial** (Fix & Flip / STR), que e o schema que o dashboard atual suporta. Os criterios de Farmland e Ranch que o Jales definiu (`RealRisk — Criterios de Elegibilidade..._rev1.pdf`) usam metricas completamente diferentes (acres, zoneamento, well/septic, potencial de desmembramento) e ainda nao tem schema, scoring nem UI no dashboard — e uma frente separada a ser planejada quando esses nichos entrarem em escopo.

### Enriquecimento automatico (geocoding + flood zone)

Por padrao, `import-csv.js` completa campos ausentes antes de gerar o `data.js`:
- **lat/lng**: geocoding via Nominatim (OpenStreetMap), gratuito, sem API key. Respeita o limite de 1 requisicao/segundo do servico publico.
- **floodZone**: lookup via FEMA NFHL (National Flood Hazard Layer), API publica gratuita, sem API key.

Use `node import-csv.js export.csv --no-enrich > data.js` para pular esse enriquecimento (mais rapido, util para testes).

> Nota: o lookup de FEMA NFHL (`hazards.fema.gov`) pode estar bloqueado em redes corporativas/sandboxes restritivas — teste localmente se receber erros de conexao. O geocoding via Nominatim foi validado e funciona normalmente.

## Como trocar os dados

Edite `data.js` manualmente, ou prefira o importador acima. Cada imovel tem o seguinte schema:

```javascript
{
  id: 1,                    // unico, numerico
  address: "...",
  city: "Orlando",
  zip: "32827",
  lat: 28.3744,             // coordenadas para mapa
  lng: -81.2469,
  price: 285000,            // preco pedido
  sqft: 1650,
  bedrooms: 3,
  bathrooms: 2,
  yearBuilt: 2002,
  daysOnMarket: 12,
  hoaMonthly: 65,
  propertyTaxAnnual: 3200,
  capexEstimated: 35000,    // estimativa de reforma
  arvEstimated: 415000,     // valor pos-reforma
  floodZone: "X",           // X, A, AE, VE
  roofAgeYears: 3,
  hvacAgeYears: 5,
  strAllowed: true,
  description: "..."
}
```

Todos os calculos (ROI, scores, niveis) sao feitos automaticamente pelo `scoring.js`.

## Como ajustar a logica de scoring

Tudo esta em `scoring.js`. Os pontos-chave:

- `enrichProperty()`: calcula closing, all-in, profit, ROI e scores
- `CLOSING_COSTS_PCT`: padrao 5%, ajuste para a realidade local
- Thresholds de ROI para o score financeiro (25%, 20%, 15%, 10%)
- Pontuacao de cada fator de risco (flood zone, roof age, HVAC age, STR)
- `getRiskFlags()`: define quais badges aparecem nos cards

## Proximos passos sugeridos

- [ ] Sorting nas colunas da lista (clicar header ordena)
- [ ] Tela/modal de watchlist (em vez do alert)
- [ ] Tema dark mode (variaveis CSS ja preparadas)
- [ ] Logica de bloqueio de deal (mecanica de comunidade)
- [ ] Integracao com fonte de dados real (Zillow scraper, Apify ou MLS)
- [ ] Upload de fotos por imovel
- [ ] Camada de visualizacao 3D (link para video do arquiteto parceiro)
- [ ] Branding e identidade visual (logo, paleta definitiva, tipografia)
- [ ] Sistema de login e niveis de acesso (comunidade paga)
- [ ] Geracao de relatorio PDF de analise de risco por imovel

## Stack

- HTML/CSS/JS vanilla (zero dependencias de build)
- Leaflet 1.9.4 (mapa, via CDN)
- OpenStreetMap (tiles do mapa, gratis)
- LocalStorage para persistencia de preferencias

## Notas

- Os 20 imoveis em `data.js` sao ficticios, com coordenadas reais dos bairros de Orlando. Substitua por dados reais antes de qualquer demo.
- Os calculos de scoring estao calibrados para o mercado da Florida (focando em flood zones e idade de roof/HVAC). Ajuste em `scoring.js` para outras regioes.
- Sem rastreamento, sem analytics. Adicione conforme necessario.
