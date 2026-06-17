# UX Onda 1 — Fundações (Design System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer os fundamentos de design system do frontend — tokens de superfície, paleta de métricas canônica e 4 componentes compartilhados (Button, PageHeader, LoadingState, EmptyState) — e migrar o app para usá-los, eliminando a fragmentação de cores/headers/botões apontada na auditoria.

**Architecture:** Tokens semânticos de superfície via CSS custom properties que invertem sob `.dark`, expostos como utilitários (`.bg-surface/.bg-card/.bg-elevated/.bg-input`) em `@layer utilities`. Componentes de UI novos ficam em `frontend/src/components/ui/`. A migração das cores ad-hoc é uma varredura mecânica find→replace por mapeamento exato.

**Tech Stack:** React 19, Vite, Tailwind v4 (`@theme`, `@layer`), TypeScript. Sem libs novas.

## Global Constraints

Copiados do spec (`docs/superpowers/specs/2026-06-17-ux-frontend-program-design.md`) e do `CLAUDE.md`:

- **Branch:** trabalhar em `feat/ux-frontend-program` (já criada). `main` é produção — não commitar nela.
- **Sem dependências novas.** Tailwind v4 + SVG inline apenas.
- **Sem framework de testes** no projeto. Verificação de cada task = `npm --prefix frontend run build` verde + checagem visual (dark/light) + `Ctrl+P` quando a task toca layout/cores/tabelas. NÃO instalar vitest/jest.
- **Paridade dark/light** obrigatória em tudo que for tocado.
- **Print CSS** vive em `frontend/src/index.css` `@media print` e referencia classes do layout — qualquer mudança de cor/estrutura exige re-testar `Ctrl+P`.
- **Comentários:** zero por padrão; só o "porquê" não-óbvio.
- Charts permanecem SVG inline; nesta onda só consomem a paleta de métricas via `constants.ts` (sem reescrever charts).

## File Structure

- `frontend/src/index.css` — **Modify:** tokens de superfície + paleta de métricas (CSS vars) + utilitários `.bg-surface/.bg-card/.bg-elevated/.bg-input`; ajustar 1 seletor no `@media print`.
- `frontend/src/lib/constants.ts` — **Modify:** adicionar `M_COLOR` canônico + reconciliar `ZONES`.
- `frontend/src/pages/JogadorPerfil.tsx` — **Modify:** remover `M_COLOR` local, importar de `constants`.
- `frontend/src/components/ui/Button.tsx` — **Create.**
- `frontend/src/components/ui/PageHeader.tsx` — **Create.**
- `frontend/src/components/ui/LoadingState.tsx` — **Create.**
- `frontend/src/components/ui/EmptyState.tsx` — **Create.**
- `frontend/src/pages/Backups.tsx`, `Painel.tsx`, `Comparar.tsx`, `JogadorPerfil.tsx` — **Modify:** adotar os novos componentes (exemplos canônicos).
- Varredura de tokens: `Layout.tsx`, `Login.tsx`, `NotFound.tsx`, `Comparar.tsx`, `JogadorPerfil.tsx`, `Sessoes.tsx`, `SessaoDashboard.tsx`, `Jogadores.tsx`, `Painel.tsx`, `ConfirmModal.tsx`, `EditSessaoModal.tsx`, `PlayerAvatar.tsx` — **Modify.**

---

## Task 1: Tokens de superfície + paleta de métricas (index.css)

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: nada.
- Produces: utilitários CSS `.bg-surface`, `.bg-card`, `.bg-elevated`, `.bg-input` (claro+escuro automático); CSS vars `--metric-dist/-mpm/-hsr/-sprint/-acel/-desac` para uso futuro em SVG.

- [ ] **Step 1: Adicionar as CSS vars de superfície e métricas**

Em `frontend/src/index.css`, logo após o bloco `@theme { ... }` (depois da linha `}` que fecha o `@theme`, antes de `@layer base`), inserir:

```css
/* Superfícies semânticas — invertem sob .dark, fonte única de verdade dos fundos */
:root {
  --surface-base:     #f8fafc; /* slate-50 — fundo de página */
  --surface-card:     #ffffff; /* cards/painéis */
  --surface-elevated: #ffffff; /* modais */
  --surface-input:    #f8fafc; /* campos de formulário */

  --metric-dist:   #0d9488; /* teal */
  --metric-mpm:    #1e3a8a; /* navy */
  --metric-hsr:    #f97316; /* orange */
  --metric-sprint: #ef4444; /* red */
  --metric-acel:   #06b6d4; /* cyan */
  --metric-desac:  #7c3aed; /* purple */
}
.dark {
  --surface-base:     #050608;
  --surface-card:     #08090c;
  --surface-elevated: #0d1117;
  --surface-input:    #11161d;
}
```

- [ ] **Step 2: Adicionar os utilitários de superfície**

No bloco `@layer utilities { ... }` existente (começa na linha ~65), adicionar ao final (antes do `}` que fecha o layer):

```css
  /* Superfícies canônicas — substituem os fundos hex ad-hoc */
  .bg-surface  { background-color: var(--surface-base); }
  .bg-card     { background-color: var(--surface-card); }
  .bg-elevated { background-color: var(--surface-elevated); }
  .bg-input    { background-color: var(--surface-input); }
```

- [ ] **Step 3: Atualizar o seletor de print que dependia do hex antigo**

No bloco `@media print`, a regra `break-inside` (linha ~176-182) referencia `.dark\:bg-\[\#0a0a0a\]`, que deixará de existir após a varredura (Task 6). Substituir esse seletor por `.bg-card`. Trocar:

```css
  section, article,
  .bg-white,
  .dark\:bg-\[\#0a0a0a\],
  .rounded-xl, .rounded-2xl {
    break-inside: avoid;
    page-break-inside: avoid;
  }
```

por:

```css
  section, article,
  .bg-white, .bg-card,
  .rounded-xl, .rounded-2xl {
    break-inside: avoid;
    page-break-inside: avoid;
  }
```

- [ ] **Step 4: Verificar build + dark/light + print**

Run: `npm --prefix frontend run build`
Expected: build verde (exit 0).
Depois, manualmente (`npm --prefix frontend run dev`): a aparência não muda ainda (nenhuma página usa as classes novas), e `Ctrl+P` numa página com cards continua quebrando página corretamente.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(ux): tokens de superficie + paleta de metricas + utilitarios bg-*"
```

---

## Task 2: Paleta de métricas canônica em constants.ts

**Files:**
- Modify: `frontend/src/lib/constants.ts`
- Modify: `frontend/src/pages/JogadorPerfil.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `export const M_COLOR: Record<'dist'|'mpm'|'hsr'|'sprint'|'acel'|'desac', string>`.

- [ ] **Step 1: Adicionar M_COLOR a constants.ts**

Em `frontend/src/lib/constants.ts`, após o bloco `ZONES` (linha 16), adicionar:

```ts
// ─── Paleta canônica por métrica (badges, gráficos, legendas) ────────────────
export const M_COLOR = {
  dist:   '#0d9488', // teal — distância total
  mpm:    '#1e3a8a', // navy — metragem/min
  hsr:    '#f97316', // orange — high-speed running
  sprint: '#ef4444', // red — sprint
  acel:   '#06b6d4', // cyan — acelerações
  desac:  '#7c3aed', // purple — desacelerações
} as const;
```

- [ ] **Step 2: Reconciliar ZONES com a paleta**

Em `frontend/src/lib/constants.ts`, no bloco `ZONES` (linhas 14-15), alinhar `hsr` e `sprint` à paleta canônica. Trocar:

```ts
  hsr:    '#f97316',  // laranja-500
  sprint: '#ef4444',  // vermelho-500
```

(já estão alinhados com `M_COLOR` — confirmar que continuam `'#f97316'` e `'#ef4444'`; nenhuma mudança de valor é necessária, este passo é só a verificação de consistência.)

- [ ] **Step 3: Substituir o M_COLOR local de JogadorPerfil pelo import**

Em `frontend/src/pages/JogadorPerfil.tsx`, localizar o bloco local `const M_COLOR = { ... }` (por volta da linha 68-80) e removê-lo. Adicionar `M_COLOR` ao import existente de `'../lib/constants'` (se não houver import desse módulo, criar `import { M_COLOR } from '../lib/constants';`). O uso de `M_COLOR.dist` etc. no arquivo permanece idêntico.

- [ ] **Step 4: Verificar build**

Run: `npm --prefix frontend run build`
Expected: build verde. Abrir o Perfil do Jogador no dev e confirmar que as cores das métricas continuam idênticas.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/constants.ts frontend/src/pages/JogadorPerfil.tsx
git commit -m "feat(ux): paleta de metricas canonica (M_COLOR) em constants"
```

---

## Task 3: Componente `<Button>`

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`
- Modify: `frontend/src/pages/Backups.tsx`

**Interfaces:**
- Produces: `Button` (default export e named) com props `variant?: 'primary'|'ghost'|'danger'`, `size?: 'sm'|'md'`, e todas as props nativas de `<button>`.

- [ ] **Step 1: Criar o componente**

Create `frontend/src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center gap-2 font-bold font-outfit rounded-xl ' +
  'transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:pointer-events-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-red/50 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--surface-base)]';

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
};

const variants: Record<Variant, string> = {
  primary: 'bg-club-red text-white shadow-lg shadow-club-red/25 hover:brightness-110',
  ghost:
    'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 ' +
    'border border-slate-200/60 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10',
  danger: 'bg-rose-600 text-white shadow-lg shadow-rose-600/25 hover:bg-rose-700',
};

export const Button = ({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) => (
  <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
);

export default Button;
```

- [ ] **Step 2: Adotar em Backups (botão "Criar backup agora")**

Em `frontend/src/pages/Backups.tsx`, importar `import { Button } from '../components/ui/Button';` e substituir o `<button onClick={handleCreate} ...>` (o de classe `bg-club-red ...`) por:

```tsx
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? 'Criando…' : 'Criar backup agora'}
        </Button>
```

- [ ] **Step 3: Verificar build + visual**

Run: `npm --prefix frontend run build`
Expected: verde. No dev, o botão de Backups deve ter aparência equivalente (vermelho, hover, foco visível ao Tab).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/Button.tsx frontend/src/pages/Backups.tsx
git commit -m "feat(ux): componente Button (primary/ghost/danger) + adocao em Backups"
```

---

## Task 4: Componente `<PageHeader>`

**Files:**
- Create: `frontend/src/components/ui/PageHeader.tsx`
- Modify: `frontend/src/pages/Backups.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `PageHeader` com props `eyebrow: string`, `title: string`, `subtitle?: string`, `actions?: React.ReactNode`.

- [ ] **Step 1: Criar o componente** (extraído do padrão de header do Painel — faixa de acento gradiente + eyebrow + título)

Create `frontend/src/components/ui/PageHeader.tsx`:

```tsx
import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export const PageHeader = ({ eyebrow, title, subtitle, actions }: PageHeaderProps) => (
  <header className="relative overflow-hidden bg-card border-b border-slate-200/50 dark:border-white/[0.04] px-8 py-6 transition-colors">
    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-club-red via-club-gold to-club-red" />
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div>
        <p className="text-[9px] font-extrabold uppercase tracking-widest text-club-red font-outfit mb-1">{eyebrow}</p>
        <h1 className="text-2xl font-extrabold text-slate-850 dark:text-white tracking-tight font-outfit">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </header>
);

export default PageHeader;
```

- [ ] **Step 2: Adotar em Backups** (que hoje não tem header de página)

Em `frontend/src/pages/Backups.tsx`, importar `import { PageHeader } from '../components/ui/PageHeader';`. Substituir o bloco do título atual (`<div className="flex items-center justify-between mb-6 ...">` contendo o `<h1>Backups</h1>`, subtítulo e o botão) por:

```tsx
      <PageHeader
        eyebrow="Administração"
        title="Backups"
        subtitle="Backup automático diário às 03:00. Mantém os últimos 5 automáticos; os manuais ficam até serem excluídos."
        actions={
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Criando…' : 'Criar backup agora'}
          </Button>
        }
      />
```

Ajustar o container raiz da página: a lista de backups e o `ConfirmModal` ficam dentro de um `<main className="p-6 md:p-8 max-w-4xl mx-auto">` logo após o `<PageHeader>` (o `max-w-4xl mx-auto` que antes envolvia tudo passa a envolver só o conteúdo abaixo do header).

- [ ] **Step 3: Verificar build + visual + print**

Run: `npm --prefix frontend run build`
Expected: verde. No dev, Backups passa a ter a faixa de acento + eyebrow "Administração". `Ctrl+P` não regride.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/PageHeader.tsx frontend/src/pages/Backups.tsx
git commit -m "feat(ux): componente PageHeader + adocao em Backups"
```

---

## Task 5: Componentes `<LoadingState>` e `<EmptyState>`

**Files:**
- Create: `frontend/src/components/ui/LoadingState.tsx`
- Create: `frontend/src/components/ui/EmptyState.tsx`
- Modify: `frontend/src/pages/Painel.tsx`

**Interfaces:**
- Produces:
  - `LoadingState` com prop `label?: string` (default "Carregando…").
  - `EmptyState` com props `title: string`, `description?: string`, `icon?: React.ReactNode`, `action?: React.ReactNode`.

- [ ] **Step 1: Criar `LoadingState`** (skeleton com `animate-pulse`)

Create `frontend/src/components/ui/LoadingState.tsx`:

```tsx
interface LoadingStateProps {
  label?: string;
}

export const LoadingState = ({ label = 'Carregando…' }: LoadingStateProps) => (
  <div className="p-6 space-y-6 max-w-[1600px] mx-auto" aria-busy="true" aria-live="polite">
    <span className="sr-only">{label}</span>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
      ))}
    </div>
    <div className="h-64 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
    <div className="h-64 rounded-2xl bg-slate-200/60 dark:bg-white/5 animate-pulse" />
  </div>
);

export default LoadingState;
```

- [ ] **Step 2: Criar `EmptyState`**

Create `frontend/src/components/ui/EmptyState.tsx`:

```tsx
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, icon, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6">
    {icon && <div className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-600">{icon}</div>}
    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 font-outfit">{title}</h3>
    {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
```

- [ ] **Step 3: Adotar `LoadingState` no Painel** (substitui o texto invisível da linha 545)

Em `frontend/src/pages/Painel.tsx`, importar `import { LoadingState } from '../components/ui/LoadingState';` e trocar a linha 545:

```tsx
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-450 dark:text-slate-500 text-xs font-semibold uppercase tracking-widest font-outfit">Carregando painel analítico…</div>;
```

por:

```tsx
  if (loading) return <LoadingState label="Carregando painel analítico…" />;
```

- [ ] **Step 4: Verificar build + visual**

Run: `npm --prefix frontend run build`
Expected: verde. No dev, recarregar o Painel mostra skeleton pulsante em vez de tela vazia.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/LoadingState.tsx frontend/src/components/ui/EmptyState.tsx frontend/src/pages/Painel.tsx
git commit -m "feat(ux): componentes LoadingState (skeleton) + EmptyState; skeleton no Painel"
```

---

## Task 6: Varredura de tokens + emoji→SVG

**Files:**
- Modify: `Layout.tsx`, `Login.tsx`, `NotFound.tsx`, `Comparar.tsx`, `JogadorPerfil.tsx`, `Sessoes.tsx`, `SessaoDashboard.tsx`, `Jogadores.tsx`, `Painel.tsx`, `components/ConfirmModal.tsx`, `components/EditSessaoModal.tsx`, `components/PlayerAvatar.tsx` (todos em `frontend/src/`)

**Interfaces:**
- Consumes: utilitários `.bg-surface/.bg-card/.bg-elevated/.bg-input` da Task 1.
- Produces: nada (refactor de classes).

- [ ] **Step 1: Substituir os fundos de página (find → replace, em todos os arquivos)**

Aplicar exatamente estes mapeamentos de string (busca literal → substituição). São fundos sólidos de página:

| Buscar (literal) | Substituir por |
|---|---|
| `bg-slate-50 dark:bg-[#050608]` | `bg-surface` |
| `bg-slate-100 dark:bg-[#111111]` | `bg-surface` |

Ocorrências conhecidas: `Layout.tsx:107`, `Login.tsx:39`, `Painel.tsx:550`, `Comparar.tsx:219`, `JogadorPerfil.tsx:431`, `NotFound.tsx:8`, `SessaoDashboard.tsx:1229`, `Sessoes.tsx:621`. (Usar busca global no projeto para pegar todas.)

- [ ] **Step 2: Substituir os fundos de card (find → replace)**

| Buscar (literal) | Substituir por |
|---|---|
| `bg-white dark:bg-[#0a0a0a]` | `bg-card` |
| `bg-white dark:bg-[#08090c]` | `bg-card` |
| `bg-white dark:bg-[#0d1117]` | `bg-card` |

Manter intactas as variantes translúcidas/glass (`bg-white/60 dark:bg-[#08090c]/40`, `bg-white/70 ...`, `bg-white/85 ...`) e o utilitário `glass-panel` — NÃO trocar essas.

- [ ] **Step 3: Substituir os fundos de input (find → replace)**

| Buscar (literal) | Substituir por |
|---|---|
| `bg-white dark:bg-[#11161d]` | `bg-input` |
| `dark:bg-[#11161d]` (quando isolado, ex. PlayerAvatar) | `dark:bg-input` |
| `bg-slate-50 dark:bg-[#07080a]` | `bg-input` |
| `bg-slate-50 dark:bg-[#11161d]` | `bg-input` |

Observação: onde a classe aparece sem o par claro (ex. `PlayerAvatar.tsx:45` `'bg-slate-100 dark:bg-[#11161d]'`), trocar só o lado dark por `dark:bg-input` mantendo o lado claro existente.

- [ ] **Step 4: Substituir os fundos de modal (find → replace)**

| Buscar (literal) | Substituir por |
|---|---|
| `bg-white dark:bg-[#111111]` | `bg-elevated` |

Ocorrências: `ConfirmModal.tsx:28`, `EditSessaoModal.tsx:66`.

- [ ] **Step 5: Trocar os emoji dos insights do Painel por SVG**

Em `frontend/src/pages/Painel.tsx`, no bloco de insights (linha ~644 e ~653), substituir a lógica de emoji por ícones SVG. Trocar:

```tsx
              const icon = isRisco ? '⚠️' : isBaixa ? '📉' : isVolume ? '📊' : '💡';
```
e o uso:
```tsx
                  <span className="text-lg mt-0.5 shrink-0 select-none">{icon}</span>
```

por (define um SVG por categoria, no estilo stroke do app):

```tsx
              const iconColor = isRisco ? 'text-red-500' : isBaixa ? 'text-yellow-500' : 'text-club-red';
              const iconPath = isRisco
                ? 'M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z' // alerta
                : isBaixa
                ? 'M23 18l-9.5-9.5-5 5L1 6'   // tendência de queda
                : isVolume
                ? 'M3 3v18h18M18 17V9M13 17V5M8 17v-3' // barras
                : 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z'; // lâmpada
```
e o uso:
```tsx
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                  </svg>
```

- [ ] **Step 6: Verificar build + visual (dark/light) + print**

Run: `npm --prefix frontend run build`
Expected: verde. No dev: percorrer Painel, Comparar, JogadorPerfil, Sessoes, SessaoDashboard, Jogadores, Login, NotFound, Backups, e os modais (ConfirmModal/EditSessaoModal) em **dark e light** — os fundos devem ficar consistentes (sem regressão visual perceptível além da unificação de tom). `Ctrl+P` numa página com cards e numa com tabela: sem regressão. Confirmar (busca global) que não restou `dark:bg-[#0a0a0a]`, `dark:bg-[#08090c]`, `dark:bg-[#111111]`, `dark:bg-[#0d1117]`, `dark:bg-[#11161d]`, `dark:bg-[#07080a]`, `dark:bg-[#050608]` em fundos sólidos (exceto dentro de utilitários translúcidos/glass que foram intencionalmente preservados).

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "refactor(ux): migra fundos hex ad-hoc para tokens bg-surface/card/input/elevated + emoji->SVG"
```

---

## Notas

- Páginas serão tocadas de novo nas ondas seguintes (Estados, Mobile, A11y) — manter os diffs desta onda restritos a tokens/componentes/varredura, sem antecipar trabalho das próximas.
- Após a Onda 1, as adoções de `<PageHeader>`/`<Button>`/`<EmptyState>` nas demais páginas (Comparar, JogadorPerfil, Sessoes, Painel) continuam na Onda 2 junto dos estados — aqui ficaram os exemplos canônicos (Backups, Painel) para travar o padrão.
- **Deferido por decisão de escopo (vs. spec Onda 1):** a consolidação de **raio/borda** (`rounded-xl` vs `rounded-2xl`, opacidades de borda) e a aplicação completa das **regras de tipografia** (`font-outfit`/`font-sans`/`font-mono` por papel) NÃO entram nesta onda. Motivo: exigem iteração visual e, feitas como sweep junto da migração de fundos, inchariam um diff já grande e arriscado. Ficam para serem aplicadas **incrementalmente** quando cada página for editada nas Ondas 2-4 (a página já estará aberta), seguindo as convenções documentadas no spec §5. Esta onda entrega a unificação de **fundos** (o maior ganho isolado de consistência) + os primitivos compartilhados.
