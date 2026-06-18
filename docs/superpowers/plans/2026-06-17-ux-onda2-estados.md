# UX Onda 2 — Estados & Segurança Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar feedback de estado e proteções de segurança no app — modal acessível, confirmação em ação destrutiva, skeletons nas páginas de dados restantes, estados vazios com CTA e validação+progresso no Upload — usando os componentes da Onda 1.

**Architecture:** Reusa os primitivos da Onda 1 (`LoadingState`, `EmptyState`, `ConfirmModal`). Endurece o `ConfirmModal` (foco/Escape/trap) primeiro, pois a confirmação de inativação depende dele. Cada mudança é cirúrgica numa página/componente existente.

**Tech Stack:** React 19, Vite, Tailwind v4, TypeScript. Sem libs novas.

## Global Constraints

Do spec `docs/superpowers/specs/2026-06-17-ux-frontend-program-design.md` (§6) e do `CLAUDE.md`:

- **Branch:** `feat/ux-onda2-estados` (já criada, a partir da `main`). Nunca commitar na `main`.
- **Sem dependências novas.** Tailwind v4 + SVG inline.
- **Sem framework de testes.** Verificação de cada task = `npm --prefix frontend run build` verde + checagem manual (dark/light; teclado no modal; `Ctrl+P` onde toca layout). NÃO instalar vitest/jest.
- **Reusar os componentes da Onda 1:** `LoadingState`, `EmptyState` (`frontend/src/components/ui/`), `ConfirmModal` (`frontend/src/components/`). Não criar novos.
- **Paridade dark/light** em tudo que tocar.
- **Comentários:** zero por padrão; só "porquê" não-óbvio.
- **Preservar comportamento existente** — estas mudanças adicionam feedback/segurança, não alteram a lógica de dados.

## File Structure

- `frontend/src/components/ConfirmModal.tsx` — **Modify:** foco ao abrir, `Escape`, focus trap, restaurar foco.
- `frontend/src/pages/Painel.tsx` — **Modify:** confirmação antes de `marcarInativo`.
- `frontend/src/pages/JogadorPerfil.tsx` — **Modify:** skeleton no loading.
- `frontend/src/pages/SessaoDashboard.tsx` — **Modify:** skeleton no loading.
- `frontend/src/pages/Backups.tsx` — **Modify:** `EmptyState` na lista vazia.
- `frontend/src/pages/Comparar.tsx` — **Modify:** `EmptyState` quando não há comparação.
- `frontend/src/pages/Upload.tsx` — **Modify:** validação de arquivo + spinner/progresso.

---

## Task 1: ConfirmModal acessível (foco + Escape + trap)

**Files:**
- Modify: `frontend/src/components/ConfirmModal.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: mesma API (`open/message/details?/confirmLabel?/onConfirm/onCancel`); ganha foco automático no botão Cancelar ao abrir, `Escape` cancela, `Tab` fica preso entre os 2 botões, foco restaurado ao fechar.

- [ ] **Step 1: Reescrever o componente com gestão de foco**

Substituir todo o conteúdo de `frontend/src/components/ConfirmModal.tsx` por:

```tsx
import React, { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  open: boolean;
  message: string;
  /** Contexto adicional (ex: nome/data da sessão) — destacado em chip abaixo da mensagem. */
  details?: string;
  /** Texto do botão de confirmação. Default: "Sim, remover". */
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open, message, details, confirmLabel = 'Sim, remover', onConfirm, onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => { prevFocus.current?.focus?.(); };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onCancel(); return; }
    if (e.key === 'Tab') {
      const f = dialogRef.current?.querySelectorAll<HTMLElement>('button');
      if (!f || f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="bg-elevated rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-200 dark:border-white/[0.06] animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center border border-rose-200 dark:border-rose-500/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-rose-600 dark:text-rose-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="pt-1 min-w-0 flex-1">
            <h3 id="confirm-modal-title" className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Atenção
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {message}
            </p>
            {details && (
              <p className="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/[0.06] text-[12px] font-bold text-slate-700 dark:text-slate-200 truncate">
                {details}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/25 transition-all active:scale-95"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verificar build + teclado**

Run: `npm --prefix frontend run build`
Expected: verde. Manual (dev): abrir um modal de confirmação existente (ex: excluir uma sessão em Sessões) → o foco entra no "Cancelar"; `Tab`/`Shift+Tab` circula só entre Cancelar/Confirmar; `Esc` fecha; ao fechar, o foco volta pro botão que abriu.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ConfirmModal.tsx
git commit -m "feat(ux): ConfirmModal acessivel (foco ao abrir + Escape + focus trap + restore)"
```

---

## Task 2: Confirmação ao inativar atleta (Painel)

**Files:**
- Modify: `frontend/src/pages/Painel.tsx`

**Interfaces:**
- Consumes: `ConfirmModal` (Task 1).
- Produces: nada.

- [ ] **Step 1: Importar o ConfirmModal**

Em `frontend/src/pages/Painel.tsx`, adicionar ao bloco de imports (junto dos outros de `../components/...`):

```tsx
import { ConfirmModal } from '../components/ConfirmModal';
```

- [ ] **Step 2: Adicionar estado do alvo de inativação**

No corpo do componente Painel, junto dos outros `useState` (perto de `filtroZona`), adicionar:

```tsx
  const [inativarAlvo, setInativarAlvo] = useState<AtletaAnalise | null>(null);
```

- [ ] **Step 3: Trocar o clique direto por abrir o modal**

Em `frontend/src/pages/Painel.tsx`, no botão "Inativar Atleta" (por volta da linha 825), trocar:

```tsx
                    <button onClick={() => marcarInativo(a)}
```
por:

```tsx
                    <button onClick={() => setInativarAlvo(a)}
```

(o resto do botão — `title`, classes, texto — permanece igual.)

- [ ] **Step 4: Renderizar o ConfirmModal**

Em `frontend/src/pages/Painel.tsx`, imediatamente antes do `</div>` que fecha o container raiz da página (o `<div className="min-h-screen bg-surface ...">` aberto no `return`), adicionar:

```tsx
      <ConfirmModal
        open={inativarAlvo !== null}
        message={`Marcar este atleta como inativo? A data de saída será registrada como ${inativarAlvo?.ultimaSessao ? formatData(inativarAlvo.ultimaSessao) : 'hoje'}.`}
        details={inativarAlvo ? (inativarAlvo.apelido || inativarAlvo.nome.split(',')[0]) : undefined}
        confirmLabel="Sim, inativar"
        onConfirm={() => { if (inativarAlvo) marcarInativo(inativarAlvo); setInativarAlvo(null); }}
        onCancel={() => setInativarAlvo(null)}
      />
```

- [ ] **Step 5: Verificar build + fluxo**

Run: `npm --prefix frontend run build`
Expected: verde. Manual (dev): no card de atletas sem participação, clicar "Inativar Atleta" abre o modal com o nome do atleta; "Cancelar" não muda nada; "Sim, inativar" executa a inativação (toast de sucesso) e fecha.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Painel.tsx
git commit -m "feat(ux): confirmacao antes de inativar atleta no Painel"
```

---

## Task 3: Skeletons nas páginas de dados restantes

**Files:**
- Modify: `frontend/src/pages/JogadorPerfil.tsx`
- Modify: `frontend/src/pages/SessaoDashboard.tsx`

**Interfaces:**
- Consumes: `LoadingState` (`../components/ui/LoadingState`).
- Produces: nada.

- [ ] **Step 1: JogadorPerfil — importar e trocar o loading**

Em `frontend/src/pages/JogadorPerfil.tsx`, adicionar o import `import { LoadingState } from '../components/ui/LoadingState';` (junto dos outros imports de componentes) e trocar a linha 406:

```tsx
  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando…</div>;
```
por:

```tsx
  if (loading) return <LoadingState label="Carregando perfil do atleta…" />;
```

- [ ] **Step 2: SessaoDashboard — importar e trocar o loading**

Em `frontend/src/pages/SessaoDashboard.tsx`, adicionar o import `import { LoadingState } from '../components/ui/LoadingState';` (junto dos outros imports de componentes) e trocar a linha 1207:

```tsx
  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando…</div>;
```
por:

```tsx
  if (loading) return <LoadingState label="Carregando sessão…" />;
```

- [ ] **Step 3: Verificar build + visual**

Run: `npm --prefix frontend run build`
Expected: verde. Manual (dev): recarregar o Perfil de um jogador e o Dashboard de uma sessão mostra skeleton pulsante (dark e light) em vez do texto "Carregando…".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/JogadorPerfil.tsx frontend/src/pages/SessaoDashboard.tsx
git commit -m "feat(ux): skeleton (LoadingState) no JogadorPerfil e SessaoDashboard"
```

---

## Task 4: Estados vazios com CTA (Backups + Comparar)

**Files:**
- Modify: `frontend/src/pages/Backups.tsx`
- Modify: `frontend/src/pages/Comparar.tsx`

**Interfaces:**
- Consumes: `EmptyState` (`../components/ui/EmptyState`).
- Produces: nada.

- [ ] **Step 1: Backups — usar EmptyState na lista vazia**

Em `frontend/src/pages/Backups.tsx`, adicionar `import { EmptyState } from '../components/ui/EmptyState';` e substituir o ramo de lista vazia (o `list.length === 0 ? ( <p ...>Nenhum backup ainda...</p> )`) por:

```tsx
        <EmptyState
          title="Nenhum backup ainda"
          description="Clique em “Criar backup agora” para gerar o primeiro backup do banco."
        />
```

- [ ] **Step 2: Comparar — EmptyState quando não há comparação**

Em `frontend/src/pages/Comparar.tsx`, adicionar `import { EmptyState } from '../components/ui/EmptyState';`. Logo APÓS o bloco de resultados `{dados && dados.length >= 2 && ( ... )}` (que começa na linha ~314), adicionar:

```tsx
        {(!dados || dados.length < 2) && (
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-full h-full">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V9M15 17v-5M3 3v18h18M21 7l-6 6-4-4-5 5" />
              </svg>
            }
            title="Selecione ao menos 2 jogadores"
            description="Marque de 2 a 4 jogadores acima para comparar as métricas lado a lado."
          />
        )}
```

- [ ] **Step 3: Verificar build + visual**

Run: `npm --prefix frontend run build`
Expected: verde. Manual (dev): Backups sem backups mostra o EmptyState; Comparar sem 2 jogadores selecionados mostra o EmptyState com a instrução (dark e light).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Backups.tsx frontend/src/pages/Comparar.tsx
git commit -m "feat(ux): EmptyState com CTA em Backups e Comparar"
```

---

## Task 5: Validação + feedback no Upload

**Files:**
- Modify: `frontend/src/pages/Upload.tsx`

**Interfaces:**
- Consumes: nada (usa estado local).
- Produces: nada.

- [ ] **Step 1: Adicionar estado de erro de arquivo + validação na seleção**

Em `frontend/src/pages/Upload.tsx`, adicionar um estado de erro junto dos outros `useState` (após `const [enviando, setEnviando] = useState(false);`):

```tsx
  const [fileError, setFileError] = useState<string | null>(null);
```

E uma função de seleção validada (logo antes de `const enviar = ...`):

```tsx
  const MAX_MB = 15;
  const onSelectFile = (f: File | null) => {
    setResultado(null);
    if (!f) { setFile(null); setFileError(null); return; }
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setFile(null); setFileError('O arquivo precisa ser um .csv exportado do Catapult.'); return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFile(null); setFileError(`Arquivo muito grande (máx. ${MAX_MB} MB).`); return;
    }
    setFile(f); setFileError(null);
  };
```

- [ ] **Step 2: Ligar o input à validação e mostrar o erro inline**

Em `frontend/src/pages/Upload.tsx`, trocar o `onChange` do input de arquivo (linha ~68):

```tsx
            onChange={e => setFile(e.target.files?.[0] ?? null)}
```
por:

```tsx
            onChange={e => onSelectFile(e.target.files?.[0] ?? null)}
```

E logo após o `</input>`/fechamento do `<input ... />` do arquivo (dentro do mesmo `<div>` do campo Arquivo, após o input), adicionar a mensagem de erro:

```tsx
          {fileError && (
            <p className="mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">{fileError}</p>
          )}
```

- [ ] **Step 3: Spinner + "Processando…" no botão e bloqueio quando inválido**

Em `frontend/src/pages/Upload.tsx`, trocar o botão de envio (linhas ~120-125) por:

```tsx
        <button
          disabled={enviando || !file}
          className="w-full bg-club-red text-white font-bold rounded-lg px-6 py-2.5 text-sm hover:opacity-90 disabled:opacity-50 accent-glow transition-opacity inline-flex items-center justify-center gap-2"
        >
          {enviando && (
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          {enviando ? 'Processando…' : 'Enviar'}
        </button>
```

- [ ] **Step 4: Verificar build + fluxo**

Run: `npm --prefix frontend run build`
Expected: verde. Manual (dev): selecionar um arquivo não-.csv mostra erro inline e o botão fica desabilitado; selecionar um `.csv` válido habilita; ao enviar, aparece o spinner + "Processando…"; resultado/erro de servidor continua aparecendo como antes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Upload.tsx
git commit -m "feat(ux): validacao de arquivo (.csv/tamanho) + spinner no Upload"
```

---

## Notas

- **Drag-and-drop no Upload** (mencionado no spec §6 como "nice to have") fica DEFERIDO — a validação + spinner já cobrem o risco principal (envio de arquivo inválido / falta de feedback); dropzone é polimento de uma onda futura.
- Páginas tocadas aqui já passaram pela varredura de tokens da Onda 1; manter os diffs restritos ao escopo de estados/segurança. Aproveitar para aplicar incrementalmente as regras de tipografia/raio (deferidas da Onda 1) SÓ se trivial e sem risco visual; caso contrário, deixar para a onda dedicada.
- A `<LoadingState>` é um skeleton genérico (grid 4 + 2 blocos); serve como feedback de carregamento mesmo não espelhando 1:1 o layout de cada página. Refinar skeletons por página é fora do escopo desta onda.
- **Escopo dos skeletons:** o spec §6 lista várias páginas, mas apenas `Painel` (feito na Onda 1), `JogadorPerfil` e `SessaoDashboard` têm um *branch de loading de tela cheia* (`if (loading) return …`). `Comparar` usa `loading` só no rótulo do botão "Comparar"; `Sessoes` não tem branch de loading; `Backups` mostra um texto de loading inline numa lista rápida. Por isso a Task 3 cobre as 2 páginas com loading de tela cheia restantes — não há regressão nas demais.
