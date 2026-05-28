# ApexPRO — Sistema de Gestão de Performance Esportiva (Paulista FC)

> Instruções **específicas** deste projeto. Carregado automaticamente em toda conversa neste diretório.
> Roteamento genérico de agentes e skills está em `~/.claude/agent-skill-routing.md` (carregado via global).

---

## 🧭 Contexto

**Stack:** Hono v4 + Drizzle + SQLite (backend `:3001`) · React 19 + Vite + Tailwind v4 (frontend `:5173`) · PM2 + Nginx + Certbot em produção (`https://apexpro.grupommp.com.br`, VPS Hostgator).

**Domínio:** análise de performance física de atletas a partir de CSVs do GPS Catapult — ACWR, microciclo MD-N, anomalias z-score, benchmarks por posição, dashboards e export PDF.

**Detalhes completos:** sempre consultar `HANDOVER.md` (estrutura, endpoints, fases 1-28).

---

## 🚨 Agentes irrelevantes a este projeto

A regra geral de roteamento de agentes está em `~/.claude/agent-skill-routing.md`. Os abaixo são **inúteis para este projeto específico** e nunca devem ser invocados (web stack puro, sem mobile, sem gaming, sem blockchain, mercado brasileiro):

- **Game dev:** `Unity *`, `Unreal *`, `Godot *`, `Roblox *`, `Blender *`, `Game Designer`, `Level Designer`, `Narrative Designer`, `Technical Artist`, `Game Audio Engineer`
- **Marketing China:** `Baidu *`, `Bilibili *`, `Douyin *`, `Kuaishou *`, `Weibo *`, `WeChat *`, `Xiaohongshu *`, `Zhihu *`, `China *`, `Healthcare Marketing Compliance Specialist`, `Government Digital Presales Consultant`, `Feishu *`, `Recruitment Specialist`, `Supply Chain Strategist`, `Corporate Training Designer`, `Study Abroad Advisor`, `Cross-Border E-Commerce Specialist`, `Private Domain Operator`, `Podcast Strategist`, `Livestream Commerce Coach`
- **CMS legados:** `CMS Developer` (Drupal/WordPress), `Filament Optimization Specialist` (Filament PHP)
- **Mobile/Native:** `Mobile App Builder`, `App Store Optimizer`, `Embedded Firmware Engineer`, `macOS Spatial/Metal Engineer`, `visionOS Spatial Engineer`, `XR *`, `Terminal Integration Specialist`
- **Marketing/Vendas/CS irrelevantes ao MVP:** `Sales *`, `Outbound *`, `Paid Media *`, `PPC *`, `SEO *`, `Twitter *`, `LinkedIn *`, `TikTok *`, `Reddit *`, `Instagram *`, `Carousel *`, `Growth Hacker`, `Content Creator`, `Whimsy Injector`, `Customer Service`, `Support Responder`, `Hospitality *`, `Retail *`, `Loan *`, `Real Estate *`, `Legal *`, `Healthcare Customer Service`, `HR Onboarding`
- **Finance corporativo:** `Bookkeeper *`, `FP&A Analyst`, `Tax Strategist`, `Investment Researcher`, `Accounts Payable Agent`
- **Blockchain/Web3:** `Solidity *`, `Blockchain Security Auditor`
- **Outros fora do escopo:** `Civil Engineer`, `Anthropologist`, `Geographer`, `Historian`, `Psychologist`, `Narratologist`, `Korean Business Navigator`, `French Consulting Market Navigator`, `Image Prompt Engineer`, `Inclusive Visuals Specialist`

**Skill condicional:** `claude-api` — **não usar**, este projeto não importa `anthropic`/`@anthropic-ai/sdk`.

---

## ⚙️ Convenções operacionais

1. **Branch `main` é a versão de produção.** Toda mudança commitada e empurrada vai pra VPS no próximo `git pull` (manual hoje).
2. **HANDOVER.md é a fonte de verdade.** Toda alteração não-trivial (rota nova, página, refactor estrutural, mudança de infra) cria uma "Fase N+1" no histórico + atualiza Estrutura/Endpoints/Páginas + a data no rodapé.
3. **Comentários no código:** default é zero. Só comentar onde o "porquê" é não-óbvio (constraint escondida, workaround específico). Nunca comentar o "o quê" — bons nomes resolvem.
4. **Sem feature flag, sem backward-compat shim** — o código tem 1 cliente (Eduardo). Pode trocar direto.
5. **Notação MD-N** é obrigatória em qualquer feature de microciclo (nunca "dia -3" ou "3 dias antes"). MD = Match Day (jogo). MD-3 = treino 3 dias antes.
6. **Print CSS** está concentrado em `frontend/src/index.css` (`@media print`). Alterações em layout de tela podem afetar print — sempre testar `Ctrl+P` depois.
7. **Deploy** segue Fase 27 do HANDOVER: `git pull` na VPS + build do frontend + `pm2 restart apexpro-backend`.
8. **Sem CI/CD ainda** — todo deploy é manual via SSH. Se for adicionar GitHub Actions, invocar `DevOps Automator`.
9. **Tailwind v4** — IDE mostra warnings em `@custom-variant`, `@theme`, `@apply`. São cosméticos, o build é OK.
10. **Charts SVG inline** — não usar libs externas (Chart.js, Recharts, etc.) sem antes consultar. O padrão atual é SVG manual em `frontend/src/components/charts/`.

---

## 🔐 Coisas que NUNCA devem entrar no git

- `backend/.env` (já em `.gitignore`)
- `backend/*.db`, `*.db-wal`, `*.db-shm` (já em `.gitignore`)
- `backend/uploads/` (fotos dos atletas — já em `.gitignore`)
- Chaves SSH privadas, JWT_SECRET em texto, AUTH_PASSWORD_HASH novo

Se um commit acidentalmente subir algo sensível, **invocar `Security Engineer` imediatamente** para procedimento de rotação + git history rewrite.

---

## 🗺️ Mapas rápidos do projeto

**Convenções de domínio que voltam em quase toda feature:**
- Posições numeradas (`frontend/src/lib/constants.ts`): GOL/1/2/3/4/5/6/7 com siglas e cores
- Cores por métrica: `M_COLOR.dist=teal`, `mpm=navy`, `hsr=orange`, `sprint=red`, `acel=cyan`, `desac=purple`
- Benchmarks: `MD` fixo (10000m, 600m HSR…) é fallback global; `posicoes-benchmarks` retorna média + p95 por posição (≥3 amostras)
- ACWR: aguda (7d) / crônica (28d), zonas <0.8 sub-treinado / 0.8-1.3 ideal / 1.3-1.5 atenção / >1.5 risco
- Anomalias: |z-score| > 2 vs média pessoal, exige ≥4 sessões

**Onde mexer pra cada coisa:**
- Schema do banco → `backend/src/db/schema.ts`
- Lógica analytics → `backend/src/routes/analytics.ts`
- Auth/JWT → `backend/src/routes/auth.ts` + `frontend/src/lib/authClient.ts`
- Print CSS → `frontend/src/index.css` (bloco `@media print`)
- Cores/tema → `frontend/src/index.css` (bloco `@theme`)
- Constants do domínio → `frontend/src/lib/constants.ts`

---

**Versão deste arquivo:** 1.2 (2026-05-28 — roteamento genérico movido para `~/.claude/agent-skill-routing.md`; este CLAUDE.md fica só com o específico do projeto).
