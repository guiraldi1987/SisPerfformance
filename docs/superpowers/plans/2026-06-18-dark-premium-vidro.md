# Dark Premium "Vidro & Profundidade" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar profundidade e "vida" ao tema escuro do ApexPRO (estilo Vidro & Profundidade), via tokens e utilitários globais, sem tocar no tema light.

**Architecture:** A Onda 1 centralizou superfícies em tokens (`--surface-*`) e utilitários (`.bg-surface/.bg-card/.bg-elevated/.bg-input`) em `frontend/src/index.css`. Mudamos só o bloco `.dark`: superfícies viram translúcidas/elevadas, o fundo ganha um halo radial, e os utilitários de painel ganham um sheen no topo + sombra de elevação. Por fim, limpamos os poucos fundos hex hard-coded que escaparam da Onda 1.

**Tech Stack:** React 19 + Vite + Tailwind v4 (frontend `:5173`). Sem framework de testes — verificação = `npm --prefix frontend run build` verde + checagem visual em dark + `Ctrl+P` sem regressão.

## Global Constraints

- **Foco dark; light intacto.** Só o bloco `.dark` e overrides `.dark ...` mudam. Tokens `:root` (light) permanecem brancos sólidos.
- **Sem `backdrop-blur` em cards de lista.** Blur só em overlays/modais/header sticky (onde há conteúdo atrás).
- **Vermelho do clube** (`#cc1e1e`/`club-red`) preservado nos elementos de Jogo.
- **Print:** `@media print` em `index.css` já força light + remove sombras/blur. Não alterar o bloco print. Validar `Ctrl+P` na Task 4.
- **Sem libs novas, sem feature flag** (CLAUDE.md #4, #10).
- **Tailwind v4:** warnings de IDE em `@theme`/`@apply` são cosméticos; `npm run build` é a fonte de verdade.
- **Comentários:** default zero; só onde o "porquê" é não-óbvio (CLAUDE.md #3).
- Build command (sempre): `npm --prefix frontend run build` — deve terminar com `✓ built in ...`.

---

### Task 1: Tokens `.dark` translúcidos + halo radial de fundo

**Files:**
- Modify: `frontend/src/index.css` (bloco `.dark` em ~42-47; `.dark body` em ~61-64; `.bg-surface` em ~141)

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: tokens `.dark` `--surface-base/-card/-elevated/-input` com novos valores; halo radial nos seletores `.dark body` e `.dark .bg-surface`. Tasks 2 e 3 assumem `--surface-card = rgba(255,255,255,0.045)` e `--surface-input = rgba(255,255,255,0.04)`.

- [ ] **Step 1: Trocar os valores do bloco `.dark`**

Substituir exatamente:

```css
.dark {
  --surface-base:     #050608;
  --surface-card:     #08090c;
  --surface-elevated: #0d1117;
  --surface-input:    #11161d;
}
```

por:

```css
.dark {
  --surface-base:     #080b10;
  --surface-card:     rgba(255, 255, 255, 0.045);
  --surface-elevated: rgba(255, 255, 255, 0.07);
  --surface-input:    rgba(255, 255, 255, 0.04);
}
```

- [ ] **Step 2: Trocar o fundo do body por halo radial**

Substituir exatamente:

```css
  .dark body {
    background-color: #050608;
    color: #e2e8f0;
  }
```

por:

```css
  .dark body {
    background-color: #080b10;
    background-image: radial-gradient(130% 90% at 50% -10%, #141b26 0%, #0b0f16 45%, #080b10 100%);
    background-attachment: fixed;
    color: #e2e8f0;
  }
```

- [ ] **Step 3: Aplicar o halo também na superfície de página (senão `.bg-surface` cobre o body)**

No bloco `@layer utilities`, logo após a linha:

```css
  .bg-surface  { background-color: var(--surface-base); }
```

adicionar:

```css
  .dark .bg-surface {
    background-image: radial-gradient(130% 90% at 50% -10%, #141b26 0%, #0b0f16 45%, #080b10 100%);
    background-attachment: fixed;
  }
```

- [ ] **Step 4: Build**

Run: `npm --prefix frontend run build`
Expected: `✓ built in ...` (sem erros).

- [ ] **Step 5: Verificação visual (dark)**

Abrir o app em modo escuro (dev `npm --prefix frontend run dev` ou produção). Esperado:
- Fundo da página com um glow frio sutil no topo-centro, escurecendo pra base.
- Cards/painéis agora translúcidos e claramente mais claros que o fundo (descolam). Podem parecer "chapados translúcidos" ainda — o sheen/sombra vêm na Task 2.
- Light mode inalterado (alternar pra claro e conferir que nada mudou).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(ux): tokens dark translucidos + halo radial de fundo"
```

---

### Task 2: Tratamento "vidro" nos utilitários `.bg-card` / `.bg-elevated`

**Files:**
- Modify: `frontend/src/index.css` (bloco `@layer utilities`, após as definições de `.bg-*` em ~141-144)

**Interfaces:**
- Consumes: tokens `.dark` translúcidos da Task 1.
- Produces: regras `.dark .bg-card` e `.dark .bg-elevated` com sheen de topo (`background-image` gradiente) + `box-shadow` de elevação. Nada nas tasks seguintes depende destas regras.

**Notas de implementação:**
- O sheen é via `background-image` (compõe sobre o `background-color` translúcido sem conflito).
- `box-shadow`: utilitários `shadow-*` do Tailwind no mesmo elemento sobrescrevem (ex.: `SessaoCard` tem `hover:shadow-lg`). Isso é aceitável — no hover a sombra do Tailwind assume e intensifica; no estado base aparece a nossa. Não tentar "consertar" isso.
- Borda padrão dos cards (`dark:border-white/[0.06]`) é por-componente; **não** mexer globalmente nela aqui — sheen + sombra + translucidez já separam. Reavaliar só se algum painel ficar fraco na varredura visual (Task 4).

- [ ] **Step 1: Adicionar as regras de vidro**

No bloco `@layer utilities`, imediatamente após:

```css
  .bg-input    { background-color: var(--surface-input); }
```

adicionar:

```css
  .dark .bg-card {
    background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 42%);
    box-shadow: 0 6px 24px -8px rgba(0, 0, 0, 0.55);
  }
  .dark .bg-elevated {
    background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0) 50%);
    box-shadow: 0 24px 60px -16px rgba(0, 0, 0, 0.7);
  }
```

- [ ] **Step 2: Build**

Run: `npm --prefix frontend run build`
Expected: `✓ built in ...` (sem erros).

- [ ] **Step 3: Verificação visual (dark)**

No modo escuro, os cards de Sessões e painéis (Painel, Comparar) devem mostrar um leve brilho na borda superior ("luz vindo de cima") + sombra suave que os destaca do fundo — efeito "vidro". Modais (`bg-elevated`) com brilho de topo um pouco mais forte. Light inalterado.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(ux): sheen de topo + sombra de elevacao nos paineis (dark)"
```

---

### Task 3: Limpeza dos fundos hex ad-hoc remanescentes

**Files:**
- Modify: `frontend/src/index.css` (`.glass-panel` ~89, `.glass-panel-hover` ~93)
- Modify: `frontend/src/pages/Sessoes.tsx:229,237`
- Modify: `frontend/src/pages/Layout.tsx:169`
- Modify: `frontend/src/pages/Painel.tsx:350`
- Modify: `frontend/src/pages/SessaoDashboard.tsx:921,930,942,961,1239`

**Interfaces:**
- Consumes: novos tokens/escala translúcida (Task 1).
- Produces: nenhum fundo escuro hex hard-coded remanescente. Nada depende disto.

**Nota:** todos os valores novos batem com a escala translúcida da Task 1 (`white/[0.045]` ≈ card, `white/[0.04]` ≈ input, `#080b10` ≈ base). Light não muda em nenhuma destas edições — só a parte `dark:`.

- [ ] **Step 1: Alinhar `.glass-panel` e `.glass-panel-hover` (index.css)**

Substituir em `.glass-panel`:
`dark:bg-[#0b0c10]/75` → `dark:bg-white/[0.05]`

Substituir em `.glass-panel-hover`:
`dark:hover:bg-[#0e1015]/80` → `dark:hover:bg-white/[0.08]`

(Manter todo o resto das duas classes — `backdrop-blur-md`, bordas, sombras — intacto.)

- [ ] **Step 2: Sessoes.tsx — botões Editar/Excluir (linhas 229 e 237)**

Em ambas as linhas, substituir `dark:bg-[#1a1a1a]` por `dark:bg-elevated`.
(O texto completo a procurar nas duas: `bg-white dark:bg-[#1a1a1a]` → `bg-white dark:bg-elevated`.)

- [ ] **Step 3: Layout.tsx — anel do status dot (linha 169)**

Substituir `dark:border-[#08090c]` por `dark:border-[#0b0f16]`.
(Procurar: `border-white dark:border-[#08090c]` → `border-white dark:border-[#0b0f16]`.)

- [ ] **Step 4: Painel.tsx — card de métrica (linha 350)**

Substituir `dark:bg-[#08090c]/40` por `dark:bg-white/[0.04]`.
(Procurar: `bg-white/60 dark:bg-[#08090c]/40` → `bg-white/60 dark:bg-white/[0.04]`.)

- [ ] **Step 5: SessaoDashboard.tsx — inputs/botões de filtro (linhas 921, 930, 942, 961)**

Nas quatro linhas, substituir `dark:bg-[#0c1015]/60` por `dark:bg-white/[0.04]`.
(Procurar cada ocorrência de `bg-white/70 dark:bg-[#0c1015]/60` → `bg-white/70 dark:bg-white/[0.04]`.)

- [ ] **Step 6: SessaoDashboard.tsx — header sticky (linha 1239)**

Substituir `dark:bg-[#0a0a0a]/85` por `dark:bg-[#080b10]/85`.
(Mantém `backdrop-blur-lg` — header sticky é caso legítimo de blur. Procurar: `bg-white/85 dark:bg-[#0a0a0a]/85` → `bg-white/85 dark:bg-[#080b10]/85`.)

- [ ] **Step 7: Confirmar que não sobrou hex de fundo ad-hoc**

Run (na raiz do projeto):
```bash
grep -rnE "dark:bg-\[#|dark:border-\[#08090c\]" frontend/src --include=*.tsx --include=*.css
```
Expected: nenhuma linha de **fundo** escuro hard-coded remanescente (o header sticky agora é `#080b10`, aceitável; `--color-club-dark` em `@theme` e tokens em `:root`/`.dark` NÃO contam — são definições, não usos ad-hoc).

- [ ] **Step 8: Build**

Run: `npm --prefix frontend run build`
Expected: `✓ built in ...` (sem erros).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/index.css frontend/src/pages/Sessoes.tsx frontend/src/pages/Layout.tsx frontend/src/pages/Painel.tsx frontend/src/pages/SessaoDashboard.tsx
git commit -m "refactor(ux): troca fundos hex ad-hoc por tokens/escala translucida (dark)"
```

---

### Task 4: Varredura visual + regressão de print + HANDOVER

**Files:**
- Modify: `HANDOVER.md` (nova fase + data do rodapé)

**Interfaces:**
- Consumes: tudo das Tasks 1-3.
- Produces: documentação da fase; nenhum código.

- [ ] **Step 1: Build final**

Run: `npm --prefix frontend run build`
Expected: `✓ built in ...`.

- [ ] **Step 2: Varredura visual em dark**

Abrir cada página em modo escuro e confirmar profundidade/legibilidade (sem regressão de contraste): **Login, Painel do Time, Sessões (lista + calendário), Comparar, JogadorPerfil, SessaoDashboard, Upload GPS, Backups, Usuários/Elenco**, e os modais (`ConfirmModal`, `EditSessaoModal`). Conferir também a **sidebar** (Layout). Alternar pra **light** e confirmar que está inalterado.

- [ ] **Step 3: Regressão de print (`Ctrl+P`)**

Em modo escuro, abrir o relatório da página **Comparar** e uma **sessão** (`/sessao/:id`), dar `Ctrl+P` e conferir no preview de PDF: fundo branco, texto preto, **sem halo/sheen/sombra** vazando, tabelas e charts intactos. (O `@media print` não foi tocado — isto é só confirmação.)

- [ ] **Step 4: Atualizar HANDOVER.md**

Adicionar uma "Fase N+1" intitulada **"Dark Premium — Vidro & Profundidade"** descrevendo: tokens `.dark` translúcidos + halo radial; sheen/sombra nos utilitários de painel; limpeza de hex ad-hoc; dark-only (light intacto); print validado. Atualizar a data no rodapé do arquivo para a data atual.

- [ ] **Step 5: Commit**

```bash
git add HANDOVER.md
git commit -m "docs: registra fase Dark Premium (Vidro & Profundidade) no HANDOVER"
```

---

## Self-Review

**Spec coverage:**
- Spec §5.1 (tokens `.dark`) → Task 1 Step 1. ✓
- Spec §5.2 (halo radial, incl. `.bg-surface` cobre body) → Task 1 Steps 2-3. ✓
- Spec §5.3 (sheen topo + sombra; nota box-shadow) → Task 2. ✓
- Spec §5.4 (blur só em overlays) → header sticky mantém blur (Task 3 Step 6); cards sem blur (Task 2 não adiciona blur). ✓
- Spec §5.5 (limpeza hex ad-hoc) → Task 3 (lista enumerada). ✓
- Spec §6 critérios (build, Ctrl+P, light intacto, sem ad-hoc, vermelho preservado) → Task 4 Steps 1-3 + Task 3 Step 7. ✓
- Spec §7 riscos (box-shadow x Tailwind, translucidez aninhada, halo coberto, print) → Task 2 notas, Task 1 Step 3, Task 4 Step 3. ✓
- Spec §8 (HANDOVER) → Task 4 Step 4. ✓

**Placeholder scan:** nenhum "TBD/TODO"; toda edição tem string exata antes→depois ou bloco CSS completo. ✓

**Type/valor consistency:** `--surface-card = rgba(255,255,255,0.045)` e `--surface-input = rgba(255,255,255,0.04)` definidos na Task 1 e reutilizados como `white/[0.045]`/`white/[0.04]` na Task 3. Base `#080b10` consistente entre Task 1 (token/body/halo) e Task 3 (header sticky / status dot `#0b0f16` é o tom intermediário do halo). ✓

**Deviação documentada:** o "bump de borda" do spec §5.3 foi conscientemente deixado de fora (borda é por-componente; sheen+sombra+translucidez já separam) — reavaliar pontualmente na varredura da Task 4.
