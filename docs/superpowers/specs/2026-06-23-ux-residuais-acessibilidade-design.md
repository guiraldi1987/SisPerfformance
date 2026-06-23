# Spec — Residuais de Acessibilidade (pós-Onda 4)

**Data:** 2026-06-23
**Projeto:** ApexPRO (Paulista FC)
**Status:** aprovado no brainstorming

---

## 1. Objetivo

Fechar os 3 residuais de acessibilidade documentados na Fase 34 do HANDOVER, levando a varredura axe-core a **zero violações críticas E sérias** (com residual mínimo só se documentado e justificado). Frontend-only, sem libs novas.

## 2. Origem

Varredura axe-core headless (Chrome via puppeteer) feita na Onda 4 (2026-06-23) deixou três classes de achado em aberto, por exigirem decisão de design/estrutura:

1. **Contraste de cor semântica** (sério) — texto colorido pequeno falha AA no claro: `text-emerald-500` (status), badges de anomalia branco-sobre-âmbar no Painel, e similares. ~108 nós (Painel claro), ~19 (SessaoDashboard claro), 5 badges (Painel escuro).
2. **`nested-interactive`** (sério) — no card de Sessões os botões Editar/Excluir (`<button>`) ficam aninhados dentro do próprio card, que é um `<button>` (HTML inválido).
3. **Landmarks + heading-order** (moderado) — `<main>` duplicado/aninhado, conteúdo fora de landmark no Login, e níveis de heading pulados.

## 3. Decisões (confirmadas no brainstorming)

- **Contraste: abordagem híbrida.** Escurecer cor semântica **só no claro** (`dark:` preservado) até o limiar aplicável por tamanho: texto pequeno → 4.5:1; texto grande/bold → 3:1 (mantém mais vivacidade). Corrigir os badges branco-sobre-âmbar.
- **Card:** trocar o card de `<button>` para `<div role="button" tabIndex={0}>` com `onClick` + `onKeyDown` (Enter/Espaço), preservando os botões internos (que passam a ser válidos).
- **Landmarks:** um único `<main>` (o do Layout). Páginas usam `<div>`; Login ganha seu próprio `<main>`.
- **Sem libs novas; paridade dark/light; sem framework de testes** (verificação = build verde + axe-core headless + `Ctrl+P` + screenshot).

## 4. Escopo

**Dentro:** `frontend/src/pages/*` (Painel, Sessoes, Comparar, JogadorPerfil, SessaoDashboard, Backups, Login), componentes/charts afetados pelos badges/cores, e ajustes de cor em utilities/classes. Print CSS (`index.css @media print`) deve ser revalidado se layout/tabela mudar.

**Fora (YAGNI):** Onda 3 (Mobile) — segue pulada; backend; novas deps; reescrita de charts; mudança de stack.

## 5. Áreas de mudança

### 5.1 Contraste de cor semântica (híbrido, light-only)
- Inventariar as classes de **texto** colorido que o axe acusa no claro (principal: `text-emerald-500`; conferir também `text-amber-500`, `text-red-500`/`rose`, `text-cyan-500`, `text-orange-500` usadas como texto pequeno sobre fundo claro).
- Para cada uma, no **modo claro**: texto pequeno → escurecer ao shade que bate 4.5:1 (ex.: `emerald-500`→`emerald-700`); texto grande/bold → shade que bate 3:1 (ex.: `emerald-600`). Sempre via `text-X dark:text-Y` preservando o `dark:` atual. Nunca alterar `dark:`.
- **Badges branco-sobre-cor** (chips de anomalia no Painel): garantir par texto/fundo ≥4.5:1 — escurecer o fundo do chip (ou usar texto escuro) conforme a cor da métrica.
- Iterar com axe até `serious color-contrast` = 0 (ou residual mínimo documentado).

### 5.2 Card de Sessões (`nested-interactive`)
- Card: `<button>` → `<div role="button" tabIndex={0}>` com `onClick` e `onKeyDown` tratando `Enter`/` ` (Espaço) para acionar a navegação. Manter `onMouseDown stopPropagation` dos botões internos. Preservar classes de hover/foco; adicionar foco visível ao card (`focus-visible:ring`).
- Os botões Editar/Excluir internos permanecem `<button>` (agora válidos).
- Verificar: teclado (Tab até o card, Enter/Espaço abre; Tab alcança Editar/Excluir), e axe `nested-interactive` sumido.

### 5.3 Landmarks + heading-order
- **`<main>` único:** trocar `<main>`→`<div>` (mantendo classes) em Painel:607, Sessoes:759, Comparar:238, JogadorPerfil:586, SessaoDashboard:1333, Backups:114. O `<main>` do Layout (228) permanece o único.
- **Login:** envolver o conteúdo principal num `<main>`.
- **heading-order:** corrigir níveis pulados (h1→h3 sem h2) nas páginas acusadas (Painel, Sessões, Backups) — ajustar tags para sequência válida sem mudar tamanho visual (classe de fonte preservada; muda só o elemento `h1/h2/h3`).

## 6. Critérios de aceite

- axe-core headless (dark + light) nas páginas-chave: **0 críticos, 0 sérios** (`color-contrast`, `nested-interactive`, `scrollable-region-focusable`); `landmark-*`/`heading-order`/`region` resolvidos. Residual só se documentado e justificado.
- Card de Sessões operável por teclado (Enter/Espaço abre; Editar/Excluir alcançáveis e rotulados).
- `npm --prefix frontend run build` verde.
- `Ctrl+P` (PDF) sem regressão.
- Paridade dark/light preservada (conferida por screenshot); o "Dark Premium" intacto.

## 7. Riscos & mitigação

- **Escurecer cor demais** → perder identidade visual. Mitigar com o híbrido (grande/bold mantém vivacidade a 3:1) e screenshot de conferência.
- **Card div-como-botão** → regressão de teclado/click. Mitigar com `role="button"`+`tabIndex`+handler de teclado e teste manual.
- **heading-order** → mudar elemento pode afetar print/estilos que casam por tag. Revalidar `Ctrl+P` e visual.
- **Print acoplado** ao `@media print` (recém-corrigido) → revalidar após mudanças de layout/tabela.

## 8. Sequência

Spec (este doc) → plano via writing-plans → execução subagent-driven (implementer + review por task) com gate axe-core, igual à Onda 4. HANDOVER recebe uma fase ao final.
