# Residuais de Acessibilidade (pós-Onda 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os 3 residuais de acessibilidade da Fase 34 (contraste de cor semântica, `nested-interactive` no card de Sessões, landmarks/heading-order), levando a varredura axe-core a 0 crítico / 0 sério.

**Architecture:** Edições cirúrgicas em páginas/componentes. Tarefas 1-3 são edições estruturais bem-definidas (subagent-friendly). Tarefa 4 (contraste) é **dirigida pelo controlador** de forma iterativa com axe-core headless (o subagente não roda axe). Tarefa 5 é a varredura/print/HANDOVER final (controlador).

**Tech Stack:** React 19 + Vite + Tailwind v4. Sem framework de testes — verificação = `npm --prefix frontend run build` verde + **axe-core headless** (Chrome via puppeteer) + `Ctrl+P` + screenshot.

## Global Constraints

- **Sem libs novas.** Charts seguem SVG/div inline.
- **Paridade dark/light:** mudanças de cor são **só no claro** — NUNCA alterar classes `dark:`. O "Dark Premium" deve ficar intacto.
- **1 usuário real** (Eduardo) — sem feature flag, sem backward-compat.
- **Print acoplado:** `@media print` em `index.css` foi corrigido (Fase 33). Tarefas que mexem em layout/tabela/heading exigem revalidar `Ctrl+P`.
- **Comentários:** default zero (CLAUDE.md #3).
- **Branch:** `feat/ux-residuais-a11y` (já criado).
- Build (sempre): `npm --prefix frontend run build` — deve terminar `✓ built in ...`.
- Gate de a11y: axe-core headless nas páginas-chave, **0 crítico / 0 sério**; residual só se documentado.

## File Structure

| Arquivo | Mudança |
|---|---|
| `frontend/src/pages/Sessoes.tsx` | Card `<button>`→`<div role="button">` + teclado (Task 1) |
| `frontend/src/pages/{Painel,Sessoes,Comparar,JogadorPerfil,SessaoDashboard,Backups}.tsx` | `<main>`→`<div>` (Task 2) |
| `frontend/src/pages/Login.tsx` | conteúdo envolto em `<main>` (Task 2) |
| páginas com heading pulado (Painel/Sessões/Backups + componentes de heading) | níveis sequenciais (Task 3) |
| `frontend/src/pages/Painel.tsx` + componentes/charts com cor de texto | contraste semântico no claro (Task 4) |
| `HANDOVER.md` | fase nova (Task 5) |

---

### Task 1: Card de Sessões deixa de ser `<button>` aninhando `<button>`

**Files:**
- Modify: `frontend/src/pages/Sessoes.tsx` (componente `SACard`: abertura do card ~linha 153-154; fechamento `</button>` ~linha 243; botões internos Editar/Excluir ~linhas 226-241)

**Interfaces:**
- Consome: props do `SACard` (`sessao`, `cargaMax`, `onClick`, `onEdit`, `onDelete`) já existentes.
- Produz: card acessível por teclado; nada depende disto em tasks seguintes.

- [ ] **Step 1: Trocar o elemento raiz do card de `<button>` para `<div role="button">`**

Substituir a abertura (linhas 153-154):

```tsx
    <button onClick={onClick}
      className="group relative w-full text-left bg-card rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden hover:shadow-lg hover:border-slate-300 dark:hover:border-white/15 transition-all hover:-translate-y-0.5">
```

por:

```tsx
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="group relative w-full text-left bg-card rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden hover:shadow-lg hover:border-slate-300 dark:hover:border-white/15 transition-all hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-red/50">
```

- [ ] **Step 2: Fechar com `</div>` em vez de `</button>`**

Na linha ~243, trocar o `</button>` que fecha o card por `</div>`. (É o `</button>` logo após o bloco dos botões Editar/Excluir, fechando o card inteiro — NÃO os botões internos.)

- [ ] **Step 3: Garantir que clicar Editar/Excluir não dispara a navegação do card**

Abrir as definições de `onEdit`/`onDelete` passadas ao `SACard` (no componente pai que renderiza `<SACard ... onEdit={...} onDelete={...}>`). Confirmar que ambas chamam `e.stopPropagation()`. Se NÃO chamarem, adicionar `e.stopPropagation();` no início de cada handler (ou nos `onClick` dos botões internos: `onClick={e => { e.stopPropagation(); onEdit(e); }}`). Manter o `onMouseDown={e => e.stopPropagation()}` que já existe nos botões.

- [ ] **Step 4: Build**

Run: `npm --prefix frontend run build` — Expected: `✓ built in ...`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Sessoes.tsx
git commit -m "fix(a11y): card de sessao vira div[role=button] (remove button aninhado em button)"
```

(Verificação de teclado/axe fica na Task 5.)

---

### Task 2: Um único landmark `<main>` (Layout) + `<main>` no Login

**Files:**
- Modify: `frontend/src/pages/Painel.tsx` (~607), `frontend/src/pages/Sessoes.tsx` (~759), `frontend/src/pages/Comparar.tsx` (~238), `frontend/src/pages/JogadorPerfil.tsx` (~586), `frontend/src/pages/SessaoDashboard.tsx` (~1333), `frontend/src/pages/Backups.tsx` (~114) — cada um tem UM `<main className=...>` que vira `<div>`.
- Modify: `frontend/src/pages/Login.tsx` (conteúdo principal ~linha 46)

**Interfaces:** nenhuma dependência entre tasks.

**Contexto:** O `Layout` (`pages/Layout.tsx:228`) já provê o único `<main>` que envolve o `<Outlet/>`. Cada página renderizada dentro dele declara seu próprio `<main>`, gerando `<main>` duplicado/aninhado. O Login fica FORA do Layout (sem `<main>`).

- [ ] **Step 1: Trocar `<main>`→`<div>` em cada uma das 6 páginas**

Em cada arquivo, localizar a tag de abertura `<main className="...">` e trocar por `<div className="...">` (manter as classes idênticas), e trocar o `</main>` correspondente (o que fecha essa página) por `</div>`. Páginas e abertura atual:
- `Painel.tsx`: `<main className="p-6 space-y-6 max-w-[1600px] mx-auto">`
- `Sessoes.tsx`: `<main className="p-6">`
- `Comparar.tsx`: `<main className="p-6 space-y-6">`
- `JogadorPerfil.tsx`: `<main className="py-4 md:py-6 w-full space-y-6 px-3 md:px-4 lg:px-4">`
- `SessaoDashboard.tsx`: `<main className="py-4 md:py-6 w-full space-y-6 px-3 md:px-4 lg:px-4">`
- `Backups.tsx`: `<main className="p-6 md:p-8 max-w-4xl mx-auto">`

(Cada página tem só UM `<main>`; o `</main>` a trocar é o de fechamento do mesmo. NÃO tocar no `<main>` do `Layout.tsx`.)

- [ ] **Step 2: Login ganha seu próprio `<main>`**

Em `frontend/src/pages/Login.tsx`, o conteúdo principal está em `<div className="w-full max-w-md relative z-10">` (~linha 46). Trocar essa abertura por `<main className="w-full max-w-md relative z-10">` e o `</div>` correspondente (o que fecha esse wrapper, perto do fim do componente) por `</main>`.

- [ ] **Step 3: Build**

Run: `npm --prefix frontend run build` — Expected: `✓ built in ...`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages
git commit -m "fix(a11y): um unico landmark main (Layout); paginas usam div; Login ganha main"
```

---

### Task 3: heading-order — níveis de heading sequenciais

**Files:**
- Modify: páginas/componentes com salto de nível, a confirmar por inspeção (axe acusou `heading-order` em **Painel, Sessões, Backups**).

**Interfaces:** nenhuma.

**Nota:** alguns headings vêm de componentes compartilhados (ex.: títulos de card/seção, `PageHeader`, `EmptyState`), não do arquivo da página — por isso a inspeção é necessária. `Backups.tsx` não tem `<h*>` próprio; o `h3` acusado vem de um filho.

- [ ] **Step 1: Mapear os headings renderizados nas 3 páginas**

Run (na raiz):
```bash
grep -rnE "<h[1-6]" frontend/src/pages/Painel.tsx frontend/src/pages/Sessoes.tsx frontend/src/pages/Backups.tsx frontend/src/components
```
Identificar, por página, a ordem de níveis que o usuário vê (do topo pra baixo). `heading-order` falha quando um nível é pulado (ex.: `h1` direto pra `h3`, ou primeira heading da página é `h3`).

- [ ] **Step 2: Corrigir os saltos**

Para cada salto, ajustar a TAG (`h1/h2/h3/...`) para a sequência correta, **sem mudar o tamanho visual** — a classe de fonte (`text-2xl`, `text-base`, etc.) permanece; muda só o elemento. Regra: título principal da página = `h1`; títulos de seção abaixo = `h2`; subtítulos dentro de seção = `h3`. Garantir que não há salto (h1→h3) e que a página não começa por nível > h1.

- [ ] **Step 3: Build**

Run: `npm --prefix frontend run build` — Expected: `✓ built in ...`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "fix(a11y): ordem de headings sequencial (heading-order) em Painel/Sessoes/Backups"
```

---

### Task 4: Contraste de cor semântica — híbrido, só no claro (CONTROLLER-DRIVEN)

> **Esta task é executada pelo controlador** (precisa de loop com axe-core headless). Não despachar implementer cego.

**Files:**
- Modify: arquivos com texto de cor semântica de baixo contraste no claro (axe nomeou `text-emerald-500`; há 14 ocorrências de emerald-500/600 em 8 arquivos; conferir também `text-amber-500`, `text-red-500`/`rose`, `text-cyan-500`, `text-orange-500`), e os badges de anomalia branco-sobre-âmbar em `frontend/src/pages/Painel.tsx`.

**Interfaces:** nenhuma.

- [ ] **Step 1: Subir dev servers + axe baseline**

Backend throwaway em :3002 + frontend (proxy/VITE_API_URL) + script axe-core (ver memória `frontend-visual-verification`). Rodar axe nas páginas-chave (claro) e listar os nós `color-contrast` por classe de cor.

- [ ] **Step 2: Escurecer texto colorido pequeno no claro até 4.5:1**

Para cada classe de **texto** colorido acusada como texto pequeno, no claro escurecer pro shade que bate AA, preservando o `dark:`. Padrões (aplicar onde o elemento é texto pequeno):
- `text-emerald-500` → `text-emerald-700` (mantendo `dark:text-emerald-...` existente; se não houver `dark:`, adicionar `dark:text-emerald-500` pra não escurecer o dark).
- `text-amber-500` → `text-amber-600`/`-700` conforme medição; `text-cyan-500`→`-700`; `text-orange-500`→`-600`; `text-red-500`/`text-rose-500` já costumam passar — só ajustar se acusado.

- [ ] **Step 3: Texto colorido grande/bold só até 3:1**

Onde o texto colorido é grande (≥24px) ou bold ≥18.66px (ex.: números grandes de métrica, % de donut), escurecer só o suficiente pro shade 3:1 (ex.: `emerald-500`→`emerald-600`) — preserva mais a vivacidade. Decidir por inspeção do tamanho/peso de cada nó acusado.

- [ ] **Step 4: Badges branco-sobre-âmbar (Painel)**

Localizar os chips de anomalia (`text-white` com fundo de cor de métrica clara, dentro do card de anomalias `.border-amber-500/15`). Garantir par texto/fundo ≥4.5:1: escurecer o fundo do chip (usar o shade -600/-700 da cor da métrica) ou trocar o texto pra escuro quando o fundo for claro. Conferir nos 2 modos.

- [ ] **Step 5: Re-scan + iterar**

Rodar axe de novo. Repetir Steps 2-4 nos nós remanescentes até `serious color-contrast` = 0 (ou residual mínimo, documentado com justificativa). Conferir **paridade dark** por screenshot (Painel/SessaoDashboard escuro) — o dark não pode ter mudado.

- [ ] **Step 6: Build + Commit**

Run: `npm --prefix frontend run build` — Expected: `✓ built in ...`.
```bash
git add frontend/src
git commit -m "fix(a11y): contraste de cor semantica no claro (hibrido: pequeno 4.5:1, grande 3:1) + badges"
```

---

### Task 5: Varredura final axe + print + HANDOVER (CONTROLLER-DRIVEN)

**Files:**
- Modify: `HANDOVER.md`

- [ ] **Step 1: Build final** — `npm --prefix frontend run build` → `✓ built in ...`.

- [ ] **Step 2: axe-core headless completo (dark+light)** — Login, Painel, Sessões, Comparar, JogadorPerfil, SessaoDashboard, Upload, Usuários, Backups. Confirmar **0 crítico / 0 sério**. Conferir teclado do card de Sessões (Tab→Enter/Espaço abre; Editar/Excluir alcançáveis).

- [ ] **Step 3: Regressão de print** — `Ctrl+P` (PDF real) em Comparar e numa sessão: fundo branco, sem regressão (Tasks 1-4 tocaram telas/headings).

- [ ] **Step 4: Atualizar HANDOVER.md** — fase **"Residuais de Acessibilidade — contraste semântico, card, landmarks"**: o que foi feito, resultado axe (0 crítico/sério), residual remanescente se houver. Atualizar a data do rodapé.

- [ ] **Step 5: Commit**

```bash
git add HANDOVER.md
git commit -m "docs: registra fase de residuais de acessibilidade no HANDOVER"
```

---

## Self-Review

**Spec coverage:**
- Spec §5.1 (contraste híbrido light-only + badges) → Task 4. ✓
- Spec §5.2 (card nested-interactive) → Task 1. ✓
- Spec §5.3 (main único + Login main; heading-order) → Tasks 2 e 3. ✓
- Spec §6 critérios (axe 0 crít/sério, teclado do card, build, Ctrl+P, paridade) → Task 5 + verificações por task. ✓
- Spec §7 riscos (escurecer demais / card teclado / heading×print) → Task 4 Step 5 (screenshot), Task 1 Step 3, Task 5 Step 3. ✓

**Placeholder scan:** edições estruturais (Tasks 1-3) têm string exata antes→depois; Task 4 é iterativa por design (controller + axe) com padrões/shades concretos de partida e critério de parada objetivo (axe=0), não um "TBD".

**Type/valor consistency:** props do `SACard` (`onClick`/`onEdit`/`onDelete`) usadas na Task 1 são as já existentes. `<main>` do Layout (228) preservado; só os 6 das páginas + Login mudam (Task 2).

**Deviação consciente:** `heading-order` (moderado) depende de inspeção do DOM/componentes compartilhados — a Task 3 embute o mapeamento (Step 1) em vez de pré-fixar cada tag, porque headings vêm de componentes além do arquivo da página.
