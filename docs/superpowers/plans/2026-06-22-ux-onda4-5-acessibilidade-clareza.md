# UX Onda 4 (Acessibilidade WCAG 2.1 AA) + Onda 5 (Clareza de Domínio) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o frontend do ApexPRO a um patamar de acessibilidade WCAG 2.1 AA (nomes acessíveis, anúncios, foco, landmarks, contraste) e adicionar clareza de domínio (tooltips de siglas, unidade no heatmap), sem libs novas.

**Architecture:** Edições cirúrgicas em ~12 arquivos de `frontend/src`. Padrões reutilizados: `role="img"`+`aria-label` nos charts SVG/div; `aria-live` em regiões estáticas (toast, erro de login, troca de rota); `aria-hidden` em ícones decorativos; `htmlFor`/`id` em formulários; `title=` em siglas. Um componente novo (`RouteAnnouncer`) para anúncio de navegação SPA. Onda 5 entra como tarefa final antes do HANDOVER (é pequena/opcional e o usuário pediu 4 e 5 juntas).

**Tech Stack:** React 19 + Vite + Tailwind v4. Sem framework de testes — verificação = `npm --prefix frontend run build` verde + checagem manual + **axe DevTools** (sem violações críticas) + `Ctrl+P` sem regressão.

## Global Constraints

- **Sem libs novas** (CLAUDE.md #4/#10): sem headless-UI, sem chart lib. Charts continuam SVG/div inline manual.
- **Paridade dark/light** obrigatória em toda tela tocada.
- **1 usuário real** (Eduardo) — sem feature flag, sem backward-compat.
- **Print acoplado:** o bloco `@media print` em `index.css` foi recém-corrigido (Fase 33). Qualquer task que toque layout/tabela/`header`/`.sticky` exige re-testar `Ctrl+P` (relevante nas Tasks 5 e 6).
- **Tailwind v4:** warnings de IDE em `@theme`/`@apply` são cosméticos; `npm run build` é a fonte de verdade. `sr-only` é utility nativa do Tailwind (usar, não recriar).
- **Comentários:** default zero; só onde o "porquê" é não-óbvio (CLAUDE.md #3).
- **Branch:** trabalhar em `feat/ux-onda4-5-a11y` (não commitar direto no `main`).
- Build command (sempre): `npm --prefix frontend run build` — deve terminar com `✓ built in ...`.
- Verificação a11y por task: **axe DevTools** na(s) página(s) tocada(s), confirmando ausência de violação nova; navegação por teclado (Tab/Shift+Tab/Enter/Esc) onde aplicável.

## File Structure

| Arquivo | Responsabilidade nesta entrega |
|---|---|
| `frontend/src/components/RouteAnnouncer.tsx` | **Novo.** Região `aria-live` que anuncia o título da página ao navegar (SPA). |
| `frontend/src/App.tsx` | Montar `<RouteAnnouncer />` dentro do `BrowserRouter`. |
| `frontend/src/components/Toast.tsx` | Mover `aria-live` do item para o container estático. |
| `frontend/src/pages/Login.tsx` | `role="alert"` no erro; corrigir toggle de senha (foco + `aria-pressed`/`aria-label`). |
| `frontend/src/pages/Upload.tsx` | `htmlFor`/`id` em todos os campos. |
| `frontend/src/pages/Layout.tsx` | `aria-hidden` nos ícones; `aria-label` nos `<nav>`/`<aside>`. |
| `frontend/src/components/charts/{Gauge,AcwrChart,TrendChart,RadarComparativo,MicrocicloChart,MatchTrainingCompare,BoxPlotByPosition,VolumeIntensityScatter}.tsx` | `role="img"`+`aria-label` no elemento raiz. |
| `frontend/src/pages/Sessoes.tsx` | `aria-label` nos botões Editar/Excluir; foco visível (`focus-within`). |
| `frontend/src/index.css` | Contraste (Task 6) + verificação de `prefers-reduced-motion` (Task 7). |
| `frontend/src/pages/Painel.tsx` | Tooltips de siglas + unidade na legenda do heatmap (Onda 5). |
| `HANDOVER.md` | Fase nova (Onda 4 + 5) + data do rodapé. |

---

## ONDA 4 — Acessibilidade

### Task 1: Regiões `aria-live` — toast, erro de login e troca de rota

**Files:**
- Create: `frontend/src/components/RouteAnnouncer.tsx`
- Modify: `frontend/src/App.tsx` (imports topo; dentro de `<BrowserRouter>` ~linha 33)
- Modify: `frontend/src/components/Toast.tsx` (container ~linha 59; item ~linhas 82-88)
- Modify: `frontend/src/pages/Login.tsx` (erro ~linha 135)

**Interfaces:**
- Produces: componente `RouteAnnouncer` (sem props) usado por `App.tsx`. Nada depende dele em tasks seguintes.

- [ ] **Step 1: Criar `RouteAnnouncer.tsx`**

Create `frontend/src/components/RouteAnnouncer.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const TITLES: Record<string, string> = {
  '/painel': 'Painel do Time',
  '/sessoes': 'Sessões',
  '/comparar': 'Comparar Jogadores',
  '/jogadores': 'Elenco',
  '/upload': 'Upload de GPS',
  '/usuarios': 'Usuários',
  '/backups': 'Backups',
  '/login': 'Login',
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/sessao/')) return 'Relatório da sessão';
  if (pathname.startsWith('/jogador/')) return 'Perfil do jogador';
  return 'ApexPRO';
}

export const RouteAnnouncer: React.FC = () => {
  const { pathname } = useLocation();
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setMsg(`${titleFor(pathname)} — página carregada`);
  }, [pathname]);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">{msg}</div>
  );
};
```

- [ ] **Step 2: Montar `RouteAnnouncer` no `App.tsx`**

Em `frontend/src/App.tsx`, adicionar o import junto aos outros de `./components/`:

```tsx
import { RouteAnnouncer } from './components/RouteAnnouncer';
```

E dentro de `<BrowserRouter>`, logo antes de `<Suspense ...>`:

```tsx
            <BrowserRouter>
              <RouteAnnouncer />
              <Suspense fallback={<div className="flex items-center justify-center h-screen text-slate-500">Carregando…</div>}>
```

- [ ] **Step 3: Toast — `aria-live` no container estático**

Em `frontend/src/components/Toast.tsx`, trocar o container (linha ~59):

```tsx
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none print:hidden">
```

por:

```tsx
      <div aria-live="polite" aria-atomic="false" className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none print:hidden">
```

E no `ToastItem` (linhas ~82-88) remover `role="status"` e `aria-live="polite"` do `<div>` (a região viva agora é o container; manter ambos duplicaria o anúncio):

```tsx
    <div
      className={`pointer-events-auto flex items-center gap-3 min-w-[260px] max-w-md px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-semibold transition-all duration-200 ${palette.bg} ${
        entered ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
      }`}
    >
```

- [ ] **Step 4: Login — `role="alert"` no erro**

Em `frontend/src/pages/Login.tsx`, na div de erro (linha ~135), adicionar `role="alert"`:

```tsx
            <div role="alert" className="mb-5 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-all card-bounce flex items-center gap-2">
```

- [ ] **Step 5: Build**

Run: `npm --prefix frontend run build` — Expected: `✓ built in ...`.

- [ ] **Step 6: Verificação manual**

Com o app rodando (dev): navegar entre páginas e confirmar (axe DevTools → "Live regions") que existe uma região `aria-live` no DOM; forçar um login inválido e confirmar que o erro está em `role="alert"`; disparar um toast e confirmar o container `aria-live`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/RouteAnnouncer.tsx frontend/src/App.tsx frontend/src/components/Toast.tsx frontend/src/pages/Login.tsx
git commit -m "feat(a11y): regioes aria-live (toast/erro de login/troca de rota)"
```

---

### Task 2: Formulários — `htmlFor`/`id` no Upload + toggle de senha no Login

**Files:**
- Modify: `frontend/src/pages/Upload.tsx` (labels/inputs ~linhas 79-134)
- Modify: `frontend/src/pages/Login.tsx` (botão de senha ~linhas 123-130)

**Interfaces:** nenhuma dependência entre tasks.

- [ ] **Step 1: Upload — associar cada label ao campo**

Em `frontend/src/pages/Upload.tsx`, adicionar `id` em cada campo e `htmlFor` no label correspondente. Edições exatas:

Arquivo CSV (linhas 79-85):
```tsx
          <label htmlFor="up-file" className={labelCls}>Arquivo CSV (Catapult)</label>
          <input
            id="up-file"
            type="file" accept=".csv"
            onChange={e => onSelectFile(e.target.files?.[0] ?? null)}
            required
            className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-club-red/10 file:text-club-red file:px-3 file:py-1.5 file:text-xs file:font-bold file:cursor-pointer hover:file:bg-club-red/20"
          />
```

Tipo (linhas 93-97):
```tsx
          <label htmlFor="up-tipo" className={labelCls}>Tipo</label>
          <select id="up-tipo" value={tipo} onChange={e => setTipo(e.target.value as 'Treino' | 'Jogo')} className={inputCls}>
```

Jogo (linhas 104-112): label recebe `htmlFor="up-jogo"`, input recebe `id="up-jogo"`.
Equipe (linhas 118-124): label `htmlFor="up-equipe"`, input `id="up-equipe"`.
Local (linhas 127-133): label `htmlFor="up-local"`, input `id="up-local"`.

(O label "Jogo" tem um `<span>` interno — manter; só adicionar `htmlFor` no `<label>`.)

- [ ] **Step 2: Login — toggle de senha acessível**

Em `frontend/src/pages/Login.tsx` (linhas 123-130), remover `tabIndex={-1}` e adicionar `aria-label` + `aria-pressed`:

```tsx
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPwd}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 hover:text-club-red px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 uppercase tracking-widest transition-colors duration-200"
              >
                {showPwd ? 'Ocultar' : 'Mostrar'}
              </button>
```

- [ ] **Step 3: Build** — `npm --prefix frontend run build` → `✓ built in ...`.

- [ ] **Step 4: Verificação** — no Upload, clicar no texto de cada label move o foco pro campo; no Login, `Tab` alcança o botão Mostrar/Ocultar e axe não acusa input sem label.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/Upload.tsx frontend/src/pages/Login.tsx
git commit -m "feat(a11y): labels associadas no Upload + toggle de senha focavel no Login"
```

---

### Task 3: Ícones decorativos + landmarks de navegação (Layout)

**Files:**
- Modify: `frontend/src/pages/Layout.tsx` (objeto `Icon` ~linhas 7-61; logout svg ~186; `<aside>` ~110; `<nav>` ~138 e ~149)

**Interfaces:** nenhuma.

- [ ] **Step 1: `aria-hidden` em todos os ícones do objeto `Icon`**

Em cada um dos 9 componentes do objeto `Icon` (`Dashboard`, `Players`, `Users`, `Upload`, `Calendar`, `Compare`, `Backup`, `Sun`, `Moon`), adicionar `aria-hidden="true"` na tag `<svg ...>`. Exemplo (Dashboard, linha 9):

```tsx
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110">
```

Repetir o mesmo `aria-hidden="true"` nas tags `<svg>` dos outros 8 ícones.

- [ ] **Step 2: `aria-hidden` no ícone de logout**

Linha ~186 (svg dentro do botão "Sair do sistema"):

```tsx
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
```

- [ ] **Step 3: Landmarks rotulados**

`<aside>` (linha 110) → adicionar `aria-label="Barra lateral"`:
```tsx
      <aside aria-label="Barra lateral" className="w-64 shrink-0 flex flex-col bg-card border-r border-slate-200/50 dark:border-white/[0.04] transition-colors duration-300 relative z-20">
```

`<nav>` "Análise Tática" (linha 138) → `aria-label="Análise tática"`:
```tsx
            <nav aria-label="Análise tática" className="space-y-1">
```

`<nav>` "Administração" (linha 149) → `aria-label="Administração"`:
```tsx
            <nav aria-label="Administração" className="space-y-1">
```

- [ ] **Step 4: Build** — `✓ built in ...`.

- [ ] **Step 5: Verificação** — axe DevTools: sem ícone SVG expondo nome acessível redundante; landmarks `navigation` aparecem rotulados na árvore.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/pages/Layout.tsx
git commit -m "feat(a11y): aria-hidden nos icones e landmarks rotulados na sidebar"
```

---

### Task 4: Nome acessível nos charts (`role="img"` + `aria-label`)

**Files (Modify):** os 8 charts abaixo. Em cada um, adicionar `role="img"` e `aria-label` no **elemento raiz** indicado.

**Interfaces:** charts são consumidos por Painel/JogadorPerfil/SessaoDashboard/Comparar; só estamos anotando — assinaturas inalteradas.

- [ ] **Step 1: Gauge (`charts/Gauge.tsx`, `<svg>` linha 43)** — label dinâmico por instância:

```tsx
      <svg role="img" aria-label={`${title}: ${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unit ? ' ' + unit : ''} de ${max} máximo`} viewBox="0 0 200 125" className="w-44 h-28">
```

- [ ] **Step 2: Demais charts** — adicionar `role="img" aria-label="..."` na tag raiz (string exata por chart):

| Arquivo | Raiz (linha) | `aria-label` exato |
|---|---|---|
| `charts/AcwrChart.tsx` | `<svg>` ~60 | `Gráfico de ACWR (carga aguda 7 dias ÷ carga crônica 28 dias) por sessão` |
| `charts/TrendChart.tsx` | `<svg>` ~130 | `Tendência da métrica nas últimas sessões` |
| `charts/RadarComparativo.tsx` | `<svg>` ~66 | usar template: ``Radar comparativo por posição${posicaoLabel ? ` — ${posicaoLabel}` : ''}`` |
| `charts/BoxPlotByPosition.tsx` | `<svg>` ~166 | `Box plot da distribuição da métrica por posição` |
| `charts/VolumeIntensityScatter.tsx` | `<svg>` ~64 | `Dispersão de volume por intensidade dos atletas` |
| `charts/MatchTrainingCompare.tsx` | `<div className="space-y-3.5">` ~50 | `Comparação de carga entre jogos e treinos por métrica` |
| `charts/MicrocicloChart.tsx` | `<div>` ~80 | `Microciclo MD-: carga por dia relativo ao jogo` |

Para os `<svg>`, atributo literal (ex. AcwrChart):
```tsx
      <svg role="img" aria-label="Gráfico de ACWR (carga aguda 7 dias ÷ carga crônica 28 dias) por sessão" viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 600 }}>
```
Para RadarComparativo, usar a forma com template (tem `posicaoLabel` em escopo):
```tsx
      <svg role="img" aria-label={`Radar comparativo por posição${posicaoLabel ? ` — ${posicaoLabel}` : ''}`} viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ minHeight: 260 }}>
```
Para os dois `<div>` (MatchTrainingCompare linha 50, MicrocicloChart linha 80), adicionar os atributos na div raiz do estado **com dados** (não no early-return de "sem dados"):
```tsx
  return (
    <div role="img" aria-label="Comparação de carga entre jogos e treinos por métrica" className="space-y-3.5">
```
```tsx
  return (
    <div role="img" aria-label="Microciclo MD-: carga por dia relativo ao jogo">
```

- [ ] **Step 3: Build** — `✓ built in ...`.

- [ ] **Step 4: Verificação** — axe DevTools nas páginas com charts (Painel, JogadorPerfil, SessaoDashboard, Comparar): cada gráfico expõe um nome acessível; nenhum `<svg>` sem nome sinalizado.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/charts/
git commit -m "feat(a11y): nome acessivel (role=img + aria-label) em todos os charts"
```

---

### Task 5: Ações por linha + foco visível (Sessoes)

**Files:**
- Modify: `frontend/src/pages/Sessoes.tsx` (container e botões ~linhas 225-242)

**Interfaces:** `sessao` (tipo `SessaoRica`) já em escopo no card; usa `sessao.descricao` e `sessao.data`.

- [ ] **Step 1: `aria-label` por botão + revelar no foco**

Trocar o bloco (linhas 225-242) por (container ganha `focus-within:opacity-100`; cada botão ganha `aria-label` com a descrição da sessão e `focus-visible:opacity-100`):

```tsx
      {/* Edit + Trash */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-300">
        <button
          onClick={onEdit}
          aria-label={`Editar sessão ${sessao.descricao || sessao.data}`}
          title="Editar sessão"
          className="flex items-center justify-center w-7 h-7 rounded-full bg-white dark:bg-elevated text-indigo-500 border border-slate-200 dark:border-white/10 hover:bg-indigo-500 hover:text-white hover:border-indigo-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-sm hover:shadow-indigo-500/25 transition-all"
          onMouseDown={e => e.stopPropagation()}
        >
          <Icon.Edit />
        </button>
        <button
          onClick={onDelete}
          aria-label={`Remover sessão ${sessao.descricao || sessao.data}`}
          title="Remover sessão"
          className="flex items-center justify-center w-7 h-7 rounded-full bg-white dark:bg-elevated text-rose-500 border border-slate-200 dark:border-white/10 hover:bg-rose-500 hover:text-white hover:border-rose-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-rose-500 shadow-sm hover:shadow-rose-500/25 transition-all"
          onMouseDown={e => e.stopPropagation()}
        >
          <Icon.Trash />
        </button>
      </div>
```

> Nota: os botões estão aninhados dentro do card `<button>` (HTML inválido, pré-existente) — **fora de escopo** desta onda; não reestruturar aqui.

- [ ] **Step 2: Adicionar `aria-hidden` nos ícones Edit/Trash** — localizar as definições de `Icon.Edit` e `Icon.Trash` em `Sessoes.tsx` e adicionar `aria-hidden="true"` nas tags `<svg>` (mesmo padrão da Task 3). Run para localizar:
```bash
grep -nE "Edit:|Trash:" frontend/src/pages/Sessoes.tsx
```

- [ ] **Step 3: Build** — `✓ built in ...`.

- [ ] **Step 4: Verificação** — Tab até os cards de sessão: os botões aparecem ao receber foco e têm anel visível; axe expõe nome acessível distinto por linha. **Re-testar `Ctrl+P`** numa lista de sessões (Task mexe em classes de card).

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/Sessoes.tsx
git commit -m "feat(a11y): aria-label por linha e foco visivel nas acoes de sessao"
```

---

### Task 6: Contraste e tamanho mínimo de texto informativo

**Files:**
- Modify: `frontend/src/pages/Login.tsx` (~linhas 79-81), `frontend/src/pages/Upload.tsx` (~linha 71). Demais ajustes conforme achados do axe.

**Interfaces:** nenhuma.

- [ ] **Step 1: Escurecer textos informativos de baixo contraste**

Login, parágrafo de ajuda (linha 79) — `text-slate-400` → `text-slate-500` (mantém dark):
```tsx
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
```

Upload, subtítulo (linha 71) — `text-slate-400` → `text-slate-500`:
```tsx
      <p className="text-sm text-slate-500 dark:text-slate-500 mb-6">
```

- [ ] **Step 2: Varredura de contraste com axe**

Run o app, abrir axe DevTools em **Login, Upload, Sessoes, Layout/sidebar** e rodar "Scan". Para cada violação de **Color Contrast** em texto **informativo** (não decorativo), aplicar a regra: se `text-slate-400`→`text-slate-500`/`text-slate-600`; se fonte <12px em texto informativo, subir pra `text-xs` (12px). **Não** alterar eyebrows/labels puramente decorativos (uppercase tracking) a menos que o axe acuse. Anotar no commit quais arquivos/linhas mudaram.

- [ ] **Step 3: Build** — `✓ built in ...`.

- [ ] **Step 4: Verificação** — axe nas 4 telas: zero violação de **Color Contrast** em texto informativo. Conferir dark **e** light. Re-testar `Ctrl+P` se algum texto de relatório foi tocado.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/Login.tsx frontend/src/pages/Upload.tsx
git commit -m "fix(a11y): contraste de textos informativos (AA) em Login/Upload/varredura axe"
```

---

### Task 7: `prefers-reduced-motion` — confirmar cobertura

**Files:**
- Modify (se necessário): `frontend/src/index.css` (bloco ~linhas 79-84)

**Interfaces:** nenhuma.

- [ ] **Step 1: Auditar o bloco existente**

O bloco atual já zera `animation-duration`/`transition-duration` em `*` sob `prefers-reduced-motion: reduce` (cobre também transições disparadas por estado React, ex. entrada do toast e `card-bounce`). Confirmar que continua intacto:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Adicionar `scroll-behavior` e iteração**

Estender o bloco para neutralizar scroll suave e animações em loop:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Build** — `✓ built in ...`.

- [ ] **Step 4: Verificação** — DevTools → Rendering → "Emulate prefers-reduced-motion: reduce": confirmar que toasts/`animate-pulse`/`animate-fade-in` não animam.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/index.css
git commit -m "feat(a11y): reduce motion tambem para scroll/animacoes em loop"
```

---

## ONDA 5 — Clareza de domínio

### Task 8: Tooltips de siglas (ACWR/HSR/z-score) + unidade do heatmap

**Files:**
- Modify: `frontend/src/pages/Painel.tsx` (legenda heatmap ~linhas 236-249; cabeçalho ACWR ~linha 1020; coluna `Gráfico ACWR` ~1021)

**Interfaces:** nenhuma.

- [ ] **Step 1: Unidade na legenda do heatmap (linhas 236-249)**

Trocar os rótulos "Menos"/"Mais" para comunicar a unidade:
```tsx
        {/* Legenda */}
        <div className="flex items-center gap-2 mt-4 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-outfit">
          <span>Menos carga</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.75, 1.0].map(i => (
              <div key={i} className="w-3 h-3 rounded-sm border border-slate-200 dark:border-white/[0.03]"
                style={{ background: `rgba(204, 30, 30, ${0.06 + i * 0.52})` }} />
            ))}
          </div>
          <span>Mais carga</span>
          <span className="normal-case font-medium text-slate-400/80">(Player Load médio/dia)</span>
          <span className="ml-4 inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-club-red" /> Jogo
          </span>
        </div>
```

- [ ] **Step 2: Tooltip na sigla ACWR (cabeçalho da coluna, linha 1020)**

```tsx
                    <th title="ACWR = carga aguda (7 dias) ÷ carga crônica (28 dias). Zonas: <0,8 subtreino · 0,8–1,3 ideal · 1,3–1,5 atenção · >1,5 risco" className="text-right px-4 py-3 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 font-outfit cursor-help">ACWR</th>
```

- [ ] **Step 3: Tooltips de HSR e z-score onde aparecem como rótulo**

Localizar ocorrências de rótulo textual "HSR" e "z=" no app e adicionar `title=` explicativo:
```bash
grep -rnE ">HSR<|HSR|z=\{|z-score" frontend/src/pages frontend/src/components frontend/src/lib
```
- Para rótulos "HSR" (ex. cabeçalhos/labels de métrica): adicionar `title="HSR = High-Speed Running (distância percorrida acima do limiar de alta velocidade)"` no elemento do rótulo.
- Para "z" / "z-score" (ex. `Painel.tsx:772`): o `<span>` do z deve ter `title="z-score = nº de desvios-padrão vs. a média pessoal do atleta (|z|>2 = anomalia)"`. Aplicar no `<span>` que renderiza `z=…`.

(Se um rótulo já estiver dentro de elemento com `title=` adequado, não duplicar.)

- [ ] **Step 4: Build** — `✓ built in ...`.

- [ ] **Step 5: Verificação** — hover sobre ACWR/HSR/z mostra a explicação; legenda do heatmap comunica a unidade. Conferir dark e light. `Ctrl+P` (Painel/heatmap não deve regredir).

- [ ] **Step 6: Commit**
```bash
git add frontend/src/pages/Painel.tsx
git commit -m "feat(ux): tooltips de siglas (ACWR/HSR/z-score) + unidade na legenda do heatmap"
```

---

### Task 9: Varredura final axe + HANDOVER

**Files:**
- Modify: `HANDOVER.md` (nova fase + data do rodapé)

**Interfaces:** consome tudo das Tasks 1-8.

- [ ] **Step 1: Build final** — `npm --prefix frontend run build` → `✓ built in ...`.

- [ ] **Step 2: Varredura axe completa** — rodar axe DevTools em **Login, Painel, Sessões, Comparar, JogadorPerfil, SessaoDashboard, Upload, Usuários, Backups**, em dark e light. Confirmar **zero violação crítica/séria**. Anotar qualquer pendência conhecida.

- [ ] **Step 3: Regressão de print** — `Ctrl+P` em Comparar e numa sessão: fundo branco, texto preto, sem regressão (Tasks 5/6/8 tocaram telas com botão Imprimir).

- [ ] **Step 4: Atualizar HANDOVER.md** — adicionar uma fase **"UX Onda 4 (Acessibilidade WCAG 2.1 AA) + Onda 5 (Clareza de domínio)"** descrevendo: regiões `aria-live`, labels de formulário, `aria-hidden`/landmarks, nome acessível nos charts, ações por linha com foco visível, contraste AA, reduce-motion; tooltips de siglas + unidade do heatmap. Marcar Ondas 4 e 5 como concluídas. Atualizar a data do rodapé para a data atual.

- [ ] **Step 5: Commit**
```bash
git add HANDOVER.md
git commit -m "docs: registra UX Onda 4 (a11y) + Onda 5 (clareza) no HANDOVER"
```

---

## Self-Review

**Spec coverage (spec §8 Onda 4 / §9 Onda 5):**
- §8 `role="alert"`/`aria-live` login + toast → Task 1 ✓
- §8 `role="img"`+`aria-label` nos 8 charts → Task 4 ✓
- §8 `aria-hidden` ícones nav/logout → Task 3 ✓
- §8 `htmlFor`/`id` Upload → Task 2 ✓
- §8 remover `tabIndex={-1}` + `aria-pressed` toggle senha → Task 2 ✓
- §8 landmarks `<nav aria-label>` → Task 3 ✓
- §8 `aria-label` por linha Editar/Excluir + foco visível (sem `opacity-0` cego) → Task 5 ✓
- §8 contraste `text-slate-400`/9-10px → Task 6 ✓
- §8 risco por cor (Gauge) → coberto pelo `aria-label` da Gauge (Task 4 Step 1, inclui valor/máximo) ✓
- §8 anúncio de troca de rota (SPA) → Task 1 (`RouteAnnouncer`) ✓
- §8 `prefers-reduced-motion` p/ animações JS → Task 7 (global `*` cobre transições disparadas por estado) ✓
- §9 tooltips ACWR/HSR/z-score → Task 8 ✓
- §9 legenda heatmap com unidade → Task 8 Step 1 ✓
- §10 critérios globais (build verde, axe sem crítico, dark/light, `Ctrl+P`) → Task 9 ✓

**Placeholder scan:** toda edição de código tem string/atributo exato. Os pontos com `grep` (Task 5 Step 2, Task 8 Step 3) são para **localizar** ocorrências repetidas do mesmo padrão já especificado (atributo + texto exato dados) — não são "decidir depois".

**Type/valor consistency:** `RouteAnnouncer` (sem props) — definido na Task 1, usado na Task 1 Step 2. Charts: assinaturas inalteradas; `posicaoLabel` usado no aria-label da RadarComparativo existe na assinatura (`charts/RadarComparativo.tsx:37`). `sessao.descricao`/`sessao.data` usados na Task 5 pertencem ao tipo `SessaoRica` já consumido no mesmo componente.

**Deviação consciente:** botões aninhados em `<button>` no card de sessão (HTML inválido pré-existente) deixados de fora — reestruturação é risco desproporcional pra esta onda; registrado como nota na Task 5.
```
