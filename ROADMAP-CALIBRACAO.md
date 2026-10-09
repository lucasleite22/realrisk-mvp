# RealRisk — Roadmap de calibração e estratégias
> Decidido em 08/Out/2026 (Lucas + Claude). Substitui a parte de "próximos passos" do `planejamento-semanal.md` (parado em 19/Jun).
> Integração técnica com o MLS: `4River REalty/REALRISK-HANDOFF.md` e `MLS-INTEGRACAO.md`.

## Posicionamento
**Produto independente, morando dentro da imobiliária.** Roda no admin da 4Rivers (`/admin/realrisk`), com dados do MLS (Stellar via MLSGrid), mas é tratado como produto próprio.

## O problema que o roadmap resolve
O score de hoje (`scoring.js` + `lib/realrisk-dashboard.ts`) tem três limitações que nenhum ajuste de peso resolve:
1. **ARV estimado pelo preço *pedido*** de casas ativas no ZIP, não por vendas fechadas. Por isso o ROI sai otimista.
2. **CAPEX é placeholder** ($8–35/sqft conforme o ano de construção).
3. **Um score único para tudo.** Flip, aluguel, STR e terra têm métricas de sucesso diferentes.

Por isso a ordem é **dado melhor primeiro, calibração depois**.

## Etapas

### 1. Histórico de vendas fechadas: ✅ carga feita (09/Out)
- Guardar no `mls_listings` as vendas **e locações** fechadas dos últimos 12 meses nos 5 condados, de todos os tipos (casa, Farm, Land, Residential Lease).
- Branch `feat/realrisk-closed-sales` (4Rivers). Backfill único pela GitHub Action (`mode=closed`, cursor `mfrmls:realrisk-closed`). Depois do merge, o sync diário mantém o histórico em dia.
- Carga completa em 09/Out: **64.526 vendas e locações fechadas** (12 meses, 5 condados), 2.689 páginas em 74 min, numa execução só.
- Ficou em 12 meses, não 6, porque venda de terra é rara e Farmland precisa de comparáveis.

**O que isso destrava:**
- ARV por comparáveis **vendidos**
- $/acre de terra vendida (Farmland)
- Velocidade por ZIP: DOM mediano das vendas, % do preço pedido que foi pago, meses de estoque
- Aluguel real por ZIP/tamanho (no Residential Lease fechado, o `ClosePrice` é o aluguel)

### 2. Lentes por estratégia + filtro de estratégia
Cada imóvel recebe nota em cada estratégia que faz sentido para ele, e o filtro escolhe a lente. A ordem segue a prioridade do Jales:

| Ordem | Lente | O que define uma boa oportunidade |
|---|---|---|
| **1º** | **Farmland / Ranch** | $/acre abaixo de terras vendidas comparáveis + critérios do Jales (abaixo) |
| 2º | Flip "água e sabão" | Desconto contra vendidos, obra só cosmética, ZIP com venda rápida |
| 3º | Rental (buy & hold) | Aluguel/preço acima da média (aluguel tirado das locações fechadas) e custo fixo baixo |
| 4º | STR | Permitido (HOA + zoneamento), demanda (distância aos parques, piscina) |

### 3. Formulário de avaliação + 50 imóveis do Jales
- **O Jales terá login próprio** no admin. O Lucas cria o usuário.
- Campos por imóvel:
  - Veredito: Compraria / Talvez / Não
  - A estratégia que ele enxerga
  - **O ARV e o custo de obra que ele estima**
  - Motivo principal, em tags: localização, preço, condição, bairro, HOA, terreno, liquidez…
  - Comentário livre
- Amostra: **~20 do topo, ~15 do meio, ~15 de baixo**, misturando condados e estratégias, com imóveis de terra incluídos. Sem a parte de baixo, não dá para descobrir as oportunidades que o sistema deixa passar.
- 50 avaliações **não treinam um modelo de ML**. Servem para ajustar pesos e limites, descobrir regras novas e medir a concordância entre a nota do sistema e o veredito do Jales antes e depois da calibração. Se o formulário ficar permanente, os dados acumulam, e um modelo passa a fazer sentido na casa das centenas de avaliações.

### 4. Sessão de calibração
Com as avaliações em mãos: ajustar pesos e regras de cada lente e medir a concordância de novo.

### Fora do escopo por enquanto
- Email diário (digest): arquitetura pronta, **continua desligado**.
- Adoção / outros usuários: fica como está.

## Critérios do Jales para Farmland e Ranch
Fonte: `RealRisk — Critérios de Elegibilidade _ Para preenchimento de Jales Castro_rev1.pdf`, Nichos 3 e 4. **Usar só a coluna "Sua definição".**

| Critério | Farmland | Ranch |
|---|---|---|
| Condados | Sumter, Polk, Lake, Pasco, Marion | os mesmos |
| Preço | $400k – $10M | $500k – $4M |
| Tamanho mínimo | 20 acres | 10 acres |
| $/acre máximo | $20k | — |
| Distância | 10–50 milhas de polo urbano (~1h) | ≤ 2h de aeroporto |
| Acesso | pavimentado ou terra firme | — |
| Zoneamento | Agricultural (AGR), 1 casa a cada 10 acres | — |
| Desmembramento | "não relevante", mas marcado como green flag | bônus se possível |
| Renda de arrendamento | N/A (o foco é valorização) | — |
| Uso | — | equestre ou terra bruta; agroturismo valoriza |
| Estrutura mínima | — | energia |

- **Casa no terreno: neutra.** "Estrutura de moradia habitável" não foi marcada como green flag, e o mínimo exigido no ranch é só energia.
- **Green flags:** utilities (energia, poço artesiano, fossa séptica); fora dos limites da cidade, o que facilita o processo rural; perto da CR 476, SR 471 e CR 48; perto de expansão urbana (potencial de rezoneamento); zoneamento que permite desmembramento.

### Como cada critério sai do MLS
| Critério | Campo / fonte |
|---|---|
| Tamanho, $/acre | `lotSizeAcres`, preço; comparação com terras **vendidas** (Etapa 1) |
| Energia, poço, fossa | `utilities`, `waterSource`, `sewer` |
| Acesso pavimentado | `lotFeatures` (Paved) |
| Fora da cidade | `lotFeatures` (In County / Unincorporated) |
| Zoneamento | `zoning` (formato varia por condado e precisa de normalização) |
| Rodovias e polos urbanos | distância calculada pela latitude/longitude |
| Equestre | palavras-chave em `publicRemarks` |
| Flood | `floodZone` (pesa menos que em casa) |

### Pendências com o Jales (cabem numa mensagem)
1. **Eliminatórios de Farmland:** o campo "o que te faria desistir" ficou em branco. Provisório até ele responder: flood zone A/AE na maior parte da área, sem acesso pela via pública, área de preservação.
2. ~~Condado vs. cidade~~: resolvido em 09/Out. Era só sobre a facilidade de resolver a burocracia, e é **irrelevante por enquanto** (não entra no score).
