# ApexPRO — Sistema de Gestão de Performance Esportiva (Paulista FC)

> Instruções do projeto. Carregado automaticamente em toda conversa neste diretório.

---

## 🧭 Contexto rápido

**Stack:** Hono v4 + Drizzle + SQLite (backend `:3001`) · React 19 + Vite + Tailwind v4 (frontend `:5173`) · PM2 + Nginx + Certbot em produção (`https://apexpro.grupommp.com.br`, VPS Hostgator).

**Domínio:** análise de performance física de atletas a partir de CSVs do GPS Catapult — ACWR, microciclo MD-N, anomalias z-score, benchmarks por posição, dashboards e export PDF.

**Detalhes completos:** sempre consultar `HANDOVER.md` (estrutura, endpoints, fases 1-28).

---

## 🤖 Roteamento de Agentes — REGRA OBRIGATÓRIA

**Antes de iniciar qualquer tarefa que envolva implementação, refactor, debug profundo, review ou auditoria, consultar a tabela abaixo e usar o agente correspondente como padrão.**

### Quando NÃO usar agente

Tasks abaixo seguem inline (mais rápido que invocar subagente):
- Fix de 1-5 linhas com causa óbvia
- Pergunta conversacional ("o que significa MD?")
- Edit pontual em arquivo único já identificado
- Comando shell único
- Atualização do HANDOVER após mudança já implementada

**Regra prática:** se a tarefa exige ler 3+ arquivos OU envolve decisão de arquitetura OU é difícil de reverter — use agente.

---

### 📋 Tabela de roteamento por área

| Área | Tipo de tarefa | Agente primário | Fallback |
|---|---|---|---|
| **Backend Hono/Node** | Nova rota, refactor estrutural, decisão de arquitetura | `Backend Architect` | `Software Architect` |
| **Backend Hono/Node** | Implementação de feature já planejada | `code-implementer` | direto |
| **Frontend React/Tailwind** | Componente novo, página nova, redesign | `frontend-developer` | `Frontend Developer` |
| **Frontend React/Tailwind** | UX/IA, fluxo de usuário, wireframe | `UX Architect` | `ux-ui-product-mentor` |
| **Frontend React/Tailwind** | Design visual, paleta, sistema de componentes | `UI Designer` | `Brand Guardian` |
| **Database (SQLite/Drizzle)** | Schema novo, índice, query lenta, migração | `Database Optimizer` | `Data Engineer` |
| **Analytics estatístico** | ACWR, anomalias, fórmulas, p95, microciclo, validação de modelo | `Model QA Specialist` | `Analytics Reporter` |
| **Charts SVG (Radar, Scatter, ACWR, etc.)** | Novo chart, performance, acessibilidade visual | `frontend-developer` | `Visual Storyteller` |
| **DevOps / Deploy / VPS** | CI/CD, automação de deploy, infra | `DevOps Automator` | `brahma-deployer` |
| **DevOps / Deploy / VPS** | Observability, métricas, logs, SLO | `SRE (Site Reliability Engineer)` | `brahma-monitor` |
| **DevOps / Deploy / VPS** | Sistema lento em produção | `Performance Benchmarker` | `brahma-optimizer` |
| **Segurança** | Threat model, secure review, headers HTTP, JWT, XSS | `Security Engineer` | `Threat Detection Engineer` |
| **Segurança** | Compliance, LGPD, auditoria SOC2/ISO | `Compliance Auditor` | `Legal Compliance Checker` |
| **Acessibilidade** | WCAG, leitor de tela, contraste, navegação por teclado | `Accessibility Auditor` | direto |
| **Print/PDF/Relatório** | Layout, paginação, fidelidade visual ao tela | `frontend-developer` | direto |
| **Bug profundo / Incident** | Root cause análise, comportamento estranho que não se reproduz fácil | `brahma-investigator` | direto com tool Explore |
| **Bug profundo / Incident** | Sistema caiu, P1 em produção | `Incident Response Commander` | `SRE` |
| **Code Review / PR** | Review pré-merge | `Code Reviewer` | direto |
| **Refactor / Limpeza** | Reduzir duplicação, simplificar, identificar reuso | skill `simplify` + `Code Reviewer` | `Minimal Change Engineer` |
| **Pesquisa de libs** | Versão certa, breaking changes, comparativo | `docs-researcher` | `Tool Evaluator` |
| **Plano de implementação** | Quebrar feature em passos cirúrgicos com rollback | `implementation-planner` | `Plan` |
| **Coordenação multi-domínio** | Feature que toca backend + frontend + DB + DevOps | `chief-architect` | `Software Architect` |
| **Documentação técnica** | README, manual, doc de API | `Technical Writer` | direto |
| **Onboarding em código não-familiar** | Entender área que não conhece | `Codebase Onboarding Engineer` | `Explore` |
| **Exploração / busca no codebase** | Achar onde algo está definido | tool `Explore` (não Agent) | `Glob` + `Grep` |
| **Testes de API** | Smoke test, integration test dos endpoints Hono | `API Tester` | direto |

---

### 🚨 Agentes a NUNCA usar neste projeto

Apenas para evitar ruído na escolha:

- Gaming: `Unity *`, `Unreal *`, `Godot *`, `Roblox *`, `Blender *`, `Game Designer`, `Level Designer`, `Narrative Designer`, `Technical Artist`, `Game Audio Engineer`
- Marketing China: `Baidu *`, `Bilibili *`, `Douyin *`, `Kuaishou *`, `Weibo *`, `WeChat *`, `Xiaohongshu *`, `Zhihu *`, `China *`, `Healthcare Marketing Compliance Specialist`, `Government Digital Presales Consultant`, `Feishu *`, `Recruitment Specialist`, `Supply Chain Strategist`, `Corporate Training Designer`, `Study Abroad Advisor`, `Cross-Border E-Commerce Specialist`, `Private Domain Operator`, `Podcast Strategist`, `Livestream Commerce Coach`, `Government Digital Presales Consultant`
- CMS legados: `CMS Developer` (Drupal/WordPress — não usamos), `Filament Optimization Specialist` (Filament PHP — não usamos)
- Mobile/Native fora do escopo: `Mobile App Builder`, `App Store Optimizer`, `Embedded Firmware Engineer`, `macOS Spatial/Metal Engineer`, `visionOS Spatial Engineer`, `XR *`, `Terminal Integration Specialist`
- Marketing/Vendas/CS irrelevantes ao MVP atual: todos os agentes de `Sales *`, `Outbound *`, `Paid Media *`, `PPC *`, `SEO *`, `Twitter *`, `LinkedIn *`, `TikTok *`, `Reddit *`, `Instagram *`, `Carousel *`, `Growth Hacker`, `Content Creator`, `Whimsy Injector`, `Customer Service`, `Support Responder`, `Hospitality *`, `Retail *`, `Loan *`, `Real Estate *`, `Legal *`, `Healthcare Customer Service`, `HR Onboarding`
- Finance/Tax/Legal corporativo: `Bookkeeper *`, `FP&A Analyst`, `Tax Strategist`, `Investment Researcher`, `Accounts Payable Agent`
- Blockchain/Web3: `Solidity *`, `Blockchain Security Auditor`
- Outros fora do escopo: `Civil Engineer`, `Anthropologist`, `Geographer`, `Historian`, `Psychologist`, `Narratologist`, `Korean Business Navigator`, `French Consulting Market Navigator`, `Image Prompt Engineer`, `Inclusive Visuals Specialist`

> Se em dúvida sobre um agente não listado, perguntar ao usuário antes de invocar.

---

### 📌 Padrões de invocação

**Para um agente direto (uma tarefa, finalizar e voltar):**
- Briefing autocontido — agente não vê o contexto desta conversa
- Sempre incluir: stack do projeto, arquivos relevantes (com paths), o que NÃO mudar, formato de resposta esperado
- Pedir resposta curta quando o output é só pra informar ("report em <200 palavras")

**Para múltiplos agentes em paralelo:**
- Usar quando tarefas são independentes (ex: `Security Engineer` + `Accessibility Auditor` no mesmo branch)
- 1 mensagem com múltiplas tool calls

**Para fluxo complexo encadeado:**
- Usar `chief-architect` que orquestra `docs-researcher → implementation-planner → code-implementer`
- Equivalente à skill `/workflow`

---

## ⚙️ Convenções do projeto (lembretes operacionais)

1. **Branch `main` é a versão de produção.** Toda mudança commitada e empurrada vai pra VPS no próximo `git pull` (manual hoje).
2. **HANDOVER.md é a fonte de verdade.** Toda alteração não-trivial (rota nova, página, refactor estrutural, mudança de infra) cria uma "Fase N+1" no histórico + atualiza Estrutura/Endpoints/Páginas + a data no rodapé.
3. **Comentários no código:** default é zero. Só comentar onde o "porquê" é não-óbvio (constraint escondida, workaround específico). Nunca comentar o "o quê" — bons nomes resolvem.
4. **Sem feature flag, sem backward-compat shim** — o código tem 1 cliente (Eduardo). Pode trocar direto.
5. **Notação MD-N** é obrigatória em qualquer feature de microciclo (nunca "dia -3" ou "3 dias antes").
6. **Print CSS** está concentrado em `frontend/src/index.css` (`@media print`). Alterações em layout de tela podem afetar print — sempre testar `Ctrl+P` depois.
7. **Deploy** segue Fase 27 do HANDOVER: `git pull` na VPS + build do frontend + `pm2 restart apexpro-backend`.
8. **Sem CI/CD ainda** — todo deploy é manual via SSH. Se for adicionar GitHub Actions, invocar `DevOps Automator`.

---

## 🔐 Coisas que NUNCA devem entrar no git

- `backend/.env` (já em `.gitignore`)
- `backend/*.db`, `*.db-wal`, `*.db-shm` (já em `.gitignore`)
- `backend/uploads/` (fotos dos atletas — já em `.gitignore`)
- Chaves SSH privadas, JWT_SECRET em texto, AUTH_PASSWORD_HASH novo

Se um commit acidentalmente subir algo sensível, **invocar `Security Engineer` imediatamente** para procedimento de rotação + git history rewrite.

---

**Versão deste arquivo:** 1.0 (criado 2026-05-25 ao final da Fase 28 do HANDOVER).
