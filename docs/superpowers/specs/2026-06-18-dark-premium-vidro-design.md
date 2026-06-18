# Spec — Dark Mode Premium "Vidro & Profundidade"

**Data:** 2026-06-18
**Projeto:** ApexPRO (Paulista FC)
**Status:** aprovado no brainstorming (direção + escopo), aguardando revisão do spec

---

## 1. Objetivo

Dar "vida" e profundidade ao tema escuro do ApexPRO. Hoje o dark lê como uma chapa preta plana: a página (`#050608`) e os cards (`#08090c`) são quase idênticos e as bordas (`white/6%`) são quase invisíveis — os cards não se destacam do fundo, sem hierarquia/elevação.

O alvo (escolhido pelo usuário no companion visual) é a direção **C · Vidro & Profundidade**: superfícies translúcidas e elevadas sobre um fundo com halo radial, com leve highlight na borda superior dos painéis — estilo "Linear/Apple" premium, mantendo a identidade esportiva vermelha do clube.

## 2. Decisões (confirmadas no brainstorming)

- **Direção visual: C · Vidro & Profundidade.** (Descartadas: A · Elevação Sutil — sóbria demais; B · Glow Esportivo — brilho/neon demais.)
- **Mecanismo: token-global.** Implementar quase inteiramente nos tokens `.dark` e em utilitários compartilhados (`.bg-card`, `.bg-elevated`, `.bg-surface`) que a Onda 1 (Fundações) já centralizou — propaga ao app inteiro sem refazer página por página.
- **Foco dark; light intacto.** Só o bloco `.dark` muda. Os tokens `:root` (light) continuam brancos sólidos. Paridade preservada.
- **Vidro sem `backdrop-blur` nos cards de lista.** Blur de verdade só em overlays/modais/header sticky (onde há conteúdo atrás pra borrar). Nos ~14 cards da Sessões, o "vidro" = translucidez + highlight + sombra, sem custo de render.
- **Vermelho do Jogo mantido** como identidade (accent + chip vermelho nos cards de Jogo), com gradiente sutil.
- **Sem libs novas; sem feature flag.** 1 usuário real (Eduardo) — troca direta (CLAUDE.md #4, #10).

## 3. Escopo

**Dentro:** o bloco `.dark` e os utilitários de superfície em `frontend/src/index.css`; limpeza dos poucos fundos hex ad-hoc remanescentes em componentes/páginas (ex.: `dark:bg-[#1a1a1a]`, `#0b0c10`); verificação visual de todas as páginas que herdam os tokens (Painel, Sessões, Comparar, JogadorPerfil, SessaoDashboard, Backups, Upload, Login, modais, Layout/sidebar).

**Fora (YAGNI):** backend; mudanças no tema light; redesenho de layout/estrutura das páginas (isto é só tratamento de superfície/cor/profundidade); reescrita de charts SVG; tipografia/espaçamento (fora "vida" do dark); as Ondas 3–5 do programa de UX (mobile, a11y, clareza) seguem independentes.

## 4. Restrições

- **Tailwind v4** (`@theme`, `@apply`, `@custom-variant`) — warnings de IDE são cosméticos; o build é a fonte de verdade.
- **Print CSS acoplado:** `@media print` em `index.css` (linhas ~148-272) já força `color-scheme: light`, fundo branco e remove `box-shadow`/`text-shadow`/blur. Translucidez e halo não devem afetar o PDF — **testar `Ctrl+P`** após a mudança (CLAUDE.md #6).
- **Composição de `box-shadow` com Tailwind:** utilitários `shadow-*` do Tailwind sobrescrevem `box-shadow` no mesmo elemento. Cards com `hover:shadow-lg` (ex.: `SessaoCard`) podem perder um highlight aplicado via `box-shadow` no hover. Resolver no plano (pseudo-elemento `::before` para a borda-topo, ou aceitar o comportamento no hover, ou usar `border-top-color`).
- **Superfícies translúcidas aninhadas** somam alpha (card translúcido contendo chip translúcido fica mais claro que o esperado). Manter os alphas baixos e revisar componentes com camadas (chips dentro de cards, modais).
- **`.bg-surface` cobre o `body`:** páginas usam wrapper `min-h-screen bg-surface`, que pinta `--surface-base` sólido sobre o `body`. O halo radial precisa morar no nível da superfície da página (`.dark .bg-surface`) — não só no `body` — senão fica escondido.
- **`prefers-reduced-motion`** já tratado globalmente; nenhuma animação nova necessária.

---

## 5. Design técnico

### 5.1 Tokens `.dark` (superfícies)

Trocar os hex sólidos por superfícies translúcidas elevadas, deixando o halo "vazar":

| Token | Hoje | Proposto (dark) | Papel |
|---|---|---|---|
| `--surface-base` | `#050608` | `#080b10` (base sólida atrás do halo) | fundo de página |
| `--surface-card` | `#08090c` | `rgba(255,255,255,0.045)` | cards/painéis |
| `--surface-elevated` | `#0d1117` | `rgba(255,255,255,0.07)` | modais |
| `--surface-input` | `#11161d` | `rgba(255,255,255,0.04)` | campos de formulário |

(Valores são ponto de partida; ajuste fino de alpha durante a implementação, validando contra o mock aprovado.)

### 5.2 Halo de fundo (só dark)

Aplicar um `radial-gradient` sutil no nível da superfície da página (e como fallback no `body`):

```css
.dark body,
.dark .bg-surface {
  background: radial-gradient(130% 90% at 50% -10%, #141b26 0%, #0b0f16 45%, #080b10 100%);
}
```

Poça de luz fria no topo-centro desbotando para a base — origem da sensação de profundidade.

### 5.3 Tratamento "vidro" nos utilitários de superfície (só dark)

`.bg-card` e `.bg-elevated` ganham, em dark, um highlight de borda superior + sombra de elevação suave — sem `backdrop-blur`:

- Highlight topo: linha clara de ~1px no topo do painel (mecanismo a definir no plano — ver restrição de `box-shadow`).
- Sombra: `0 8px 30px rgba(0,0,0,0.35)` para descolar do fundo.
- Borda: subir levemente a cor padrão da borda em dark (de `white/6%` para ~`white/8-10%`) para definição.

### 5.4 Blur só onde há profundidade real

Manter/usar `backdrop-blur` apenas em: overlays de modal (`ConfirmModal`, `EditSessaoModal` já têm `backdrop-blur-sm`), header sticky e drawer (se/quando a Onda 3 existir). Cards de lista: sem blur.

### 5.5 Limpeza de hex ad-hoc

Substituir por tokens/utilitários os fundos escuros hard-coded que escaparam da Onda 1, ex.:
- `Sessoes.tsx` botões Editar/Excluir: `dark:bg-[#1a1a1a]` → token de superfície elevada.
- `.glass-panel`/`.glass-panel-hover` em `index.css`: `#0b0c10`, `#0e1015` → alinhar com os novos tokens.
- Varrer `dark:bg-[#...]` e `#050608/#08090c/#0a0a0a/#0b0c10/#111111` remanescentes nas páginas.

---

## 6. Critérios de aceite

- Em dark, os cards/painéis se destacam claramente do fundo (profundidade visível) em Painel, Sessões, Comparar, JogadorPerfil, SessaoDashboard, Backups, Upload, Login e modais.
- Halo radial perceptível mas sutil no fundo das páginas.
- Nenhum fundo escuro hex ad-hoc remanescente — tudo via token/utilitário.
- Vermelho do clube preservado nos elementos de Jogo.
- **Light mode inalterado.**
- `npm run build` (frontend) verde.
- `Ctrl+P` / PDF sem regressão (continua light, sem sombras/halo).
- Sem `backdrop-blur` em cards de lista (perf).

## 7. Riscos & mitigação

- **`box-shadow` highlight x `hover:shadow-*` do Tailwind** → resolver com pseudo-elemento para a borda-topo ou aceitar a troca no hover (decidir no plano).
- **Translucidez aninhada clareia demais** → alphas baixos; revisar chips/badges dentro de cards e conteúdo dentro de modais.
- **Halo escondido pelo `.bg-surface`** → aplicar o gradiente em `.dark .bg-surface` (não só no `body`).
- **Print** → `@media print` já neutraliza; confirmar com `Ctrl+P` em pelo menos Comparar (PDF) e uma sessão.
- **Contraste de texto sobre superfícies mais claras** → conferir que slates pequenos seguem legíveis (sem piorar vs. hoje).

## 8. Sequência de implementação

Spec (este documento) → um plano via writing-plans. Implementação em passos cirúrgicos: (1) tokens + halo, (2) tratamento vidro nos utilitários, (3) limpeza de hex ad-hoc, (4) varredura visual página a página + `Ctrl+P`. HANDOVER recebe uma fase nova ("Dark Premium — Vidro & Profundidade") ao concluir.
