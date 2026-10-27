# NewsMap — Especificação de Produto e Arquitetura (v2)

> **Escopo do primeiro lançamento (v1.0):** somente inglês (`en`, convenções en-US), 20 países curados, deploy exclusivo em Cloudflare.
> As decisões que mudaram em relação à v1 deste documento estão no **Apêndice A**.

---

## 0. Contexto e Modelo de Negócios

### 0.1 O Produto e o Objetivo Comercial

O **NewsMap** é um **diretório comercial curado de veículos de imprensa** (Notícias Gerais, Política, Esportes, Economia, Investigativo, Tecnologia, TV/Rádio e Regional), organizado por país. Ele foi desenhado para **gerar receita recorrente com custo de infraestrutura mínimo** (alvo: US$ 0–5/mês + domínio).

- Produto comercial proprietário (não é open-source nem projeto de estudo). O tráfego vem de busca orgânica e de backlinks, e a receita de patrocínios, afiliados e, depois de haver tráfego, de anúncios.
- **Expectativa realista:** buscas como "best newspapers in Japan" têm volume moderado e já são parcialmente respondidas por AI Overviews. A vantagem competitiva precisa vir da **qualidade e confiabilidade dos dados** (paywall, propriedade, links verificados) e da **velocidade e usabilidade** da página, e não do volume de páginas.

### 0.2 O Problema de Mercado e a Oportunidade

- Os diretórios existentes (*OnlineNewspapers.com*, *NewspaperLists.com*, *4imn.com*) têm interfaces datadas, são lentos e ruins no mobile, não dão contexto sobre cada veículo (paywall, propriedade, idioma) e têm links quebrados.
- Referência de UX: diretórios de alta densidade, ou seja, uma grade compacta, categorização em silos, ícones nítidos, micro-descrições no hover e carregamento instantâneo. *(Essa referência é interna; nunca deve aparecer em copy pública, nomes de componentes ou documentação publicada.)*

### 0.3 O que é o NewsMap

1. **Diretório visual de alta densidade:** País → Categoria em 1 ou 2 cliques. Cada veículo mostra ícone local, nome, pitch de 1 linha, **badge de paywall** (`Free`, `Metered`, `Freemium`, `Hard paywall`), **badge de propriedade** (`State-controlled`, `Public service`, `Nonprofit`, etc.), idioma e link de RSS quando existir.
2. **SEO programático com controle de qualidade:** só são geradas e indexadas páginas que passam em limiares mínimos de conteúdo (seção 3.5). Dados estruturados Schema.org em todas as páginas. A arquitetura já fica pronta para i18n, mas o lançamento é só em `en`.
3. **Monetização:** 4 fontes de receita mais 2 habilitadores (seção 3.6).

### 0.4 Não-objetivos

- **Não fazer scraping de artigos.** O núcleo é o diretório de links e perfis. No v1.0 não há exibição de manchetes via RSS: só o link para o feed oficial.
- **Não construir um SPA.** O HTML principal é estático e funciona sem JavaScript.
- **Não usar bancos pagos** (RDS, DynamoDB, Atlas). Os dados operacionais ficam em Cloudflare D1, e a telemetria de cliques em Workers Analytics Engine.
- **Não usar CMS, busca ou analytics de terceiros pagos.** A busca usa Pagefind (estático). Os únicos serviços externos permitidos estão listados na seção 2.4.
- **Não inventar dados.** Nenhum veículo, URL, dono, ano de fundação ou classificação entra publicado sem verificação humana (seção 3.4).
- **Não publicar páginas sem conteúdo suficiente.** Uma página que não atinge os limiares da seção 3.5 não é gerada ou não é indexada.

---

## 1. Regras Operacionais para o Agente de Implementação

1. **Autonomia em tarefas de código:** execute fase por fase sem pedir confirmação para decisões de implementação. Se um teste, lint ou build falhar, diagnostique e corrija.
2. **Pare e peça ao proprietário** apenas para:
   - verificar dados do catálogo (marcar veículos como `verified` é exclusivo do proprietário);
   - aprovar textos jurídicos (privacidade, termos, disclosures) e a metodologia editorial;
   - configurar chaves reais (LemonSqueezy, Turnstile, Cloudflare Access, AdSense);
   - ligar anúncios (`ADS_ENABLED=true`).
3. **Qualidade e performance:**
   - **Metas de laboratório** (Lighthouse mobile, throttling padrão), aplicadas como gate no CI: LCP ≤ 1,8 s, CLS ≤ 0,01, TBT ≤ 100 ms. (Era 1,5 s; medido em ~1,2–1,5 s nas páginas de categoria e perfil, ajustado para não falhar por ruído de simulação. A meta de campo abaixo não muda.)
   - **Metas de campo** (p75, CrUX/Search Console): LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. O objetivo é ficar bem abaixo disso.
   - **Orçamento de JS:** ≤ 35 KB gzip nas páginas de diretório.
   - **TypeScript estrito:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, zero `any`.
   - **Validação em build-time:** todo o catálogo passa por schemas Zod. O build falha se houver URL malformada, slug ou ID duplicado, código ISO-3166 inválido, campo obrigatório faltando no locale habilitado, ou país publicado que não atende aos limiares.
4. **ADRs** em `docs/adr/NNNN-titulo.md` (Contexto, Decisão, Alternativas, Consequências de custo, SEO e risco).
5. **Commits atômicos em Conventional Commits** (`feat(seo):`, `feat(monetization):`, `feat(ui):`, `data(catalog):`, `test(e2e):`, `ci:`). Todo commit compila e passa nos testes. Os commits não levam atribuição a ferramentas de IA nem dados pessoais (e-mails, caminhos locais, tokens). Siga a skill `privacy` do projeto.
6. **Idioma:**
   - Código, schemas, commits e interface: inglês (en-US: ortografia americana, datas e números em `en-US`).
   - Resumos de progresso para o proprietário: português.
7. **Segredos:** nunca commitar chaves. Use `.env.example` documentado para desenvolvimento local e `wrangler secret` em produção.

---

## 2. Stack Tecnológica

### 2.1 Web, renderização e runtime

- **Framework:** **Astro 7.x** com `@astrojs/cloudflare`, em modo **static-first**. Todas as páginas de diretório são pré-renderizadas. Só rotas específicas usam `export const prerender = false`: `/go/*`, `/api/*`, `/badge/*`, `/admin/*`.
- **Hospedagem:** **Cloudflare Workers com Static Assets**. Requisições a assets estáticos não invocam o Worker e não contam no limite de requests. Só as rotas dinâmicas invocam o Worker.
- **Linguagem:** TypeScript 6.x (o typescript-eslint ainda não suporta o 7). Node.js LTS apenas para build e ferramentas.
- **Pacotes:** `pnpm` com lockfile estrito.
- **Estilo:** Tailwind CSS + variáveis CSS (`src/styles/tokens.css`) com dois temas: *Paper Light* e *Terminal Dark*. Sem bibliotecas de componentes.
- **Ilhas interativas:** Preact, isolado (`client:idle` / `client:visible`), apenas para:
  1. **Command Palette (`Ctrl/⌘ + K`)**, sobre a API do Pagefind;
  2. **FilterBar** na página do país.
- **Sem JS para tooltips:** os cards de detalhe usam a Popover API nativa (`popover`), com fallback em `<details>`.
- **Lógica de negócio** em funções puras em `src/lib/` (ordenação, seleção de afiliados, SEO, preços), sem dependência do runtime Cloudflare. Isso mantém a portabilidade para uma VPS no futuro (ADR 0008).

### 2.2 Dados

| Dado | Armazenamento | Fonte de verdade |
|---|---|---|
| Geografia (todos os países ISO-3166) | `data/geo/countries.json` | Git |
| País publicado + contexto editorial | `data/countries/[iso2].json` | Git |
| Veículos | `data/outlets/[iso2].json` | Git |
| Afiliados, preços, regras de VPN | `data/monetization/*.json` | Git |
| Submissões, patrocínios, webhooks, correções | **Cloudflare D1** (Drizzle ORM) | D1 |
| Cliques | **Workers Analytics Engine** | AE |

**Regra:** cada entidade tem uma única fonte de verdade. O estado de patrocínio **não existe** no catálogo do Git (seção 3.6.1).

### 2.3 Qualidade, SEO e testes

- **Auditoria de SEO sobre `dist/`** (`tools/seo-audit.ts`), descrita na seção 4, Fase 6.
- **Vitest:** cobertura ≥ 85% em `src/lib/` e nas rotas de API.
- **Playwright + `@axe-core/playwright`:** WCAG 2.2 AA, com zero violações `serious`/`critical`.
- **Lighthouse CI:** gates de performance da seção 1.3.
- **CLI do catálogo** (`tools/catalog-cli`), descrito na seção 3.4.

### 2.4 Serviços externos permitidos

| Serviço | Uso | Custo |
|---|---|---|
| Cloudflare Workers, D1, Analytics Engine, R2 | Hospedagem, banco, cliques, backups | Free tier (Workers Paid de US$ 5/mês quando o tráfego exigir) |
| Cloudflare Turnstile | Antispam em formulários | Grátis |
| Cloudflare Access (Zero Trust) | Autenticação do `/admin` | Grátis até 50 usuários |
| **LemonSqueezy** | Pagamentos de patrocínio (Merchant of Record) | % por transação |
| Google AdSense + Google Privacy & Messaging (CMP certificado TCF) | Anúncios e consentimento, **só após aprovação e tráfego** | Grátis |
| GitHub Actions | CI/CD, rebuilds agendados, backups | Free tier |

### 2.5 ADRs esperados

| Nº | Tema |
|---|---|
| 0001 | Astro 7 static-first + rotas on-demand em Cloudflare Workers |
| 0002 | Modelo de dados: catálogo no Git (Zod) × D1 (Drizzle) × Analytics Engine; uma fonte de verdade por entidade |
| 0003 | Arquitetura de URLs, prontidão para i18n (`en` na raiz) e limiares de indexação |
| 0004 | UX de diretório de alta densidade (grade, micro-pitches, hierarquia visual) |
| 0005 | Modelo de monetização: 4 fontes de receita + 2 habilitadores |
| 0006 | Links de saída: `href` direto + beacon × `/go`; atributos `rel`; proteção contra open redirect |
| 0007 | Cache, WAF, proteção contra bots e rate limiting |
| 0008 | Deploy exclusivo em Cloudflare; modelo de custo; estratégia de saída para VPS |
| 0009 | Pipeline de saúde de links e de ícones locais |
| 0010 | Badges para aquisição de backlinks dentro das diretrizes do Google |
| 0011 | Qualidade de dados e metodologia editorial (verificação, fontes, taxonomia de propriedade e viés, correções) |
| 0012 | Privacidade, consentimento e conformidade (LGPD/GDPR, CMP, disclosures, retenção) |
| 0013 | Pagamentos via Merchant of Record (LemonSqueezy) |

---

## 3. Arquitetura do Sistema e Contratos de Dados

### 3.1 Visão geral do fluxo

```text
data/geo + data/countries + data/outlets + data/monetization
        + snapshot de patrocínios ativos (exportado do D1 no build)
        │
        ▼  Build (GitHub Actions): Zod → limiares de publicação → ícones → Astro SSG → Pagefind → seo-audit
┌──────────────────────────────────────────────────────────────────────────┐
│ STATIC ASSETS (servidos pelo edge, sem invocar o Worker)                 │
│                                                                          │
│ /                                   Home: grade de países, destaques     │
│ /continent/[continent]/             Hub continental (≥ 3 países)         │
│ /[country]/                         Página do país (8 colunas)           │
│ /[country]/[category]/              Silo de categoria (se atingir limiar)│
│ /[country]/outlet/[outlet]/         Perfil do veículo + snippet de badge │
│ /advertise/                         Landing de patrocínio                │
│ /about/ /methodology/ /corrections/ /disclosures/ /privacy/ /terms/      │
│ /sitemap-index.xml /sitemap-en.xml /robots.txt /ads.txt                  │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼  Worker (rotas on-demand)
┌──────────────────────────────────────────────────────────────────────────┐
│ GET  /go/[id]                   Redireciona (302) só para destinos do    │
│                                 catálogo/afiliados; registra clique      │
│ POST /api/track                 Beacon de clique orgânico                │
│ GET  /api/geo                   País do visitante (no-store)             │
│ GET  /api/slots                 Vagas livres no Top-3 de país/categoria  │
│ POST /api/submit                Sugestão gratuita (Turnstile)            │
│ POST /api/checkout              Reserva vaga + cria checkout LemonSqueezy│
│ POST /api/webhooks/lemonsqueezy Assinatura HMAC + idempotência           │
│ POST /api/corrections           Pedido de correção (Turnstile)           │
│ GET  /badge/[country]/[outlet].svg   Selo SVG dinâmico (cache de 1 dia)  │
│ GET  /admin/*                   Atrás do Cloudflare Access               │
│ Cron Trigger (diário)           Expira reservas e patrocínios; dispara   │
│                                 rebuild se algo mudou                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Contratos de dados do catálogo

Os arquivos são **JSON válido** (sem comentários). Os enums ficam documentados nas tabelas abaixo e implementados em `src/schemas/catalog.schema.ts`. Os valores numéricos nos exemplos são ilustrativos.

#### 3.2.1 País — `data/countries/[iso2].json`

```json
{
  "iso2": "BR",
  "iso3": "BRA",
  "slug": "brazil",
  "name": { "en": "Brazil" },
  "continent": "south-america",
  "also_in": [],
  "population": { "value": 212000000, "year": 2024, "source": "https://data.worldbank.org/" },
  "official_languages": ["pt"],
  "press_freedom": {
    "rank": 63,
    "status": "problematic",
    "year": 2025,
    "source": "RSF World Press Freedom Index",
    "source_url": "https://rsf.org/en/index"
  },
  "neighbors": ["AR", "BO", "CO", "GY", "PE", "PY", "SR", "UY", "VE"],
  "published": true,
  "seo_context": {
    "en": {
      "summary": "120–180 words on the national media landscape, major media groups, reading habits and regulation.",
      "faq": [
        { "q": "What are the main national newspapers in Brazil?", "a": "..." },
        { "q": "Which Brazilian news sites are free to read?", "a": "..." },
        { "q": "Which Brazilian outlets are publicly or state funded?", "a": "..." },
        { "q": "Where can I find regional newspapers in Brazil?", "a": "..." }
      ],
      "categories": {
        "sports": { "intro": "60–120 words about sports media in Brazil." }
      },
      "reviewed": true,
      "reviewed_at": "2026-10-20"
    }
  }
}
```

| Campo | Valores / regra |
|---|---|
| `continent` | `africa`, `asia`, `europe`, `north-america`, `south-america`, `oceania` (continente principal) |
| `also_in` | Continentes adicionais para países transcontinentais (ex.: RU → `["asia"]`, TR → `["europe"]`). Afetam apenas os hubs, nunca a URL. |
| `press_freedom.status` | `good`, `satisfactory`, `problematic`, `difficult`, `very-serious`. Com atribuição obrigatória à RSF na página. |
| `published` | Só pode ser `true` se o país atender aos limiares da seção 3.5. O build valida. |
| `seo_context.[locale]` | Obrigatório para cada locale **habilitado** (no v1.0, só `en`). `reviewed: true` é obrigatório para países publicados. |

#### 3.2.2 Veículo — `data/outlets/[iso2].json` (array)

```json
[
  {
    "id": "br-folha-de-s-paulo",
    "slug": "folha-de-s-paulo",
    "name": "Folha de S.Paulo",
    "url": "https://www.folha.uol.com.br/",
    "rss_url": "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml",
    "language": "pt",
    "categories": ["general-news", "politics", "economy"],
    "primary_category": "general-news",
    "ranks": { "general-news": 1, "politics": 2, "economy": 3 },
    "region": null,
    "founded_year": 1921,
    "paywall": "metered",
    "ownership_type": "private",
    "owner": "Grupo Folha",
    "political_lean": { "value": "unrated", "source_url": null },
    "format": "newspaper",
    "editor_pick": true,
    "pitch": { "en": "São Paulo-based national daily known for coverage of federal politics and the economy." },
    "about": { "en": "Optional 60–150 word reviewed description. Required for the profile page to be indexable." },
    "sources": [
      { "field": "owner", "url": "https://example.org/source-for-ownership" },
      { "field": "founded_year", "url": "https://example.org/source-for-founding-year" }
    ],
    "status": "verified",
    "verified_at": "2026-10-20",
    "health": { "last_checked": "2026-10-25", "http_status": 200, "final_url": "https://www.folha.uol.com.br/" }
  }
]
```

| Campo | Valores / regra |
|---|---|
| `id` | `[iso2-minúsculo]-[slug]`, único globalmente |
| `slug` | Único **dentro do país** (a URL inclui o país) |
| `url`, `rss_url` | `https://` obrigatório. String pura, nunca markdown. |
| `categories` / `primary_category` | Valores da seção 3.3. `primary_category` precisa estar em `categories`. |
| `ranks` | Mapa categoria → posição editorial (inteiro ≥ 1). Uma chave para cada item de `categories`, sem posições repetidas na mesma categoria do país. |
| `region` | Obrigatório quando `regional` está em `categories` (estado ou província) |
| `paywall` | `free`, `metered`, `freemium`, `hard` |
| `ownership_type` | `private`, `public-service`, `state-controlled`, `nonprofit`, `cooperative`, `unknown`. `state-controlled` exige uma entrada em `sources`. |
| `political_lean.value` | `left`, `center-left`, `center`, `center-right`, `right`, `mixed`, `unrated`. Qualquer valor diferente de `unrated` exige `source_url` de um classificador reconhecido ou da metodologia publicada. **O padrão é `unrated`.** |
| `format` | `newspaper`, `digital-native`, `broadcaster-tv`, `broadcaster-radio`, `magazine`, `agency` |
| `pitch.[locale]` | Obrigatório para os locales habilitados. 60–140 caracteres. |
| `status` | `candidate` (rascunho, nunca publicado), `verified` (conferido pelo proprietário), `retired` (fechou ou saiu do catálogo) |
| `sponsored` | **Não existe.** Patrocínio vem do D1 (seção 3.6.1). |

### 3.3 Categorias (ordem fixa na grade)

| Slug | Rótulo (en) |
|---|---|
| `general-news` | Top National News |
| `politics` | Politics & Government |
| `sports` | Sports |
| `economy` | Business, Finance & Markets |
| `investigative` | Investigative & Fact-Checking |
| `tech-science` | Tech, Science & Culture |
| `broadcast` | TV & Radio News |
| `regional` | Regional & Local |

Nenhum slug de categoria pode coincidir com segmentos reservados (`outlet`, `continent`, `api`, `go`, `badge`, `admin`).

### 3.4 Qualidade de dados e pipeline editorial (`tools/catalog-cli`)

**Princípio:** a confiabilidade dos dados é o produto. O agente pode **rascunhar** candidatos, mas só o proprietário verifica.

Fluxo: `candidate` → (verificação humana) → `verified` → publicado quando o país atinge os limiares.

| Comando | Função |
|---|---|
| `pnpm catalog:validate` | Zod, unicidade de IDs e slugs, ISO-3166, consistência de `ranks`, limiares de publicação, fontes obrigatórias |
| `pnpm catalog:health` | Checa HTTP/TLS com concorrência limitada e `User-Agent` identificado. Detecta 4xx/5xx, redirecionamentos permanentes, mudança de domínio e RSS inválido. **Gera um relatório** (`reports/health-YYYY-MM-DD.json`) e propõe alterações, mas **nunca altera dados `verified` automaticamente**. |
| `pnpm catalog:draft --country BR` | Cria rascunhos `candidate` para revisão. Todo candidato passa por `catalog:health`, e o URL final e o `<title>` do site ficam registrados para facilitar a conferência. |
| `pnpm catalog:import <csv>` | Importa uma planilha curada pelo proprietário |
| `pnpm catalog:add` | Cria uma entrada nova com o esqueleto válido |
| `pnpm catalog:icons` | Baixa favicons em build-time, otimiza para WebP 40×40 (exibido a 20×20) e gera monogramas SVG determinísticos como fallback |
| `pnpm catalog:report` | Mostra a cobertura por país e categoria e o que falta para cada país atingir o limiar |

**Textos de SEO** (`summary`, `faq`, `intro`, `about`): podem ser rascunhados com ajuda de ferramentas, mas exigem `reviewed: true` do proprietário. Os fatos citados (rankings, donos, números) precisam ter fonte.

**Correções:** o formulário público em `/corrections/` grava em `correction_requests`. O admin revisa e a correção entra via commit no catálogo.

### 3.5 Limiares de geração e indexação (anti-thin content)

| Página | Gerada quando | Indexável quando | Caso contrário |
|---|---|---|---|
| País | `published: true`: ≥ 15 veículos `verified` em ≥ 4 categorias + `seo_context.en` revisado | Sempre que gerada | Não gerada |
| Categoria do país | ≥ 5 veículos verificados na categoria **e** `intro` revisada | Sempre que gerada | Não gerada; os veículos aparecem só na página do país |
| Coluna na página do país | ≥ 3 veículos na categoria | n/a | Os veículos vão para um card "More outlets" |
| Perfil do veículo | Veículo `verified` | Tem `about.en` revisado | Gerada com `noindex,follow` (continua útil para usuários e para o badge) |
| Hub continental | ≥ 3 países publicados no continente (contando `also_in`) | Sempre que gerada | Não gerado; países listados só na home |

O sitemap contém **apenas páginas indexáveis**. O `seo-audit` falha se uma página `noindex` aparecer no sitemap.

### 3.6 Monetização: 4 fontes de receita + 2 habilitadores

| # | Tipo | Item | v1.0 |
|---|---|---|---|
| R1 | Receita | Slots patrocinados Top-3 | ✅ |
| R2 | Receita | Afiliados contextuais | ✅ |
| R3 | Receita | Anúncios display (AdSense e, depois, Mediavine/Ezoic) | Containers prontos, **desligados** (`ADS_ENABLED=false`) até haver aprovação e tráfego |
| R4 | Receita | Patrocínio da newsletter | Pós-lançamento |
| H1 | Habilitador | Analytics de clique (`/go` + beacon) | ✅ |
| H2 | Habilitador | Badges para backlinks | ✅ |

Não existe plano "Pro".

#### 3.6.1 R1: Slots patrocinados (Top-3)

- **Fonte de verdade:** tabela `sponsorships` no D1.
- **Renderização estática:** o build exporta um snapshot dos patrocínios `active` (`pnpm sponsorships:snapshot`, via API do D1 com token de leitura no CI) e o embute no HTML. Resultado: zero JS, zero CLS e zero invocação do Worker por pageview.
- **Propagação:** quando o admin aprova um patrocínio, ou quando o cron diário encerra um, o Worker dispara um rebuild (GitHub `workflow_dispatch`). A latência esperada é de cerca de 5 minutos, aceitável para um produto mensal.
- **Fluxo de compra:**
  1. Em `/advertise/`, o cliente escolhe país, categoria e plano. `GET /api/slots` mostra as vagas livres (máximo de 3 por país/categoria).
  2. `POST /api/checkout` (com Turnstile) cria uma `submission` e uma `sponsorship` com `status = reserved` e `reserved_until = agora + 30 min`, depois cria o checkout no LemonSqueezy com `custom_data.submission_id`.
  3. O webhook `subscription_created` move para `paid_pending_review`.
  4. **Revisão editorial obrigatória** no admin, para não promover sites fraudulentos ou sem relação com notícias. Aprovação torna o slot `active` e dispara o rebuild. Rejeição dispara o reembolso via API do LemonSqueezy.
- **Webhook `/api/webhooks/lemonsqueezy`:**
  - verifica `X-Signature` (HMAC-SHA256 sobre o **corpo bruto**) com comparação em tempo constante;
  - idempotência pela tabela `webhook_events`, com chave `event_name + data.id + data.attributes.updated_at`;
  - eventos tratados: `subscription_created`, `subscription_updated`, `subscription_payment_success`, `subscription_payment_failed` (vira `grace` por 7 dias), `subscription_cancelled` (continua ativo até o fim do período), `subscription_expired` (`ended`), `order_refunded` (`ended`).
- **Preço:** base de US$ 29/mês ou US$ 249/ano. Preços por tier de país ficam em `data/monetization/pricing.json` (ver `docs/MONETIZATION_PLAYBOOK.md`).
- **Modo simulação:** sem `LEMONSQUEEZY_API_KEY`, o checkout é simulado localmente, com payloads de webhook de teste.
- **Disclosure:** slots patrocinados exibem o texto **"Sponsored"** (não só a cor), ficam visualmente separados do ranking editorial e usam links via `/go` com `rel="sponsored noopener"`.

#### 3.6.2 R2: Afiliados contextuais

- Configuração em `data/monetization/affiliates.json` (IDs de afiliado não são segredos).
- **Seleção por contexto da página** (estática, em build-time, em `src/lib/monetization/affiliates.ts`):

| Contexto | Oferta | Copy permitida |
|---|---|---|
| `sports`, `broadcast` | VPN | Privacidade em Wi-Fi público, acompanhar o noticiário local ao viajar |
| `politics`, `investigative` | VPN | Privacidade e proteção contra rastreamento |
| `economy` | Newsletters e dados financeiros | Conteúdo e ferramentas de mercado |
| Veículo com `paywall` `metered` ou `hard` | PressReader ou similar (acesso legítimo a jornais pagos) | Ler edições digitais completas |

- **Copy proibida:** "burlar paywall", "desbloquear transmissões" (direitos de transmissão), "contornar bloqueio geográfico" ou qualquer incentivo a violar termos de uso.
- **Personalização por geo (mínima):** um script inline lê `GET /api/geo` (uma vez por sessão, guardado em `sessionStorage`) e **oculta** a oferta de VPN quando:
  - o visitante está num país da lista `data/monetization/vpn-restricted-countries.json`, onde VPN é restrita ou ilegal;
  - o país do visitante é o mesmo da página.
  O espaço do card é reservado e colapsa sem layout shift (`visibility`, não `display`).
- **Disclosure** de afiliado visível junto ao bloco, com link para `/disclosures/`. Links via `/go` com `rel="sponsored noopener"`.

#### 3.6.3 R3: Anúncios display

- Containers com dimensões fixas (`min-height` reservado): leaderboard 728×90 / 320×100, in-feed entre colunas e sidebar sticky no desktop.
- **Só são ligados quando:**
  1. o AdSense aprovou o site;
  2. o CMP (Google Privacy & Messaging, certificado TCF) está configurado para EEE, Reino Unido e Suíça;
  3. `ADS_ENABLED=true`.
- `ads.txt` gerado a partir da configuração.
- O CSP tem dois perfis documentados (seção 3.8). O perfil com anúncios é necessariamente mais permissivo.

#### 3.6.4 H1: Analytics de clique

- **Links orgânicos:** `href` real para o site do veículo (`rel="noopener"`), mais `navigator.sendBeacon('/api/track', ...)`.
- **Links patrocinados e de afiliados:** `/go/[id]`. O `id` é resolvido **apenas** contra o catálogo e `affiliates.json`. Nenhum parâmetro de URL de destino é aceito (isso evita open redirect). Resposta 302 com UTM e parâmetros de afiliado.
- **Armazenamento:** Workers Analytics Engine com `outlet_id`, `country`, `category`, `visitor_country`, `is_sponsored`, `source` (`beacon` ou `go`), `bot_score_bucket` e `visitor_hash`.
  - `visitor_hash = HMAC(VISITOR_HASH_SECRET + data UTC, IP + User-Agent)`. O sal rotaciona diariamente. **Nunca armazenar IP ou User-Agent em claro.**
- **Anti-fraude:** descartar requisições com bot score baixo, deduplicar por `visitor_hash + outlet_id` em janelas de 30 minutos e aplicar rate limit por IP no Worker (binding de Rate Limiting).
- **Relatórios para anunciantes:** sempre rotulados como "filtered clicks (estimate)". Adblockers bloqueiam parte dos beacons.

#### 3.6.5 H2: Badges para backlinks

- `GET /badge/[country]/[outlet].svg`: SVG gerado no Worker, com cache de 1 dia na borda. Texto: **"Listed on NewsMap · #N in [Category], [Country]"**. Todos os textos passam por escape XML, e a resposta usa `Content-Type: image/svg+xml` e `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`.
- O snippet HTML na página do veículo usa **âncora e `alt` só com a marca** ("NewsMap"), sem palavras-chave, para não ser tratado como esquema de links por widget. O snippet exibido para veículos patrocinados inclui `rel="sponsored"`.
- O ganho é incerto. O ADR 0010 documenta o risco e a estratégia de outreach manual.

#### 3.6.6 R4: Newsletter (pós-lançamento)

Fica fora do v1.0. Exige um provedor de envio (Amazon SES ou o free tier de um provedor similar), double opt-in, link de descadastro, política de retenção e registro de consentimento.

### 3.7 Banco de dados D1 (`src/db/`, Drizzle)

Sem transações interativas (limitação do D1). Use `db.batch()` para operações atômicas.

| Tabela | Colunas principais |
|---|---|
| `submissions` | `id`, `outlet_name`, `url`, `country_iso`, `category`, `contact_email`, `plan` (`free`, `monthly`, `yearly`), `status` (`pending`, `awaiting_payment`, `paid_pending_review`, `approved`, `rejected`, `refunded`), `ls_order_id`, `ls_subscription_id`, `created_at`, `updated_at` |
| `sponsorships` | `id`, `submission_id`, `outlet_id` (nulo se o veículo ainda não está no catálogo), `country_iso`, `category`, `slot_position` (1–3), `status` (`reserved`, `active`, `grace`, `ended`), `reserved_until`, `starts_at`, `ends_at`, `ls_subscription_id` |
| `webhook_events` | `idempotency_key` (PK), `event_name`, `received_at` |
| `correction_requests` | `id`, `outlet_id`, `field`, `message`, `contact_email` (opcional), `status`, `created_at` |

- **Índice único parcial** em `sponsorships(country_iso, category, slot_position)` para `status IN ('reserved','active','grace')`. Impede vender a mesma vaga duas vezes.
- **Retenção:** `contact_email` é anonimizado 24 meses após o encerramento da submissão ou da correção (job no cron).
- **Backups:** D1 Time Travel, mais export semanal (`wrangler d1 export`) para o R2 via GitHub Actions.

### 3.8 Segurança

- **Admin (`/admin/*`, `/api/admin/*`):** protegido por **Cloudflare Access**. O Worker **também** valida o JWT `Cf-Access-Jwt-Assertion` (AUD e issuer), como defesa em profundidade. Ações mutáveis usam POST com verificação de `Origin` (CSRF).
- **Formulários públicos:** Turnstile validado no servidor, rate limit por IP, validação Zod do corpo e limite de tamanho do payload.
- **`/go`:** resolve só por allowlist (catálogo e afiliados).
- **Webhooks:** HMAC sobre o corpo bruto, comparação em tempo constante e idempotência.
- **SVG e HTML gerados:** escape de todo dado do catálogo. O catálogo também é validado contra caracteres de controle.
- **Headers** (em `public/_headers` para assets e no Worker para rotas dinâmicas): HSTS (com preload depois de estabilizar), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritiva, `frame-ancestors 'none'`.
- **CSP com dois perfis:**
  - *Sem anúncios (v1.0):* `default-src 'self'`; scripts só `'self'` + hashes dos inline; Turnstile liberado apenas nas páginas com formulário.
  - *Com anúncios:* perfil documentado com os domínios exigidos pelo AdSense e pelo CMP, revisado sempre que o provedor mudar.
- **WAF:** Bot Fight Mode e regra de rate limiting em `/api/*`. O `robots.txt` **não** é tratado como medida de segurança.
- **Segredos:** `wrangler secret`. `.env.example` só com placeholders.

### 3.9 Privacidade e conformidade

- **Sem cookies no v1.0:** o tema fica em `localStorage`. O analytics próprio não usa cookies nem identificadores persistentes.
- Com anúncios ligados, o CMP certificado é obrigatório antes de carregar qualquer script de anúncio.
- **Páginas obrigatórias:** `/privacy/` (LGPD/GDPR: controlador, bases legais, retenção, direitos e contato), `/terms/`, `/disclosures/` (afiliados e patrocínio, nos moldes da FTC e do CONAR), `/methodology/` (paywall, propriedade, critérios de ranking editorial, quando e como `political_lean` é classificado) e `/corrections/`.
- Atribuição de fontes de terceiros (RSF, World Bank) em cada página que usa esses dados.
- Os textos jurídicos finais são aprovados pelo proprietário (seção 1.2).

### 3.10 Linguagem visual e UX

Os tokens ficam em `src/styles/tokens.css`, com os temas *Paper Light* e *Terminal Dark*. Respeitam `prefers-color-scheme`, têm alternador persistido em `localStorage` e contraste AA validado.

**Página do país (`/[country]/`):**
- As categorias aparecem como cartões verticais na ordem fixa da seção 3.3: 3 a 4 colunas no desktop, 2 no tablet e 1 coluna com abas de âncora no mobile.
- Cada cartão traz cabeçalho (ícone, rótulo, contador), slots "Sponsored" no topo (separados por divisória), veículos ordenados por `ranks[categoria]`, botão "Show all" e o link discreto "Suggest an outlet · Feature yours".

**Linha de veículo (42 px):**
1. Posição (ou o rótulo "Sponsored");
2. Ícone local 20×20 com `width` e `height` explícitos e `loading="lazy"` abaixo da dobra;
3. Nome, truncado com `title`;
4. Indicadores à direita, sempre **com texto, nunca só cor**: `Free`, `Metered`, `Paywall`; tag de propriedade (`STATE`, `PUBLIC`, `NONPROFIT`) quando houver fonte; formato (`TV`, `RADIO`).

**Card de detalhe** (Popover API, acessível por teclado e toque no ícone ⓘ): pitch, dono, ano de fundação, "Visit site ↗" e "Profile & alternatives".

**Outros elementos:**
- **Home:** grade de países publicados agrupada por continente, com bandeiras SVG locais (sem emoji, que não renderiza em todos os sistemas), destaques editoriais e busca (⌘K).
- **Mapa-múndi interativo:** pós-lançamento.
- **Zero requisições externas** para ícones, fontes ou bandeiras.

### 3.11 URLs e i18n

- **v1.0:** `en` na raiz, sem prefixo. Barra final sempre (`trailingSlash: 'always'`). Slugs em minúsculas com hífen.
- **Futuro:** novos locales sob prefixo (`/pt/`, `/es/`, `/fr/`, `/de/`) via i18n do Astro com `prefixDefaultLocale: false`. O gerador de `hreflang` (`src/lib/seo/hreflang.ts`) já é implementado e testado, mas **só emite tags quando há mais de um locale habilitado** (`ENABLED_LOCALES`), incluindo `x-default` → `en`.
- Canonical sempre absoluto (`SITE_URL`).
- **Internal linking:**
  - vizinhos publicados (`neighbors`);
  - a mesma categoria em países do mesmo continente;
  - veículos similares (mesmo país e categoria, mesmo `ownership_type`);
  - breadcrumbs em todas as páginas.

### 3.12 Dados estruturados (`src/lib/seo/jsonld.ts`)

- `WebSite` e `Organization` na home. **Sem `SearchAction`**: o Google descontinuou o sitelinks search box.
- `BreadcrumbList` em todas as páginas internas.
- `ItemList` nas páginas de país e categoria.
- `NewsMediaOrganization` nos perfis (`url`, `foundingDate`, `parentOrganization` quando houver fonte).
- `FAQPage` nas páginas de país. A marcação é válida, mas o Google limita os rich results de FAQ a sites governamentais e de saúde, então não há expectativa de rich result.

---

## 4. Fases de Execução

Ao final de cada fase: testes, build e commits atômicos.

### Fase 0: ADRs e playbooks

- Inicializar o repositório e escrever os 13 ADRs da seção 2.5.
- `docs/SEO_PLAYBOOK.md`: URLs canônicas e barra final, limiares da seção 3.5, plano de i18n futuro (matriz de `hreflang`), internal linking, uso do Search Console e estratégia de badges e outreach.
- `docs/MONETIZATION_PLAYBOOK.md`:
  - configuração de afiliados (NordVPN, ExpressVPN, Surfshark, Proton VPN, PressReader etc.), regras de copy permitida e proibida;
  - preços por tier de país;
  - setup do LemonSqueezy (produto, variants, webhook, modo de teste);
  - critérios para ligar anúncios (aprovação, CMP, limiares de tráfego de cada rede).
- `docs/EDITORIAL_METHODOLOGY.md`: base de `/methodology/`, verificação, fontes aceitas, taxonomia de propriedade e de viés e processo de correções.

### Fase 1: Scaffold, tooling, schemas e D1

- Astro 7 + TypeScript estrito + Tailwind + Preact + `@astrojs/cloudflare` + `wrangler.jsonc` (D1, Analytics Engine, Rate Limiting, Cron Trigger).
- **Scripts `pnpm`** (sem Makefile): `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `test`, `test:watch`, `test:coverage`, `e2e`, `a11y`, `lhci`, `seo:audit`, `catalog:*`, `sponsorships:snapshot`, `db:generate`, `db:migrate:local`, `db:migrate:remote`, `deploy`.
- `eslint.config.js`, `.prettierrc`, `.editorconfig`, `.gitignore`, `.nvmrc`, `.env.example`.
- `src/schemas/`: `geo.schema.ts`, `catalog.schema.ts` (País, Veículo, Categoria, SEO context) e `monetization.schema.ts` (afiliados, preços, países com VPN restrita, payloads de submissão e checkout).
- `src/db/`: schema Drizzle da seção 3.7 + migrations.

### Fase 2: Pipeline do catálogo e dados dos 20 países

- Implementar `tools/catalog-cli` (seção 3.4).
- `data/geo/countries.json`: os 249 códigos ISO-3166-1 com nome em `en`, continente, `also_in`, vizinhos e idiomas oficiais. É usado em lookups e no internal linking futuro, e **não gera páginas**.
- **Países do v1.0** (as 20 maiores economias por PIB nominal; a lista é editável em `data/launch-countries.json`):

| Continente | Países |
|---|---|
| América do Norte | United States (US), Canada (CA), Mexico (MX) |
| América do Sul | Brazil (BR) |
| Europa | Germany (DE), United Kingdom (GB), France (FR), Italy (IT), Spain (ES), Netherlands (NL), Switzerland (CH), Russia (RU, also_in asia) |
| Ásia | China (CN), Japan (JP), India (IN), South Korea (KR), Indonesia (ID), Saudi Arabia (SA), Türkiye (TR, also_in europe) |
| Oceania | Australia (AU) |

- **Meta por país:** 15–40 veículos nas 8 categorias. O agente gera candidatos com `catalog:draft` + `catalog:health`. O proprietário verifica, e só então o país recebe `published: true`.
- Rascunhar `seo_context.en` (summary, 4 FAQs, intros de categoria) para revisão do proprietário.
- `catalog:icons` para ícones e monogramas.
- **Testes:**
  - todos os arquivos passam no Zod;
  - nenhuma colisão de ID ou slug;
  - todas as URLs são `https://`;
  - `ranks` são consistentes;
  - países publicados atendem aos limiares;
  - nenhum veículo `candidate` aparece em `dist/`.

### Fase 3: Design system e componentes

- `src/styles/tokens.css` com os dois temas e contraste AA.
- `src/components/`:
  - `Header.astro`: logo, gatilho ⌘K, link "Advertise", alternador de tema. O seletor de idioma fica oculto enquanto houver um único locale.
  - `CategoryColumnCard.astro`
  - `OutletRow.astro`, com o card de detalhe em Popover
  - `SponsoredSlot.astro`
  - `AffiliateCard.astro`, com espaço reservado e colapso sem layout shift
  - `AdSlot.astro`, que renderiza só o placeholder enquanto `ADS_ENABLED=false`
  - `Breadcrumbs.astro`
  - `FilterBar.tsx`: filtros de paywall, tipo de propriedade, formato e busca local
  - `CommandPalette.tsx`: Pagefind, cobrindo países, veículos e categorias

### Fase 4: Rotas e SEO

- Rotas da seção 3.1, respeitando os limiares da seção 3.5.
- **Página do país:**
  - as colunas;
  - a FilterBar;
  - o bloco de afiliado;
  - o guia do ecossistema de mídia (`summary`);
  - a FAQ;
  - os vizinhos;
  - o box de liberdade de imprensa com atribuição à RSF.
- **Página de categoria:** a intro, uma tabela comparativa (fundação, dono, paywall, propriedade, RSS) e a lista detalhada.
- **Perfil do veículo:** a ficha técnica, as fontes, os similares, o snippet de badge e o link "Report a correction".
- **Páginas institucionais** da seção 3.9, mais `/about/` e `/advertise/`.
- **Geradores técnicos:**
  - `src/lib/seo/jsonld.ts`, `src/lib/seo/meta.ts`, `src/lib/seo/hreflang.ts`;
  - `sitemap-index.xml` + `sitemap-en.xml`, só com páginas indexáveis;
  - `robots.txt`: libera o site, `Disallow: /go/`, `/api/`, `/admin/`, e aponta o sitemap.

### Fase 5: Monetização

- R1: `/advertise/`, `/api/slots`, `/api/checkout` (com reserva), webhook LemonSqueezy, aprovação no admin, `sponsorships:snapshot`, gatilho de rebuild e Cron Trigger de expiração.
- R2: `src/lib/monetization/affiliates.ts`, `/api/geo` e a regra de ocultação.
- R3: `AdSlot` + configuração do CMP + `ads.txt`, tudo atrás de `ADS_ENABLED`.
- H1: `/go/[id]`, `/api/track`, Analytics Engine, deduplicação e filtro de bots.
- H2: `/badge/[country]/[outlet].svg` + snippet.
- **Admin (`/admin`, atrás do Access):**
  - cliques filtrados por país, categoria e veículo (consulta SQL ao Analytics Engine);
  - top 20 veículos;
  - CTR dos blocos de afiliado;
  - submissões (aprovar, rejeitar ou reembolsar);
  - patrocínios ativos e vagas;
  - pedidos de correção;
  - exportação CSV.

### Fase 6: Testes, auditoria e hardening

- **Vitest:**
  - ordenação: patrocinados 1, 2 e 3 sempre antes dos orgânicos, e orgânicos por `ranks[categoria]`;
  - seleção de afiliados e copy proibida ausente;
  - JSON-LD, canonical e `hreflang` (incluindo o cenário multi-locale);
  - limiares de publicação e indexação;
  - `/go` (allowlist, rejeição de destinos arbitrários);
  - `/api/track` (deduplicação);
  - `/api/checkout` (reserva concorrente da mesma vaga falha);
  - webhook (assinatura inválida, evento repetido, cada transição de status);
  - escape do SVG do badge;
  - validação do JWT do Access.
  As rotas de API rodam contra D1 local (Miniflare).
- **`tools/seo-audit.ts` sobre `dist/`:**
  - zero `<title>` vazio ou duplicado; title com 30–60 caracteres e description com 110–160;
  - canonical presente e absoluto;
  - `hreflang` recíproco apenas quando houver mais de um locale;
  - todos os blocos JSON-LD sintaticamente válidos e com os tipos esperados;
  - zero links internos quebrados;
  - zero páginas `noindex` no sitemap;
  - nenhum link externo para `/go` sem `rel="sponsored"`.
- **Playwright + axe:** Home → país → filtrar "Free" → ⌘K buscar veículo → perfil → copiar o snippet do badge → sugerir veículo (Turnstile em modo de teste) → fluxo de patrocínio em modo simulação → alternar tema → abrir o card de detalhe pelo teclado.
- **Lighthouse CI:** metas da seção 1.3 em home, país, categoria e perfil.

### Fase 7: Infra, CI/CD e documentação

- `deploy/cloudflare/`:
  - `wrangler.toml` comentado;
  - script ou Terraform para Cache Rules (bypass em `/api/*`, `/go/*`, `/admin/*`), WAF (Bot Fight Mode, rate limit em `/api/*`) e Cloudflare Access para `/admin*`;
  - `public/_headers`.
- `.github/workflows/`:
  - `ci.yml` (PR e push): lint, typecheck, `catalog:validate`, `test:coverage`, build, `seo:audit`, e2e, lhci.
  - `deploy.yml` (push na `main` e `workflow_dispatch`, que também é o gatilho de rebuild de patrocínio): `sponsorships:snapshot` → build → `wrangler deploy`.
  - `scheduled.yml`: rebuild diário (expirações), `catalog:health` semanal (abre issue com o relatório) e backup semanal do D1 no R2.
- **`README.md` para o proprietário:**
  - colocar no ar em Cloudflare em cerca de 15 minutos (domínio, D1, secrets, Access, Turnstile, LemonSqueezy);
  - fluxo de verificação do catálogo (`catalog:draft` → revisar → `verified` → `published`);
  - onde configurar afiliados e, quando chegar a hora, anúncios e CMP;
  - como adicionar países e locales.

### Pós-lançamento (roadmap, fora do v1.0)

1. Próxima onda de países: Nigeria, South Africa, Egypt, Kenya, Argentina, Colombia, Chile, Poland, Sweden, Philippines etc.
2. Locales `pt`, `es`, `fr`, `de`, ativando o `hreflang`.
3. Newsletter (R4).
4. Mapa-múndi interativo (SVG leve, ilha `client:visible`).
5. Anúncios (R3), quando os critérios do playbook forem atingidos.
6. Rankings globais por categoria.

---

## 5. Definition of Done

### 5.1 DoD técnico (cumprido pelo agente, comprovado por execução no terminal)

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage` (≥ 85% em `src/lib` e APIs), `pnpm build`, `pnpm seo:audit`, `pnpm e2e` e `pnpm lhci` passam.
- [ ] `pnpm catalog:validate` passa. O pipeline `draft → health → verify → publish` funciona de ponta a ponta. Candidatos para os 20 países estão prontos para revisão, com `catalog:report` mostrando a cobertura.
- [ ] A UX de diretório está implementada: colunas densas, ícones locais, indicadores com texto, card de detalhe acessível, FilterBar e ⌘K.
- [ ] Os limiares da seção 3.5 são aplicados, e o sitemap contém só páginas indexáveis.
- [ ] R1 (simulação de ponta a ponta, incluindo reserva, webhook e expiração), R2, H1 e H2 funcionam. R3 está pronto e desligado.
- [ ] O admin funciona atrás do Access, com validação de JWT testada.
- [ ] O deploy em Cloudflare está documentado e foi testado em ambiente de preview.

### 5.2 DoD de lançamento (depende do proprietário)

- [ ] Os 20 países estão com `published: true`, ou seja, veículos verificados e textos revisados.
- [ ] Metodologia, privacidade, termos e disclosures foram aprovados.
- [ ] As chaves reais estão configuradas e um pagamento real de teste foi feito e reembolsado.
- [ ] O Search Console está configurado e o sitemap foi enviado.

---

## 6. Proibições

- Não publicar veículos `candidate` nem dados sem verificação humana.
- Não gerar páginas que não atendam aos limiares da seção 3.5.
- Não carregar favicons, fontes ou bandeiras de serviços externos no navegador (por exemplo, `google.com/s2/favicons`).
- Não usar bibliotecas pesadas de UI (Material UI, Ant Design, Chakra, Bootstrap).
- Não deixar links patrocinados ou de afiliados sem `rel="sponsored"`.
- Não aceitar URLs de destino arbitrárias em `/go`.
- Não usar copy de afiliado que incentive burlar paywall, direitos de transmissão ou leis locais.
- Não carregar scripts de anúncio sem o CMP configurado.
- Não armazenar IP ou User-Agent em claro.
- Não rotular viés político ou controle estatal sem fonte.
- Não mencionar publicamente as referências de UX internas.

---

## Apêndice A: Questões da v1 e como foram resolvidas

| # | Questão na v1 | Resolução |
|---|---|---|
| 1 | Catálogo "real e verificado" gerado de forma autônoma (risco de alucinação) | Status `candidate` → `verified` com verificação exclusiva do proprietário, fontes obrigatórias e `catalog:health` (3.4) |
| 2 | SEO programático em escala (scaled content abuse) | Limiares de geração e indexação, `noindex` para perfis sem `about`, sitemap só com páginas indexáveis, lançamento com 20 países e 1 idioma (3.5) |
| 3 | Deploy duplo Workers + VPS (`better-sqlite3` não roda em Workers) | Somente Cloudflare. Lógica pura em `src/lib` como estratégia de saída (2.1, ADR 0008) |
| 4 | `sponsored` no JSON e na tabela (duas fontes de verdade, exigia rebuild sem gatilho) | Só no D1, com snapshot no build, rebuild por dispatch e cron de expiração (3.6.1) |
| 5 | Banner por geo em HTML estático cacheado | Oferta escolhida pelo contexto da página em build-time. Geo usado só para ocultar, via `/api/geo` (3.6.2) |
| 6 | "Vagas Top-3 em tempo real" numa página estática | `GET /api/slots` dinâmico + reserva com índice único (3.6.1, 3.7) |
| 7 | Limite de cerca de 20 mil arquivos por deploy | Cerca de 1 mil páginas no v1.0. Badges dinâmicos no Worker |
| 8 | `rank_in_category` ambíguo | Mapa `ranks` por categoria (3.2.2) |
| 9 | Slug de veículo global (colisões) | URL `/[country]/outlet/[outlet]/`, slug único por país (3.11) |
| 10 | Continente na URL (transcontinentais, profundidade) | Continente só como atributo + `also_in`. Hubs em `/continent/` (3.2.1) |
| 11 | CSP estrita incompatível com AdSense | Dois perfis de CSP documentados (3.8) |
| 12 | Open redirect em `/go` | Allowlist de catálogo e afiliados (3.6.4) |
| 13 | `/api/track` inflável (fraude) | Bot score, deduplicação, rate limit e rótulo "estimate" (3.6.4) |
| 14 | Admin com token simples | Cloudflare Access + validação de JWT + checagem de Origin (3.8) |
| 15 | Webhook só ativava (sem cancelamento, falha, reembolso, idempotência) | Ciclo de vida completo + `webhook_events` (3.6.1) |
| 16 | Spam em formulários | Turnstile + rate limit (3.8) |
| 17 | XSS em SVG | Escape + CSP no badge (3.6.5) |
| 18 | Ausência de CMP para AdSense | CMP certificado obrigatório antes de ligar anúncios (3.6.3, 3.9) |
| 19 | Newsletter sem provedor de envio | Movida para o pós-lançamento, com requisitos definidos (3.6.6) |
| 20 | Risco legal em rótulos de viés e "state media" | `ownership_type` separado de `political_lean`, padrão `unrated`, fonte obrigatória, metodologia e correções (3.2.2, 3.9) |
| 21 | Copy de VPN para burlar bloqueio e paywall | Copy permitida e proibida, ocultação em países com VPN restrita, PressReader para paywall (3.6.2) |
| 22 | Badges com âncora de palavra-chave (link scheme) | Âncora só com a marca, `rel="sponsored"` para patrocinados (3.6.5) |
| 23 | Patrocínio misturado ao ranking | Rótulo textual "Sponsored", separação visual, disclosures (3.6.1) |
| 24 | Impostos internacionais com Stripe direto | LemonSqueezy como Merchant of Record (ADR 0013) |
| 25 | Metas de CWV irreais (LCP < 1 s, CLS = 0,00 com anúncios) | Metas de laboratório e de campo separadas e realistas (1.3) |
| 26 | Exigência de tradução impossível de cumprir (exemplo só com en/pt/es) | Locales obrigatórios = `ENABLED_LOCALES` (v1.0: `en`) |
| 27 | JSON inválido (comentários, URLs em markdown) e bloco de código não fechado | Exemplos em JSON válido, enums em tabelas, markdown corrigido |
| 28 | "Pro" no ADR 0005 sem definição | Removido. Modelo com 4 receitas + 2 habilitadores (3.6) |
| 29 | `SearchAction` e expectativa de rich result de FAQ | `SearchAction` removido, FAQ sem expectativa de rich result (3.12) |
| 30 | `robots.txt` como bloqueio de scrapers | Bloqueio via WAF e Bot Fight Mode (3.8) |
| 31 | Indicadores só por cor e emoji | Indicadores sempre com texto, bandeiras SVG locais (3.10) |
| 32 | Escopo grande demais para o lançamento | Mapa, newsletter, anúncios, locales e rankings globais no roadmap pós-lançamento |
| 33 | Autonomia irrestrita, inclusive sobre dados e chaves | Autonomia em código e pontos de parada definidos para o proprietário (1.2) |
