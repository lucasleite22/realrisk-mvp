# RealRisk — Planejamento de Implementação
> Última atualização: 19/Jun/2026 · Fase atual: **Semana 2 — Plataforma com Dados Reais (16–20/Jun) 🔄**

---

## Legenda de responsáveis
| Símbolo | Responsável |
|---------|-------------|
| 🔵 **Lucas** | Desenvolvimento técnico, arquitetura, deploy |
| 🟢 **Jales** | Critérios imobiliários, validação, prospecção de usuários, deals |
| 🟡 **Ambos** | Decisões estratégicas, revisões, aprovações |

## Legenda de status
| Símbolo | Significado |
|---------|-------------|
| ✅ | Concluído |
| 🔄 | Em andamento |
| ⏳ | Aguardando |
| 🚨 | Caminho crítico — bloqueia próxima fase |

---

## STATUS ATUAL (19/Jun/2026)

### Já entregue ✅
- Dashboard MVP (HTML/CSS/JS vanilla) com 20 imóveis mock
- Scoring engine (`scoring.js`) — ROI, risco, tier 1/2/3, pesos recalibrados conforme formulário do Jales (Flood 40/Roof 30/HVAC 20/STR 10, 60% financeiro/40% risco)
- Filtros funcionais (preço, flood zone, STR, cidade, ROI mínimo)
- Mapa Leaflet com clustering, auto-zoom nos imóveis filtrados e popup rico (score, tier, flags)
- Watchlist com localStorage
- **Likes e comentários compartilhados** por oportunidade (Supabase) — código pronto, falta só configurar a conta (ver "Próximos passos")
- Formulário de critérios do Jales preenchido e analisado (`..._rev1.pdf`) — foco real dele é Farmland/Ranch, não só Fix&Flip/STR
- Pipeline de importação de dados reais: `import-csv.js` e `import-sheets.js`, com enriquecimento automático e gratuito (geocoding via Nominatim, flood zone via FEMA NFHL, tempo de carro até Disney/Universal via OSRM)
- Playbook completo de negócio com 7 fases e gates objetivos
- Repositório no GitHub (`lucasleite22/realrisk-mvp`) e deploy de produção no Vercel: **https://realrisk-mvp.vercel.app** (redeploy automático a cada push)

### Próximos passos (sessão de 19/Jun)
| Tarefa | Responsável | Status |
|--------|-------------|--------|
| Configurar Supabase (conta gratuita, SQL, colar key em `supabase-config.js`) — ver `SETUP-SUPABASE.md` | 🔵 Lucas | ⏳ |
| Decidir se/quando habilitar Google Maps (exige billing — sem isso, ficamos no Leaflet, que já está bom) — ver `SETUP-GOOGLE.md` | 🟡 Ambos | ⏳ pausado |
| Jales mandar export real (CSV ou planilha Google Sheets) com imóveis do MLS | 🟢 Jales | 🚨 bloqueador principal |
| Rodar `import-csv.js` ou `import-sheets.js` com os dados reais do Jales | 🔵 Lucas | ⏳ depende do item acima |
| Decidir se Farmland/Ranch entram no MVP agora ou ficam para depois — exigem schema, scoring e UI próprios (hoje só residencial/Fix&Flip/STR é suportado) | 🟡 Ambos | ⏳ decisão pendente |

### Próximo bloqueador imediato 🚨
**Jales precisa exportar os imóveis reais do MLS** (CSV ou planilha) → sem isso, a pipeline de importação fica sem dados pra processar, mesmo já estando pronta.

---

## SEMANA 1 — 09 a 13 Jun | Conclusão da Fase 1

**Objetivo:** Critérios definidos + decisão de fonte de dados MLS + primeiro lote real

| Dia | Responsável | Entregável | Prazo |
|-----|-------------|------------|-------|
| Seg 09 | 🟢 Jales | Preencher e assinar formulário `criterios-elegibilidade-jales.html` | EOD |
| Seg 09 | 🔵 Lucas | Revisar formulário preenchido, mapear thresholds para código | EOD |
| Ter 10 | 🟡 Ambos | **Decisão de fonte de dados MLS** (ver opções abaixo) 🚨 | Reunião |
| Ter 10 | 🔵 Lucas | Atualizar `scoring.js` com pesos definidos pelo Jales | EOD |
| Qua 11 | 🔵 Lucas | Configurar acesso à fonte de dados MLS escolhida | EOD |
| Qui 12 | 🔵 Lucas | Primeiro script de ingestão — exportar 50+ imóveis reais | EOD |
| Qui 12 | 🟢 Jales | Revisar os 50 primeiros imóveis — scoring faz sentido? | EOD |
| Sex 13 | 🟡 Ambos | Calibração final dos thresholds com base nos dados reais | EOD |

### 🚨 Opções de fonte de dados MLS (decidir na Ter 10)
| Opção | Custo | Velocidade | Qualidade |
|-------|-------|------------|-----------|
| **Export manual Jales (CSVS do MLS)** | $0 | Alta | Alta — Jales filtra |
| **SimplyRETS API** | ~$50/mês | Média | Alta — dados estruturados |
| **Apify scraper (Zillow/Realtor)** | ~$30/mês | Alta | Média — sem dados de agente |
| **Bridge Interactive (RESO API)** | Negociar | Baixa | Muito alta — MLS direto |

**Recomendação:** Começar com export manual do Jales (CSV → `data.js`) e validar o scoring. Só depois decidir a automação.

---

## SEMANA 2 — 16 a 20 Jun | Fase 2 — Plataforma com Dados Reais

**Objetivo:** Substituir mock data por dados reais, deploy no staging

| Dia | Responsável | Entregável | Prazo |
|-----|-------------|------------|-------|
| Seg 16 | 🔵 Lucas | Converter CSV/export do MLS → `data.js` (script de importação) | EOD |
| Seg 16 | 🔵 Lucas | Validar todos os filtros funcionando com dados reais | EOD |
| Ter 17 | 🔵 Lucas | Corrigir edge cases: sqft ausente, flood zone faltando, HOA null | EOD |
| Qua 18 | 🔵 Lucas | Deploy no GitHub Pages (staging URL) | EOD |
| Qui 19 | 🟢 Jales | Revisar staging — imóveis fazem sentido? Scores corretos? | EOD |
| Sex 20 | 🟡 Ambos | Ajuste fino de scores + aprovação para alpha | EOD |

### Critérios de saída da Fase 2 (gate para Fase 3)
- [ ] 100+ imóveis reais no sistema
- [ ] Scoring calibrado e aprovado pelo Jales
- [ ] Plataforma acessível via URL pública
- [ ] Zero erros críticos de JS no console

---

## SEMANA 3 — 23 a 27 Jun | Fase 3 — Alpha Fechado (prep)

**Objetivo:** Sistema pronto para receber usuários externos, primeiros convites

| Dia | Responsável | Entregável | Prazo |
|-----|-------------|------------|-------|
| Seg 23 | 🔵 Lucas | Loading states, empty states, error handling na UI | EOD |
| Ter 24 | 🔵 Lucas | **Autenticação básica** (Netlify Identity OU senha simples via `.env`) | EOD |
| Qua 25 | 🔵 Lucas | Formulário de feedback NPS no rodapé do dashboard | EOD |
| Qui 26 | 🟢 Jales | Lista dos primeiros 10 alpha users (corretores, investidores conhecidos) | EOD |
| Qui 26 | 🟡 Ambos | E-mail de convite alpha redigido e aprovado | EOD |
| Sex 27 | 🟢 Jales | Enviar convites para primeiros 5 alpha users | EOD |

---

## SEMANA 4 — 30 Jun a 04 Jul | Alpha — Coleta de Feedback

**Objetivo:** 10-20 usuários ativos, coletar NPS, atingir gate ≥7

| Dia | Responsável | Entregável | Prazo |
|-----|-------------|------------|-------|
| Seg 30 | 🟢 Jales | Acompanhamento individual com alpha users (call/WhatsApp) | EOD |
| Seg 30 | 🔵 Lucas | Analisar dados de uso (quais filtros usam mais?) | EOD |
| Ter 01/Jul | 🔵 Lucas | Iteração #1: top 3 melhorias solicitadas no alpha | EOD |
| Qua 02 | 🟢 Jales | Convidar usuários restantes (até 20 total) | EOD |
| Qui 03 | 🟡 Ambos | Compilar respostas NPS + feedback qualitativo | EOD |
| Sex 04 | 🟡 Ambos | **Gate check: NPS médio ≥7?** 🚨 | Reunião |

### 🚨 Gate 3→4: Critérios para avançar ao Beta Pago
- [ ] NPS médio ≥ 7 (escala 0-10)
- [ ] Pelo menos 10 usuários ativos na semana
- [ ] Nenhum bug crítico aberto
- [ ] Jales identificou pelo menos 1 deal potencial via plataforma

---

## SEMANAS 5-8 — Jul | Fase 4 — Beta Pago

**Objetivo:** 30 assinantes pagos, 1 deal fechado, MRR ≥ $2.500

| Semana | Responsável | Entregável |
|--------|-------------|------------|
| Sem 5 (07-11/Jul) | 🔵 Lucas | Integração Stripe ($1.200/ano = $100/mês) + página de pricing |
| Sem 5 | 🔵 Lucas | Lógica de acesso: free (3 imóveis) vs pago (tudo) |
| Sem 6 (14-18/Jul) | 🔵 Lucas | Setup Circle community (integração com plataforma) |
| Sem 6 | 🟢 Jales | Onboarding material para beta: guia de uso, webinar de lançamento |
| Sem 7 (21-25/Jul) | 🟡 Ambos | Soft launch para waitlist — e-mail + WhatsApp |
| Sem 7 | 🟢 Jales | Fechar **1 deal documentado** via plataforma (Fix & Flip ou STR) |
| Sem 8 (28/Jul-01/Ago) | 🟡 Ambos | **Gate check: 30 assinantes, MRR ≥ $2.500** 🚨 |

### 🚨 Gate 4→5: Critérios para Lançamento Oficial
- [ ] 30 assinantes pagos ($1.200/ano cada)
- [ ] MRR ≥ $2.500
- [ ] 1 deal fechado e documentado com ROI real
- [ ] Churn < 10% nos primeiros 30 dias

---

## SEMANAS 9-12 — Ago | Fase 5 — Lançamento Oficial

**Objetivo:** 100 assinantes, MRR ≥ $10.000, comunidade Circle ativa

| Semana | Responsável | Entregável |
|--------|-------------|------------|
| Sem 9 (04-08/Ago) | 🔵 Lucas | Refinamento UI/UX pós-beta, dark mode opcional |
| Sem 9 | 🟢 Jales | Estratégia de marketing: REI groups, Facebook, LinkedIn |
| Sem 10 (11-15/Ago) | 🟡 Ambos | Conteúdo de lançamento: case do deal fechado, testimonials |
| Sem 10 | 🔵 Lucas | SEO básico, Google Analytics, meta tags |
| Sem 11 (18-22/Ago) | 🟡 Ambos | Lançamento público — campanha de e-mail + social |
| Sem 12 (25-29/Ago) | 🟡 Ambos | **Gate check: 100 assinantes, MRR ≥ $10.000** 🚨 |

---

## FASE 6 — Set/Out | Cursos & Educação
> Gate de entrada: 100 assinantes pagos

| Item | Responsável | Entregável |
|------|-------------|------------|
| Currículo de cursos | 🟢 Jales | Conteúdo: análise de mercado, fix & flip, STR, farmland |
| Plataforma | 🔵 Lucas | Integração com Hotmart ou Circle courses |
| Curso 1 ($497) | 🟢 Jales | "Como analisar oportunidades em Orlando" |
| Curso 2 ($797) | 🟢 Jales | "Fix & Flip: da captação ao fechamento" |
| Mentoria ($3.500) | 🟢 Jales | Programa individual — 12 semanas |

---

## FASE 7 — Nov 2026+ | Expansão de Mercado
> Gate de entrada: MRR ≥ $10.000 consolidado por 60 dias

- Expandir cobertura para Tampa e Miami
- Lançar fundo de equity (20% em flips parceiros)
- Contratar analista imobiliário para cobrir novos mercados

---

## CAMINHO CRÍTICO RESUMIDO

```
Jales preenche critérios (Seg 09/Jun)
    ↓
Decisão de fonte MLS (Ter 10/Jun)  🚨 BLOQUEADOR #1
    ↓
Dados reais no sistema (Sem 16-20/Jun)
    ↓
Deploy staging (Qua 18/Jun)
    ↓
Alpha fechado — 10-20 usuários (Sem 23/Jun - 04/Jul)
    ↓
NPS ≥7  🚨 BLOQUEADOR #2
    ↓
Beta pago — Stripe + Circle (Jul)
    ↓
1 deal documentado  🚨 BLOQUEADOR #3
    ↓
30 assinantes, MRR ≥ $2.500 (01/Ago)  🚨 BLOQUEADOR #4
    ↓
Lançamento oficial (Ago)
    ↓
100 assinantes, MRR ≥ $10.000 (29/Ago)  🚨 BLOQUEADOR #5
    ↓
Cursos (Set/Out)
    ↓
Expansão (Nov 2026+)
```

---

## RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Acesso ao MLS demora | Alta | Alto | Começar com export manual do Jales |
| NPS < 7 no alpha | Média | Alto | Entrevistas individuais antes do NPS formal |
| Stripe aprovação lenta | Baixa | Médio | Criar conta Stripe agora (sem esperar beta) |
| Jales ocupado com brokerage | Alta | Médio | Bloquear 2h/semana fixas no calendário |
| Deal não fecha a tempo | Média | Alto | Jales prospecta deal paralelo ao desenvolvimento |

---

## PROJEÇÃO FINANCEIRA

| Fase | Meta | MRR | ARR |
|------|------|-----|-----|
| Beta (Ago) | 30 assinantes | $2.500 | $30.000 |
| Lançamento (Set) | 100 assinantes | $8.333 | $100.000 |
| Cursos ativos (Nov) | 100 + 10 cursos | ~$12.000 | ~$144.000 |
| Ano 1 total | — | — | ~$47.000 |
| Ano 2 projeção | 200 assinantes | ~$19.000 | ~$231.000 |

*Nota: inclui receita de inspeção ($950/deal), due diligence ($1.800/deal) e setup fee ($1.000)*

---

## PRÓXIMA AÇÃO IMEDIATA

**Hoje — Segunda-feira 09/Jun:**
1. 🟢 Jales: abrir `criterios-elegibilidade-jales.html` no browser e preencher → enviar para Lucas
2. 🔵 Lucas: ao receber → mapear thresholds no `scoring.js`

**Amanhã — Terça-feira 10/Jun:**
3. 🟡 Ambos: reunião (30 min) para decidir fonte de dados MLS 🚨
4. 🔵 Lucas: atualizar `scoring.js` com pesos aprovados pelo Jales
