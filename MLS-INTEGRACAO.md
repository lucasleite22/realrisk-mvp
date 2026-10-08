# RealRisk ↔ MLS — Guia de Integração

> Leia este arquivo inteiro antes de escrever qualquer código que envolva dados do MLS no RealRisk.
> Última atualização: 02/Out/2026

## TL;DR

1. **O RealRisk NUNCA chama a API da MLSGrid diretamente.** A única porta de entrada para o MLS é o projeto **4Rivers** (`../4Rivers Realty/4River REalty`), que já sincroniza o feed para o banco dele.
2. O RealRisk consome os dados **do banco/API do 4Rivers** — via endpoint JSON (para o dashboard) e via export Excel (para gestão).
3. Antes disso funcionar, o 4Rivers precisa de 3 ajustes: **condados**, **campos extras** e **endpoints para o RealRisk** (ver "Tarefas").

---

## 1. Por que não chamar a MLSGrid direto

| Restrição | Consequência |
|---|---|
| Limite real da assinatura: **2 req/s** (não os 4 req/s públicos). O token **já foi suspenso uma vez** (29/Set/2026) por um burst de 9 req/s. | Um segundo consumidor do mesmo token (o RealRisk) pode suspender o token e derrubar o portal do 4Rivers junto. |
| MLSGrid é API de **replicação**, não de busca. `$filter` só aceita: `MlgCanView`, `ModificationTimestamp`, `OriginatingSystemName`, `StandardStatus`, `ListingId`, `PropertyType`, `ListOfficeMlsId`. | Não existe "me dê os imóveis de Orlando abaixo de $400k". Filtro por condado/cidade/preço dá **400 Invalid filter field**. Tudo isso é filtrado no **nosso banco**. |
| Só existe acesso a `OriginatingSystemName eq 'mfrmls'` (Stellar MLS). | Qualquer outro MLS retorna 403. Stellar cobre Orlando e Ocala, então serve para os dois produtos. |
| URLs de foto (`media.mlsgrid.com`) são assinadas e expiram em horas. | Não salvar URL de foto do MLS no RealRisk. |

Se em algum momento for **inevitável** tocar a API (ex.: inspecionar o payload completo de um listing), use `fetchPropertyByKey()` de `services/mlsgrid.service.ts` no projeto 4Rivers, que já passa pelo `throttle()` de 600 ms. **Nunca** escreva um `fetch()` em loop num script avulso.

---

## 2. Arquitetura

```
MLSGrid (mfrmls)
   │  cron diário 06:00 UTC + reconcile semanal (4Rivers, Vercel)
   ▼
4Rivers — lib/mls-sync.ts  ──►  MySQL/TiDB (Prisma)
                                   ├─ properties          (portal 4Rivers, Marion/Sumter, curado)
                                   └─ mls_listings  [NOVO] (dados analíticos p/ RealRisk)
                                          │
              ┌───────────────────────────┴────────────────────────┐
              ▼                                                    ▼
GET /api/realrisk/listings  (JSON)                  GET /api/realrisk/export  (.xlsx)
              │                                                    │
              ▼                                                    ▼
RealRisk dashboard (scoring.js)                     Planilha de gestão (Lucas/Jales)
```

### Por que uma tabela nova (`mls_listings`) e não reaproveitar `properties`

A tabela `properties` é o **inventário curado do portal 4Rivers**: cada listing novo entra na fila de aprovação (`showOnPortal: false`), tem fotos re-hospedadas no Vercel Blob (consome quota do plano Hobby) e o enum `type` é pensado para haras/ranchos. Jogar milhares de casas de Orlando ali:

- polui a fila de curadoria do admin do 4Rivers;
- estoura a quota do Blob com fotos que ninguém vai ver;
- estoura o limite de 60s do cron (cada listing novo baixa fotos).

`mls_listings` guarda **só dados**, sem fotos, sem curadoria. É upsert puro, rápido.

**Custo de API extra: zero.** O sync já percorre o feed inteiro do `mfrmls` e filtra condado em memória (`TARGET_COUNTIES` em `lib/mls-sync.ts`). Gravar também os condados do RealRisk é só mais um `upsert` no mesmo loop — nenhuma requisição a mais para a MLSGrid.

---

## 3. Lacunas atuais no 4Rivers

### 3.1 Cobertura geográfica — ✅ DECIDIDO (02/Out/2026)
`lib/mls-sync.ts` → `TARGET_COUNTIES = ['Marion', 'Sumter']` (portal 4Rivers, não mexer).

**Fonte:** `RealRisk — Critérios de Elegibilidade _ Para preenchimento de Jales Castro_rev1.pdf`, **somente a coluna "Sua definição"** (a coluna "Sugestão inicial" e os textos de exemplo/placeholder NÃO são decisão do Jales e não devem ser usados).

| Nicho | Condados definidos pelo Jales |
|---|---|
| Fix & Flip | Sumter, Marion, Lake, Polk |
| STR | *(não preenchido — só marcou "STR legalmente permitido: obrigatório")* |
| Farmland | Sumter, Polk, Lake, Pasco, Marion |
| Ranch | Sumter, Lake, Marion, Pasco, Polk |

```ts
export const REALRISK_COUNTIES = ['Sumter', 'Marion', 'Lake', 'Polk', 'Pasco']
```

⚠️ **Orange, Osceola e Seminole ficam de fora** — eram só a sugestão inicial do formulário. Atenção a dois pontos para revisar com o Jales:
- Ele citou **Winter Garden** como ZIP preferido no Flip, mas Winter Garden fica em **Orange**, que ele não marcou.
- STR ficou sem condado. Os imóveis STR próximos à Disney do lado de **Polk** (Davenport/ChampionsGate) já entram; Kissimmee (Osceola) não.

Gravar em `mls_listings` **todos os `PropertyType`** desses condados (Residential, Land, Farm…) — o filtro por nicho (preço, tipo, acres) é feito no RealRisk, não na ingestão. Custo de API é o mesmo: o filtro de condado é em memória de qualquer jeito.

### 3.2 Campos que o RealRisk precisa e o 4Rivers não grava hoje

Hoje `mapListingToPropertyData()` só grava preço, endereço, cidade, condado, lat/lng, quartos, banheiros, sqft, ano, acres, descrição. Falta:

| Campo RealRisk (`template-residential.csv`) | Campo RESO / MLSGrid | Observação |
|---|---|---|
| `id` | `ListingKey` (chave) + `ListingId` (nº MLS visível) | Usar `ListingKey` como id estável |
| `address` | `UnparsedAddress` | |
| `city` | `City` | |
| `zip` | `PostalCode` | |
| `lat` / `lng` | `Latitude` / `Longitude` | Quase sempre vem — dispensa Nominatim |
| `price` | `ListPrice` | |
| `sqft` | `LivingArea` | |
| `bedrooms` | `BedroomsTotal` | |
| `bathrooms` | `BathroomsTotalInteger` | |
| `yearBuilt` | `YearBuilt` | |
| `daysOnMarket` | `DaysOnMarket` / `CumulativeDaysOnMarket` | Se vier vazio: `hoje − ListingContractDate` |
| `hoaMonthly` | ✅ `MFR_MonthlyHOAAmount` (já mensal) | Fallback: `AssociationFee` + `AssociationFeeFrequency` normalizado. Somar `MFR_MontlyMaintAmtAdditionToHOA` |
| `propertyTaxAnnual` | `TaxAnnualAmount` (+ `TaxYear`) | |
| `floodZone` | ✅ `MFR_FloodZoneCode` (+ `MFR_FloodZonePanel`, `MFR_FloodZoneDate`) | Preenchido em 100/100 da amostra. FEMA NFHL vira só fallback |
| `strAllowed` | ⚠️ proxy: `MFR_LeaseRestrictionsYN` + `MFR_MinimumLease` (+ `MFR_AdditionalLeaseRestrictions`) | `MinimumLease = "No Minimum"` e sem restrição → provável STR ok; "1 Month"+ → não. É restrição de HOA, **não** zoneamento — Jales marcou STR como obrigatório, então manter confirmação manual |
| `roofAgeYears` / `hvacAgeYears` | ❌ não existe (só `Roof` = material, `Cooling`/`Heating` = tipo) | 34/100 das `PublicRemarks` citam roof/A-C/HVAC — extração por regex é possível depois. Manual por ora |
| `capexEstimated` / `arvEstimated` | — | Calculados pelo RealRisk, não vêm do MLS |
| `description` | `PublicRemarks` | |

Campos que respondem aos green flags do Jales (Farmland/Ranch — "água, poço artesiano, tanque séptico, energia, utilities"):
`WaterSource` (Public / Well), `Sewer` (Septic Tank / Public Sewer), `Utilities` (Electricity Available…), `LotFeatures` (Paved, In County, Pasture, Cleared…), `Zoning`, `MFR_TotalAcreage`, `MFR_AGExemptionYN`.

Campos extras úteis para gestão (Excel) e scoring:
`StandardStatus`, `PropertyType`, `PropertySubType`, `OriginalListPrice` (detectar redução de preço), `ListingContractDate`, `ModificationTimestamp`, `LotSizeAcres`, `LotSizeSquareFeet`, `PoolPrivateYN`, `Zoning`, `ListOfficeName`, `ListAgentFullName`, `MlgCanUse`.

**✅ Feito em 02/Out/2026** (1 requisição, página de 100 Residential Active, 321 campos). ~~Primeiro passo prático:~~ inspecionar **um** payload completo (`fetchPropertyByKey(key, [])` — 1 requisição, com throttle) de um listing residencial de Orange County para descobrir quais `MFR_*` existem para flood zone, restrição de aluguel e telhado. Documentar o resultado aqui na tabela acima.

### 3.3 Comparáveis vendidos (para ARV) — fase 2
O sync ignora listings que **já chegam** `Closed` (`skippedAlreadySold`), porque no portal isso seria anunciar venda de terceiros. Para o RealRisk, vendas fechadas são exatamente o que precisamos para estimar **ARV** por comparáveis. Na tabela `mls_listings` essa regra **não se aplica**: gravar `Closed` com `ClosePrice` e `CloseDate` (janela sugerida: últimos 12 meses). Não fazer agora — só depois do MVP com ativos funcionar.

---

## 4. Schema sugerido (`prisma/schema.prisma` do 4Rivers)

```prisma
model MlsListing {
  listingKey            String    @id            // ListingKey
  listingId             String                   // nº MLS visível
  standardStatus        String                   // Active | Pending | Active Under Contract | Closed | ...
  propertyType          String
  propertySubType       String?
  listPrice             Decimal?  @db.Decimal(15, 2)
  originalListPrice     Decimal?  @db.Decimal(15, 2)
  closePrice            Decimal?  @db.Decimal(15, 2)
  closeDate             DateTime?
  listingContractDate   DateTime?
  daysOnMarket          Int?
  address               String?
  city                  String?
  county                String?
  postalCode            String?
  latitude              Float?
  longitude             Float?
  bedrooms              Int?
  bathrooms             Int?
  livingArea            Int?
  lotSizeAcres          Decimal?  @db.Decimal(10, 2)
  yearBuilt             Int?
  hoaMonthly            Decimal?  @db.Decimal(10, 2)
  taxAnnual             Decimal?  @db.Decimal(10, 2)
  poolPrivate           Boolean?
  zoning                String?
  floodZone             String?
  publicRemarks         String?   @db.Text
  listOfficeName        String?
  listAgentFullName     String?
  mlgCanUse             String?                  // ex.: "IDX,VOW"
  modificationTimestamp DateTime
  firstSeenAt           DateTime  @default(now()) // = "cadastrado" do nosso ponto de vista
  updatedAt             DateTime  @updatedAt

  @@index([county])
  @@index([standardStatus])
  @@index([firstSeenAt])
  @@index([listingContractDate])
  @@map("mls_listings")
}
```

Regras de compliance que **também valem** para esta tabela (copiar de `upsertListing`):
- `MlgCanView === false` → **deletar** o registro (não só esconder).
- Listings que nunca tiveram `MlgCanView` não entram.

---

## 5. Endpoints a criar no 4Rivers

Ambos protegidos por `requireAuth()` (`lib/auth.ts`, cookie `4rivers_session`) — nunca públicos.

### `GET /api/realrisk/listings`
JSON já no formato de `template-residential.csv` (mesmos nomes de campo do `data.js`), para o `scoring.js` consumir sem adaptação.
Query params: `county`, `status` (default `Active`), `minPrice`, `maxPrice`, `type`, `since` (ISO — só listings com `firstSeenAt >= since`), `limit`.

### `GET /api/realrisk/export`
Excel gerado com os helpers já existentes em `lib/excel.ts` (`addLogoHeader`, `styleHeader`, `styleDataRows`, `exceljs`). Modelo: `app/api/export/properties/route.ts`.

Abas:

| Aba | Conteúdo |
|---|---|
| **Novos** | `firstSeenAt` nos últimos N dias (param `days`, default 7), ordem decrescente |
| **Ativos** | `standardStatus = Active` |
| **Sob contrato** | `Pending` / `Active Under Contract` |
| **Redução de preço** | `listPrice < originalListPrice`, ordenado pelo % de redução |
| **Saíram do mercado** | Withdrawn / Expired / Canceled nos últimos N dias |
| **Resumo** | Contagem por condado × status, preço mediano, $/sqft mediano, DOM médio |

Colunas por linha: MLS#, Status, Tipo/Subtipo, Endereço, Cidade, Condado, ZIP, Preço, Preço original, % redução, $/sqft, Quartos, Banheiros, Sqft, Acres, Ano, HOA/mês, Imposto/ano, DOM, Data de listagem, Primeira vez visto, Corretora, Corretor.

---

## 6. RealRisk dentro do site 4Rivers

O RealRisk hoje é HTML/JS vanilla estático (deploy próprio em `realrisk-mvp.vercel.app`). Para morar dentro do 4Rivers:

- **Recomendado:** servir o RealRisk numa rota do Next do 4Rivers (ex.: `/realrisk`, área logada), e o `app.js` faz `fetch('/api/realrisk/listings')` — mesma origem, o cookie de sessão vai junto, sem CORS, sem token exposto.
- `data.js` estático passa a ser só **fallback/mock** de desenvolvimento.
- `import-csv.js` / `import-sheets.js` continuam úteis para imóveis **off-market** que o Jales trouxer fora do MLS.
- Enriquecimento (FEMA flood zone, OSRM tempo até parques) deve rodar **uma vez por listing** e ser cacheado (coluna em `mls_listings` ou tabela própria) — não a cada carregamento do dashboard. Nominatim deixa de ser necessário porque o MLS já traz lat/lng.

---

## 7. Compliance (Stellar MLS / MLS Grid)

- Acordo assinado: `../4Rivers Realty/4River REalty/MLS/Stellar MLS Participant Data Access Agreement 2025.DOCX.pdf`. **Antes de distribuir a planilha para fora (investidores, sócios externos), confirmar no acordo** se export/redistribuição em planilha é permitido. Uso interno de gestão (Lucas/Jales) é o cenário mais seguro.
- `MlgCanUse` contém `IDX` → pode exibir publicamente. Só `VOW` → apenas para usuário logado com relação de cliente. O RealRisk, por ser ferramenta para investidores logados, se encaixa melhor como **VOW** — manter sempre atrás de login.
- Sempre exibir **corretora/corretor de origem** (`ListOfficeName` / `ListAgentFullName`) ao mostrar um listing do MLS.
- Dados não podem ficar mais velhos que ~72 h — o cron diário do 4Rivers já cobre isso; o RealRisk não deve manter cópia própria estática (por isso o `fetch` em runtime da seção 6).

---

## 8. Tarefas (ordem de execução)

**No 4Rivers** (`../4Rivers Realty/4River REalty`)
1. [x] Decidir `REALRISK_COUNTIES` com o Jales → `Sumter, Marion, Lake, Polk, Pasco` (ver 3.1).
2. [x] Inspecionar 1 payload completo de listing residencial em Orange County (com throttle) e preencher os `⚠️` da tabela 3.2.
3. [x] Adicionar o model `MlsListing` + migration (`20261002120000_realrisk_mls_listings`, branch `feat/realrisk-mls-listings`). Aplicada **só no MySQL local**. ⚠️ O `build` da Vercel roda `prisma migrate deploy` — o push desta branch aplica em produção.
4. [x] Em `lib/mls-sync.ts`, no mesmo loop de páginas: `upsertMlsListing()` para `CountyOrParish ∈ REALRISK_COUNTIES` (sem fotos, sem curadoria, respeitando `MlgCanView`).
5. [~] Backfill inicial com **cursor próprio** — `lib/realrisk-mls.ts` (`runRealriskSync`, cursor `mfrmls:realrisk`) + `npx tsx scripts/realrisk-mls-backfill.ts` (`--delta` para capturar Withdrawn/Closed depois; pausa sozinho 05:50–06:30 UTC). Rodando no banco local desde 02/Out/2026. O cursor do sync do 4Rivers (`MlsSyncState`, `originatingSystemName = 'mfrmls'`) já está avançado, e `runMlsSync` / `app/api/admin/mls-sync` sempre partem dele (não aceitam `modifiedSince`). Então os listings antigos dos condados novos nunca passariam pelo loop. Criar um segundo registro em `MlsSyncState` (ex.: `'mfrmls:realrisk'`) e um job de backfill que parte de `2020-01-01`, filtrando `StandardStatus` = Active/Pending/Active Under Contract para reduzir volume. O feed do Stellar inteiro é grande: a ~1,6 req/s × 100 listings/página, rodar o backfill **localmente** (sem o teto de 60s do Vercel), sempre via `fetchProperties`/`fetchNextPage` (que já fazem throttle), e com `$top=100`. Não mexer no cursor principal.
6. [x] `GET /api/realrisk/export` (Excel) — `lib/realrisk-excel.ts` + rota (com `requireAuth`). Local: `npx tsx scripts/realrisk-export.ts saida.xlsx [--days 7]`. Aluguéis (`*Lease`) excluídos; "Novos" usa `listingContractDate` (o backfill carimbou o mesmo `firstSeenAt` em tudo).
7. [x] `GET /api/realrisk/listings` (JSON) — `lib/realrisk-dashboard.ts`: candidatos Fix & Flip (Sumter/Marion/Lake/Polk, SFH, Flood X, ≥10% abaixo de casas parecidas no ZIP). ARV/CAPEX **estimados** até a fase 2. `id` = dígitos do `ListingKey` (estável p/ likes/comentários — `/api/realrisk/social`).

**No RealRisk** (este repositório)
8. [x] `app.js`: carrega de `/api/realrisk/listings` quando servido em `/realrisk/` (4Rivers); fora disso usa `data-mls.js` local (gitignored) ou a amostra de `data.js`. No 4Rivers: `/admin/realrisk` (iframe de `public/realrisk/`, copiado por `node scripts/sync-realrisk-app.mjs`; CSP própria em `next.config.js`).
9. [ ] Cache de enriquecimento (flood zone FEMA + OSRM) por `ListingKey`.
10. [x] Ajustar `scoring.js` para lidar com campos `null` (roof/HVAC/STR que o MLS não fornece) sem zerar o score.
11. [ ] (Fase 2) Comparáveis `Closed` para estimar `arvEstimated`.
