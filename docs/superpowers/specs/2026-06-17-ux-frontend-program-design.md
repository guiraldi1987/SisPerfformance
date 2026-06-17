# Spec — Programa de Melhoria de UX do Frontend

**Data:** 2026-06-17
**Projeto:** ApexPRO (Paulista FC)
**Status:** aprovado no brainstorming, aguardando revisão do spec

---

## 1. Objetivo

Elevar a experiência de uso do frontend do ApexPRO em quatro dimensões — **usabilidade/clareza, visual/estética, mobile/responsivo e acessibilidade (WCAG 2.1 AA)** — numa passada geral pelo app, organizada como um programa priorizado em ondas. Base: auditorias dos agentes de UX/UI, UI Design e Acessibilidade (2026-06-17).

## 2. Decisões (confirmadas no brainstorming)

- **Abordagem A — fundações primeiro.** Construir tokens + componentes compartilhados, depois aplicar em ondas temáticas. Minimiza retrabalho (a auditoria mostrou que a maioria dos achados vem da falta de primitivos compartilhados).
- **Programa em 5 ondas, nesta ordem:** Fundações → Estados & Segurança → Mobile → Acessibilidade → Clareza de domínio.
- **Decomposição:** este documento é a spec do **programa**. Cada onda vira **seu próprio plano de implementação** (writing-plans), começando pela Onda 1. Cada onda entrega software funcionando e verificável por si.
- **Sem libs novas** — manter Tailwind v4 + charts SVG inline (CLAUDE.md #10). Sem headless-UI, sem chart lib, sem reescrita de charts.

## 3. Escopo

**Dentro:** todas as páginas de `frontend/src/pages/` e componentes de `frontend/src/components/`, os tokens em `frontend/src/index.css`, e `frontend/src/lib/constants.ts`. Melhorias nas 4 dimensões acima.

**Fora (YAGNI):** backend; novas dependências; reescrita da arquitetura de charts SVG; internacionalização; multi-tenant/RBAC (1 usuário real); mudança de stack.

## 4. Restrições

- **Tailwind v4** (`@theme`, `@apply`, `@custom-variant`) — warnings de IDE são cosméticos.
- **Charts são SVG inline manual** (`frontend/src/components/charts/`) — não trocar por lib; acessibilizar com labeling pragmático.
- **Print CSS acoplado:** `frontend/src/index.css` bloco `@media print` referencia classes do layout/tabelas. Qualquer mudança em layout/tabela exige re-testar `Ctrl+P` (Ondas 1 e 3 principalmente).
- **Paridade dark/light** obrigatória.
- **1 usuário real** (Eduardo, preparador físico) — sem feature flag / backward-compat.
- **Sem framework de testes** no projeto — verificação por `npm run build` verde + checagem manual (responsivo em ~375px, `Ctrl+P`) + axe DevTools quando aplicável a a11y.

---

## 5. Onda 1 — Fundações (design system)

Maior alavancagem: completar tokens e extrair componentes compartilhados; a acessibilidade já nasce embutida neles.

**Entregáveis**
- **Tokens em `index.css @theme`:** unificar os 5+ fundos escuros ad-hoc espalhados (`#050608`, `#08090c`, `#0a0a0a`, `#0b0c10`, `#111111`) em `--color-dark-base / --color-dark-card / --color-dark-surface` (usar os tokens `club-dark`/`club-dark-card` que já existem mas não são usados sistematicamente); idem superfícies light (`bg-slate-50` vs `bg-slate-100`). Expor a paleta de métricas como CSS vars para os SVGs.
- **Paleta de métricas canônica:** mover `M_COLOR` de `JogadorPerfil.tsx:68-80` para `constants.ts`; reconciliar com `ZONES` (ex.: HSR `#f97316` vs `#f59e0b`).
- **Componentes compartilhados** (`frontend/src/components/`):
  - `<PageHeader eyebrow title subtitle?>` — faixa de header com linha de acento gradiente (hoje reimplementada com paddings/tamanhos diferentes por página).
  - `<Button variant="primary|ghost|danger">` — colapsa as 4+ versões de CTA (gradiente vs flat, `rounded-xl` vs `rounded-lg`, `brightness-110` vs `opacity-90`); inclui foco visível, `disabled`, hover/active unificados.
  - `<LoadingState>` — skeleton com `animate-pulse` (substitui o "Carregando…" texto invisível).
  - `<EmptyState icon title description action?>`.
  - utilitário `.card` (raio/borda/bg canônicos) em `@layer utilities`.
- **Regras documentadas e aplicadas:** tipografia (`font-outfit` para labels/headings/números/badges; `font-sans` para corpo; `font-mono` para dados tabulares); 3 papéis de heading (título de página / título de seção / eyebrow); raios (`rounded-2xl` painéis, `rounded-xl` chips).
- **Trocar emoji por SVG** nos insights do Painel (`Painel.tsx:644` — ⚠️/📉/📊/💡) por ícones SVG no estilo do app.

**Critérios de aceite**
- Nenhum hex de fundo ad-hoc nas páginas — todos via token.
- `<PageHeader>` usado em todas as páginas principais (Painel, Comparar, JogadorPerfil, Sessoes, Backups…).
- Um único componente de botão primário/ghost/danger em uso.
- `<LoadingState>` e `<EmptyState>` existem e são reutilizáveis.
- Paridade dark/light preservada; `npm run build` verde; `Ctrl+P` sem regressão.

## 6. Onda 2 — Estados & Segurança

**Entregáveis**
- **Skeletons** via `<LoadingState>` nas páginas de dados (`Painel.tsx:545`, `JogadorPerfil`, `SessaoDashboard`, `Comparar`, `Sessoes`, `Backups`) — substituem o texto centralizado invisível.
- **Estados vazios com CTA** via `<EmptyState>`: Comparar ("Selecione até 4 jogadores para comparar" + contador "1 de 4"), Backups, e onde houver lista vazia.
- **Confirmação em ação destrutiva:** `Painel.tsx:815` "Inativar Atleta" passa pelo `ConfirmModal` existente (hoje dispara direto — risco de toque acidental).
- **Upload com validação + progresso** (`Upload.tsx:16-47`): validar extensão `.csv` e tamanho no `onChange` (erro inline antes do envio); spinner + texto "Processando…"; dropzone com drag-and-drop no desktop.
- **ConfirmModal acessível** (`components/ConfirmModal.tsx`): foco no primeiro botão ao abrir, `Escape` cancela, focus trap entre os botões, restaurar foco ao fechar. (Estrutural de a11y, pareado aqui porque mexe no mesmo componente.)

**Critérios de aceite**
- Toda página de dados mostra skeleton no carregamento.
- Nenhuma ação destrutiva dispara sem confirmação.
- Upload rejeita arquivo inválido antes do envio e mostra progresso.
- ConfirmModal totalmente operável por teclado (Tab/Escape/foco).

## 7. Onda 3 — Mobile / pitch-side

**Entregáveis**
- **Sidebar responsiva** (`Layout.tsx`): abaixo de `lg`, vira drawer com botão hambúrguer no topo do `main` + overlay (`fixed inset-0 z-50`); `main` ocupa 100vw em mobile. Estado `sidebarOpen`.
- **Tabelas** (`SessaoDashboard.tsx:352` e demais): `<thead>` sticky; scroll horizontal seguro; **desacoplar** a regra print `overflow-x: visible !important` (`index.css:155-157`) para um seletor específico de tabela (hoje atinge toda `.overflow-x-auto`).
- **Alvos de toque ≥44px** (WCAG 2.5.5): botões críticos a 9px (`Painel.tsx:817` e chips) recebem padding/min-height adequados.
- **Abas responsivas** (`SessaoDashboard.tsx:73`): `overflow-x-auto` com scroll-snap + indicador, ou `<select>` em `sm`.
- **Filtros de data** (`Painel.tsx:865-875`): em mobile, priorizar presets (7D/14D/30D/60D/90D) e recolher os inputs `type=date` crus.

**Critérios de aceite**
- Usável em viewport de 375px sem corte de conteúdo.
- Sidebar acessível por drawer/hambúrguer em mobile; `main` full-width.
- Tabelas com header fixo e scroll horizontal funcional.
- Controles críticos com toque ≥44px.
- `Ctrl+P` (PDF) sem regressão após o desacoplamento do print.

## 8. Onda 4 — Acessibilidade (WCAG 2.1 AA)

**Lote de quick-wins (S):**
- `role="alert"`/`aria-live` no erro de login (`Login.tsx:134-142`) e na **container estática** dos toasts (`Toast.tsx:83-87` — mover o `aria-live` do item para o wrapper em `ToastProvider`).
- `role="img"` + `aria-label` em todos os charts SVG (`Gauge`, `AcwrChart`, `TrendChart`, `RadarComparativo`, `MicrocicloChart`, `MatchTrainingCompare`, `BoxPlotByPosition`, `VolumeIntensityScatter`).
- `aria-hidden="true"` nos ícones de nav (`Layout.tsx:138-154`) e do logout (`182-191`).
- `htmlFor`/`id` nos inputs do Upload (`Upload.tsx:65-117`).
- Remover `tabIndex={-1}` do toggle de senha (`Login.tsx:127`) + `aria-pressed`/`aria-controls`.
- Landmarks: `<nav aria-label="Navegação principal">` nos grupos da sidebar.

**Estrutural (M):**
- `aria-label` por linha nos botões Editar/Excluir de `Sessoes.tsx:226-239` (incluir nome da sessão); remover `opacity-0 group-hover` (foco invisível) → `sr-only`/opacidade reduzida.
- **Contraste:** textos `text-slate-400` e 9-10px (`Layout`, `Upload`, `Sessoes`, `Login`) — aumentar tamanho mínimo (12px decorativo / 14px informativo) ou escurecer (`text-slate-600`).
- **Risco por cor** (`Gauge.tsx`): labels de zona ("Baixa/Média/Alta") ou expor limiares no `aria-label`.
- **Anúncio de troca de rota (SPA):** região `aria-live="polite"` que anuncia o título da página, ou foco em `<main>` após navegação.
- `prefers-reduced-motion` também para animações disparadas por JS.

**Critérios de aceite**
- Todo chart tem nome acessível; erros são anunciados; nenhum controle depende só de cor; textos informativos atingem contraste AA; navegação por landmarks rotulados. (Validar com axe DevTools.)

## 9. Onda 5 — Clareza de domínio (opcional)

- Tooltips/glossário para siglas (ACWR/HSR/z-score) nos rótulos (`title=`) — custo ~zero.
- Legenda do heatmap (`Painel.tsx:236-250`) com unidade ("Menos carga (Player Load médio) → Mais").

**Critério de aceite:** siglas têm explicação por tooltip; legenda do heatmap comunica a unidade.

---

## 10. Critérios de aceite globais

- `npm run build` (frontend) verde ao fim de cada onda.
- Consistência visual: sem hex de fundo ad-hoc; componentes compartilhados em uso.
- Responsivo verificado manualmente em ~375px (Onda 3+).
- `Ctrl+P`/PDF sem regressão (Ondas 1 e 3).
- Acessibilidade verificada com axe DevTools (Onda 4) — sem violações críticas.
- Paridade dark/light em todas as telas tocadas.

## 11. Riscos & mitigação

- **Print CSS acoplado** (`@media print` em `index.css`) — mudanças de layout/tabela podem quebrar o PDF. Mitigar desacoplando seletores e testando `Ctrl+P` após Ondas 1 e 3.
- **Re-tocar arquivos entre ondas** — minimizado pela abordagem A (fundações primeiro), mas páginas serão tocadas em mais de uma onda; manter diffs cirúrgicos.
- **Tailwind v4** — warnings de IDE em `@theme`/`@apply` são cosméticos; build é a fonte de verdade.

## 12. Sequência de implementação

Uma spec (este documento) → um plano por onda via writing-plans, **começando pela Onda 1**. Implementar e revisar onda a onda antes de seguir para a próxima. HANDOVER recebe uma fase por onda concluída (ou uma fase do programa, atualizada por onda).
