# Sistema de Gestão de Performance Esportiva — Paulista FC

> **Documento de handover** — captura tudo que foi construído, o que falta, e como continuar em outra máquina.

---

## 🎯 Contexto do Projeto

**Cliente:** Paulista FC — Departamento de Fisiologia
**Objetivo:** Sistema MVP para análise de performance física de atletas a partir de relatórios GPS Catapult (CSV).
**Usuário-alvo:** Preparador físico — precisa visualizar carga de treino, identificar atletas em risco de lesão e comparar performance individual ao longo do tempo.

---

## 🛠️ Stack Tecnológica

### Backend
- **Hono v4** + `@hono/node-server` (porta `3001`)
- **TypeScript** com `tsx watch` em dev
- **Drizzle ORM** + **better-sqlite3** (banco local `backend/ieeegp.db`)
- **PapaParse** para CSV
- WAL mode + `foreign_keys = ON`

### Frontend
- **React 19** + **Vite 8** + **TypeScript**
- **Tailwind CSS v4** (com `@custom-variant dark` e `@theme`)
- **React Router v6** (BrowserRouter, NavLink, useParams)
- Tema dark/light com persistência via localStorage
- Cores do clube: vermelho `#cc1e1e` (`bg-club-red`)

### Decisões importantes
- Migração de PostgreSQL → SQLite (senha do Postgres era desconhecida)
- Tailwind v3 → v4 (resolução de conflito de plugin)
- `parseBody({ all: true })` no Hono v4 — **crítico** para upload de arquivo

---

## 📁 Estrutura

```
IEEEGP - Cel Eduardo/
├── backend/
│   ├── src/
│   │   ├── index.ts                    # mounting de rotas + cors
│   │   ├── db/
│   │   │   ├── index.ts                # conexão SQLite + WAL
│   │   │   └── schema.ts               # tabelas: jogadores, sessoes, metricas
│   │   ├── services/
│   │   │   └── backup.ts               # lógica de snapshot + zip (better-sqlite3.backup + archiver)
│   │   └── routes/
│   │       ├── upload.ts               # POST /api/upload-gps
│   │       ├── jogadores.ts            # CRUD + GET /:id/performance
│   │       ├── sessoes.ts              # GET /, /listagem, /:id, /:id/metricas, /:id/analise, PUT /:id
│   │       ├── analytics.ts            # team-overview, ACWR, microciclo, posicoes-benchmarks (com p95)
│   │       ├── auth.ts                 # POST /login, GET /me — JWT HS256
│   │       ├── usuarios.ts             # CRUD de usuários/staff técnico
│   │       └── backups.ts              # POST/GET/download/DELETE /api/backups (+ agendador node-cron)
│   ├── ieeegp.db                       # SQLite (gitignore)
│   └── drizzle.config.ts
├── frontend/
│   ├── src/
│   │   ├── App.tsx                     # rotas
│   │   ├── theme.tsx                   # ThemeProvider dark/light
│   │   ├── pages/
│   │   │   ├── Layout.tsx              # sidebar com 5 nav links + indicador API
│   │   │   ├── Painel.tsx              # /painel (visão geral + janela personalizável + anomalias)
│   │   │   ├── Sessoes.tsx             # /sessoes (lista por mês + calendário + filtros)
│   │   │   ├── SessaoDashboard.tsx     # /sessao/:id (3 abas)
│   │   │   ├── Comparar.tsx            # /comparar (comparação de 2-4 jogadores)
│   │   │   ├── Jogadores.tsx           # /jogadores (CRUD + gestão de elenco + wizard reapresentação)
│   │   │   ├── JogadorPerfil.tsx       # /jogador/:id (perfil completo)
│   │   │   ├── NotFound.tsx            # rota 404 catch-all
│   │   │   ├── Login.tsx               # /login (form de autenticação)
│   │   │   ├── Upload.tsx              # /upload (form CSV)
│   │   │   ├── Usuarios.tsx            # /usuarios (Gerenciamento do Staff Técnico)
│   │   │   └── Backups.tsx             # /backups (Administração → Backups — criar, listar, baixar, excluir)
│   │   ├── components/charts/
│   │   │   ├── Gauge.tsx                       # gauge SVG semicírculo
│   │   │   ├── InlineBar.tsx                   # barra inline simples
│   │   │   ├── AcwrChart.tsx                   # ACWR com bandas
│   │   │   ├── TrendChart.tsx                  # 4 sparklines (dist/m·min/HSR/sprint)
│   │   │   ├── MatchTrainingCompare.tsx        # barras pareadas Jogo × Treino
│   │   │   ├── MicrocicloChart.tsx             # barras MD-N..MD..MD+N
│   │   │   ├── RadarComparativo.tsx            # radar atleta × posição × p95
│   │   │   ├── BoxPlotByPosition.tsx           # box plot Tukey por posição
│   │   │   └── VolumeIntensityScatter.tsx      # scatter 4-quadrantes com zona ideal
│   │   ├── lib/
│   │   │   ├── api.ts                  # API_BASE
│   │   │   ├── authClient.ts           # token storage + fetch interceptor (Bearer + 401 handler)
│   │   │   ├── constants.ts            # POSICOES, POSICAO_COLOR, POSICAO_SIGLA
│   │   │   ├── format.ts               # formatData, formatSeconds
│   │   │   └── insights.ts             # buildInsights() — 4 categorias auto-geradas
│   │   └── components/
│   │       ├── AuthProvider.tsx           # contexto de autenticação (useAuth)
│   │       ├── ProtectedRoute.tsx         # wrapper que exige sessão válida
│   │       ├── ConfirmModal.tsx           # confirma ação destrutiva (com prop opcional `details`)
│   │       ├── EditSessaoModal.tsx        # modal reutilizável (editar sessão — usado em Sessoes + SessaoDashboard)
│   │       ├── Toast.tsx                  # ToastProvider + useToast (sucesso/erro/info, auto-dismiss)
│   │       ├── RatioCell.tsx              # célula EXC/CON com semáforo + ícone direcional (▼/●/▲)
│   │       ├── ErrorBoundary.tsx
│   │       └── ui/                        # componentes compartilhados do design system (Onda 1)
│   │           ├── Button.tsx             # variantes primary/ghost/danger com foco visível
│   │           ├── PageHeader.tsx         # faixa de acento + eyebrow + título
│   │           ├── LoadingState.tsx       # skeleton animado (substitui spinners ad-hoc)
│   │           └── EmptyState.tsx         # estado vazio padronizado
│   └── public/
│       └── paulista-logo.png
├── pdf_pages/                          # screenshots da referência (XV de Jaú x Paulista)
├── pdf_pages_ref/                      # ref. (Relatório por posição)
└── HANDOVER.md                         # este arquivo
```

---

## 🗃️ Schema do Banco

### `jogadores`
- `id` (PK), `nomeCompleto`, `apelido`, `posicao`, `codigoCsv` (unique), `fotoUrl`
- **`status`** (default `'ativo'`): `'ativo'` | `'inativo'` — filtra dashboards
- **`dataChegada`** (ISO, nullable): primeira sessão participada (auto-backfill no boot)
- **`dataSaida`** (ISO, nullable): preenchido quando vira inativo

### `sessoes`
- `id`, `data` (YYYY-MM-DD), `tipo` ('Treino'|'Jogo'), `descricao` (jogo), `equipe`, `local`, `createdAt`

### `metricas` (1 linha por jogador-período-sessão)
**Identidade:** `id`, `jogadorId`, `sessaoId`, `periodo`

**Volume:**
- `duracao` (segundos), `distanciaTotal` (m), `velocidadeMaxima` (km/h)
- `hsr` (High Speed Distance, m), `hsrEsforcos`, `sprint` (Sprint Distance, m), `sprintEsforcos`
- `aceleracoes`, `desaceleracoes`, `acelDesacelTotal`

**Intensidade (por minuto):**
- `metragemPorMinuto`, `hsrPorMinuto`, `sprintPorMinuto`, `acelDesacelPorMinuto`

**Carga:**
- `cargaJogador` (Player Load), `cargaPorMinuto`, `maxAceleracao`, `maxDesaceleracao`

**Distribuição por zona de velocidade:**
- `distStanding` (Z1, 0-6 km/h)
- `distWalking` (Z2, 6-11)
- `distJogging` (Z3, 11-14)
- `distRunning` (Z4, 14-19)
- `distHi` (Z5, 19-25)
- (`sprint` já é Z6, > 25 km/h)

### `usuarios`
- `id` (PK), `username` (unique), `name`, `passwordHash`, `role`, `status` (default `'ativo'`): `'ativo'` | `'inativo'`, `createdAt`

---

## 🔌 Endpoints Backend

### Upload
- `POST /api/upload-gps` — multipart com `file` + `tipo` + `jogo` + `equipe` + `local`
  - Lê data automaticamente da linha `Date:,DD/MM/YYYY` do CSV
  - Auto-cria jogadores ausentes pelo "Player Name"
  - Suporta períodos: Session, Aquecimento, 1º Tempo, 2º Tempo, Complemento

### Jogadores
- `GET /api/jogadores?status=ativo|inativo|todos` — lista (default: `ativo`)
- `GET /api/jogadores/:id` — detalhe
- `POST /api/jogadores` — cria
- `PUT /api/jogadores/:id` — atualiza (aceita `status`, `dataChegada`, `dataSaida`; auto-preenche `dataSaida` quando muda para inativo)
- `POST /api/jogadores/batch-status` — atualização em lote (body: `{ ids[], status, dataSaida? }`) — usado pelo wizard de Reapresentação
- `DELETE /api/jogadores/:id` — remove permanentemente (preferir marcar inativo para preservar histórico)
- `GET /api/jogadores/:id/performance?tipo=Treino|Jogo` — histórico de sessões
- `POST /api/jogadores/:id/foto` — upload multipart com a imagem do atleta (`foto`). Valida formato (JPEG, PNG, WEBP), tamanho máximo de 2MB, exclui a foto antiga do disco local e atualiza o campo `fotoUrl` no banco de dados.

### Sessões
- `GET /api/sessoes` — lista enxuta (ordem desc por data) — usada por seleção/sidebar
- `GET /api/sessoes/listagem` — lista **enriquecida** com `atletasCount`, `atletasTotal`, `duracaoMax`, `cargaMedia`, `cargaTotal`, `distMedia` por sessão (single round-trip)
- `GET /api/sessoes/:id` — detalhe + períodos disponíveis
- `GET /api/sessoes/:id/metricas?periodo=Session` — métricas por período
- `GET /api/sessoes/:id/analise` — agregado completo (períodos + atletas Session + médias + participação + zonasVelocidade + **`historico`** com médias do mesmo tipo excluindo a atual)
- `PUT /api/sessoes/:id` — atualiza metadados (data, tipo, descrição, equipe, local) — **não** altera métricas
- `DELETE /api/sessoes/:id` — remove (cascade)

### Analytics
- `GET /api/analytics/team-overview?start=ISO&end=ISO` — Painel do Time
  - Janela do heatmap **personalizável** via `start`/`end` (fallback: últimos 14d até hoje, max 366d)
  - Retorna `windowStart`, `windowEnd`, `windowDias` para confirmação
  - Inclui `anomalias[]` — atletas com |z-score| > 2 vs média pessoal em Player Load, distância e m/min
  - Também: `alertas` por zona ACWR, lista `atletas`, `cargaSemanal[]`, `insights[]`
- `GET /api/analytics/jogadores/:id/acwr` — série temporal de ACWR
- `GET /api/analytics/jogadores/:id/microciclo` — distribuição de carga por dia do ciclo (MD-7..MD..MD+7)
  - Classifica cada treino do atleta pelo offset ao jogo mais próximo do próprio jogador
  - Empate na distância → prefere MD- (próximo jogo)
- `GET /api/analytics/posicoes-benchmarks` — médias + p95 por posição (somente jogos)
- `GET /api/analytics/comparar?ids=1,2,3` — médias lado-a-lado para 2-4 jogadores (geral, jogos, treinos + sparkline)
  - `sessaoId=5` — filtra para uma sessão específica
  - `ultimos=3` — média dos últimos N jogos
  - Retorna também `sessoes[]` (lista de sessões disponíveis para dropdown)
  - Cada item inclui também `top.*` (p95 — "melhor da posição") para uso no radar comparativo

### Autenticação
- `POST /api/auth/login` — autentica usuário e senha (via body JSON `{ username, password }`). Tenta primeiro validar contra o banco de dados na tabela `usuarios` (apenas para contas com status `'ativo'`); se não autenticado ou em caso de falha, utiliza o fallback seguro nas variáveis de ambiente (`AUTH_USERNAME`/`AUTH_PASSWORD_HASH` no `.env`). Retorna token JWT (HS256 com validade configurável de 12 horas) e metadados básicos do usuário.
- `GET /api/auth/me` — valida o token corrente enviado via header Bearer e ecoa o payload do usuário ativo da sessão.

### Usuários (Staff Técnico)
- `GET /api/usuarios` — lista todos os profissionais técnicos do staff (sem expor o hash da senha, ordenados alfabeticamente por nome).
- `POST /api/usuarios` — adiciona um novo profissional ao staff técnico (gerando hash bcrypt com cost 12 e validando unicidade de username).
- `PUT /api/usuarios/:id` — atualiza dados cadastrais (nome, cargo, status ativo/inativo e nova senha opcional). Protege contra auto-inativação crítica do próprio usuário logado.
- `DELETE /api/usuarios/:id` — remove permanentemente o usuário do staff (com trava rígida para impedir a auto-exclusão da própria conta em uso).

### Backups
Todos sob JWT (`Authorization: Bearer`):
- `POST /api/backups` — dispara backup manual imediato; retorna o nome do arquivo gerado.
- `GET /api/backups` — lista todos os backups disponíveis em `backend/backups/` (nome, tamanho, data).
- `GET /api/backups/:filename` — faz download do arquivo `.zip` correspondente.
- `DELETE /api/backups/:filename` — remove o arquivo de backup informado.

---

## 🖼️ Páginas Frontend

### `/painel` — Painel do Time
- **Filtros por Clique nos AlertCards**: Os 4 cards analíticos principais do topo (Alto Risco, Atenção, Sub-treinado, Zona Ideal) agem como botões de filtro interativos. O clique aplica um contorno brilhante com efeito de glow neon correspondente ao status e filtra instantaneamente a lista de atletas abaixo.
- **Toggle View Switcher (Comutador)**: Seletor estilizado que alterna o modo de visualização entre:
  - **Aba Grid de Cards (Cards Premium)**: Exibe os atletas no formato "carta tática" premium com sua foto real (usando `<PlayerAvatar>` ou iniciais do jogador com fundo em degradê do clube como fallback), badge de posição correspondente em neon, data da última sessão formatada em relação ao momento atual (ex: "Sessão hoje", "Ontem" ou "Há 3 dias"), valor de ACWR em destaque colorido, barra linear gráfica de progresso de ACWR (com zona ideal entre 0.8 e 1.3 destacada) e tendência de carga (setas animadas ▲/▼/—).
  - **Aba Tabela (Tabela Tática)**: Redesenhada com paddings amplos, visual limpo e indicador linear de ACWR.
- Insights auto-gerados (texto).
- **Card de Anomalias (>2σ)**: atletas cuja última sessão fugiu da média pessoal, com chips por métrica (direção ↑/↓, % delta, z-score) — clicável para `/jogador/:id`. Exibição compacta integrada com `<PlayerAvatar>` para cada jogador em desvio.
- **Card "Sem participação recente >60d"** (Lote Gestão de Elenco): atletas ativos sem sessão há 60+ dias com botão "Marcar inativo" inline (data de saída = última sessão) — só aparece quando há candidatos.
- Todo o painel filtra automaticamente apenas atletas com `status='ativo'`.
- **Carga do Time** com **janela personalizável**:
  - Chips rápidos: 7d / 14d / 30d / 60d / 90d
  - Range customizado "De / Até" (ISO `<input type="date">`)
  - Subtítulo dinâmico: `dd/mm/yyyy → dd/mm/yyyy · N dias`
  - **Heatmap adaptativo:**
    - ≤21 dias: linha horizontal de células médias com data + valor + badge JOGO
    - >21 dias: grid semanal estilo GitHub (7 linhas dom→sáb × N semanas) com labels de mês e legenda gradient
- Lista de atletas em risco/atenção (clicável → perfil)
- Lista de atletas sub-treinados/ideal

### `/sessoes` — Arquivo de Sessões (NOVA)
- Header com totais (sessões, jogos, treinos) + botão "Nova sessão"
- Toolbar com filtros combinados:
  - **Busca textual** debounced 200ms (descrição, local, equipe, data)
  - **Tipo**: Todos / Jogo / Treino
  - **Range de datas**: De / Até
  - **Ordenação**: Data ↓/↑ · Carga ↓ · Atletas ↓
  - **Toggle de vista**: Lista / Calendário
- **Vista Lista** (default): seções colapsáveis por mês
  - Header do mês: nome + total + contagem jogos/treinos com bullets coloridos + carga média
  - Mês mais recente expandido por padrão; com filtros ativos, todos abrem
  - Grid responsivo 1→2→3→4 colunas de cards
- **Vista Calendário**: navegação ◄ Mês ► + botão "Hoje"
  - Grid 7×N com headers, badge MD nos dias de jogo, heat fill vermelho proporcional à carga média
  - Até 2 chips de descrição por célula, "+N" no overflow
  - Clique abre painel inferior com cards completos do dia
- **Cards de sessão** mostram: tile data (mês curto + dia), título (descrição/fallback), local/equipe, badge tipo, 3 stats (atletas, duração, distância em km), barra de carga colorida por intensidade, trash icon no hover

### `/sessao/:id` — Dashboard de Sessão (3 abas)

**Aba Resumo:**
- 3 donuts grandes: Volume / Geral / Intensidade (% vs benchmark MD)
  - **Setinhas ↑↓** abaixo de cada donut com delta % vs média histórica do mesmo tipo
- 6 barras com benchmark line 100% (esquerda absoluto / direita por minuto)
  - **Coluna extra com setinha ↑↓** + **marcador preto vertical** indicando a média histórica na barra
- Donut "Participação do Atleta" (Full vs N/A)
- Volume & Intensity chart por jogador, agrupado por posição — agora **consome benchmarks dinâmicos por posição** quando há ≥3 amostras
- **Scatter Volume × Intensidade**: 4 quadrantes coloridos (Sobrecarga vermelha / Curto-intenso roxa / Sub-estímulo amarela / Volume sem ritmo azul) + zona Ideal central verde, pontos coloridos pela posição com hover crosshair
- **Box Plot por Posição**: caixa Q1–Q3 + linha grossa mediana + whiskers Tukey 1.5×IQR + outliers como pontos brancos com hover (toggle entre 5 métricas)
- **Distribuição por Zona de Velocidade** (stacked bar Z1-Z6 + 6 cards)

**Aba Análise do Período:**
- Cards 2x2 (Aquecimento, 1º Tempo, 2º Tempo, Complemento)
- 2 donuts por card (Volume %, Intensidade %)
- 6 barras por card com benchmark line

**Aba Análise do Atleta:**
- Tabela com mini-barras coloridas por métrica (cores fixas)
- Filtros: busca por nome + posição + ordenação por qualquer métrica
- **Coluna "EXC/CON"** ao final (desac÷acel) com semáforo de risco neuromuscular, mesmas bandas e tooltip do JogadorPerfil — média no rodapé usa média dos ratios atleta-a-atleta
- Linhas clicáveis → `/jogador/:id`

### `/jogador/:id` — Perfil do Atleta
- Header com avatar + posição numerada colorida + apelido
- Filtros: tipo (Todos/Treino/Jogo) + período (Session/1º Tempo/etc.) + **dropdown de sessão específica** (filtra todos os widgets para um snapshot único; respeita Tipo selecionado)
- Tabela de sessões com mini-barras coloridas por métrica + **coluna "EXC/CON"** (desac÷acel, verde 0.85–1.15, âmbar 0.70–1.30, vermelho fora — indica balanço excêntrico/concêntrico e risco neuromuscular)
- **Card "Evolução por Sessão"**: 4 sparklines (Distância · m/min · HSR · Sprint), cada um com delta % vs média + média tracejada + último ponto destacado · jogos sólidos · treinos translúcidos
- **Card "Jogo × Treino"**: barras pareadas (5 métricas) + chip "Treino = X% do jogo" colorido
- **Card "Insights"**: até 4 bullets coloridos (verde/âmbar/cinza) — Match readiness · Forma recente · Pico · Acel × Desac
- **Card ACWR** com gráfico de série temporal + bandas coloridas (sub-treinado / ideal / atenção / risco)
- **Card Microciclo MD-N..MD..MD+N**: barras com janela canônica MD-4..MD+2, MD em vermelho, MD- na cor da métrica, MD+ em cyan, vazios tracejados, toggle entre 5 métricas
- **Radar Comparativo**: polígono vermelho do atleta sobre cinza tracejado da média da posição, borda externa = p95 (melhor da posição), hover por eixo com z-score relativo
- 5 Gauges no rodapé (Total Dist, HSR, Sprint, Aceleração, Desaceleração)
- Modal de edição (apelido + posição)

### `/jogadores` — Lista de Atletas (CRUD + Gestão de Elenco)
- Header com botão **"Atualizar Elenco"** (vermelho) — abre wizard de reapresentação
- **Chips de filtro** Ativos / Inativos / Todos com contagem visível
- Busca textual por nome, apelido, posição ou código CSV
- Aviso âmbar quando há atletas ativos sem posição
- Form de cadastro manual (também cria auto via upload de CSV)
- Tabela com colunas: Jogador · Posição · **Status** (badge animado) · **Período** (desde X · saiu Y) · Código CSV · Ações
- Inativos aparecem acinzentados com `line-through` no nome
- **Ações por linha**: Performance (vermelho) · Editar (outline) · **Toggle status** (seta saída ou ↻ reativar) · Remover permanente (ícone rosa)
- **Modal de edição** estendido: apelido + posição + toggle status (No elenco / Saiu do clube) + date picker auto-preenchido quando muda para inativo
- **Wizard "Atualizar Elenco para Reapresentação"**: lista todos os ativos pré-marcados — usuário desmarca quem saiu — confirma e o backend faz batch-status em uma chamada

### `/upload` — Importar CSV
- File picker
- Tipo (Treino/Jogo)
- Jogo (nome do adversário/descrição)
- Equipe (default: Paulista FC)
- Local
- **Data lida automaticamente do CSV** (linha `Date:,DD/MM/YYYY`)

### `/usuarios` — Gerenciamento do Staff Técnico (NOVA)
- Header com contagem dinâmica e botão **"Adicionar Profissional"** (indigo).
- **Cards de Estatísticas Rápidas** no topo: Total de Profissionais, Contas Ativas e Contas Inativas.
- Barra de busca textual interativa em tempo real.
- **Tabela de Profissionais**:
  - Exibe avatar de inicial, nome completo, login (`@username`), badge com cor contextual conforme a especialidade (ex: azul para Preparador Físico, indigo para Fisiologista, roxo para Treinador, etc.), status com bullet animado pulsante e a data de criação formatada.
  - Ações inline: **Editar** (abre modal) e **Remover permanente** (ícone lixeira com ConfirmModal integrado).
  - Trava inteligente: o botão de remoção e o status ficam inativos para a conta ativa do próprio profissional logado (auto-exclusão bloqueada).
- **Modal de Cadastro/Edição**:
  - Campos: Nome Completo, Nome de Usuário (desabilitado na edição), Função (dropdown de especialidades), Status da conta (Ativo/Inativo) e alteração/definição de senha com confirmação de segurança.
  - Toast notifications de feedback imediatos em todas as operações de escrita.

### `/backups` — Backups do Banco de Dados (Administração)
- Acessível pelo menu **Administração → Backups** na sidebar.
- Botão **"Criar backup agora"** — aciona `POST /api/backups`, exibe toast de sucesso com nome do arquivo gerado e atualiza a lista automaticamente.
- **Tabela de backups** com colunas: nome do arquivo, tamanho (formatado), data/hora de criação e ações.
- Ações por linha: **Baixar** (download direto do `.zip`) e **Excluir** (com `ConfirmModal` de confirmação).
- Exibe indicador de backup automático diário (03:00 America/Sao_Paulo) e política de retenção (5 mais recentes automáticos; manuais até exclusão explícita).

---

## 🎨 Convenções Visuais

### Sistema de Posições Numeradas
Definido em `frontend/src/lib/constants.ts`:

| Código | Sigla | Posição | Cor |
|--------|-------|---------|-----|
| GOL | GK | Goleiro | cinza `#64748b` |
| 1 | LAT | Lateral Direito | cyan `#0891b2` |
| 2 | LAT | Lateral Esquerdo | cyan `#0891b2` |
| 3 | ZAG | Zagueiro | vermelho `#dc2626` |
| 4 | VOL | Volante | roxo `#7c3aed` |
| 5 | MC | Meia | roxo `#7c3aed` |
| 6 | EXT | Extremo | teal `#0d9488` |
| 7 | ATA | Atacante | âmbar `#f59e0b` |

### Cores por Métrica (mini-barras inline)
```ts
M_COLOR = {
  dist:   '#0d9488', // teal — volume
  mpm:    '#1e3a5f', // navy — intensidade
  hsr:    '#f59e0b', // orange — Z4
  sprint: '#ef4444', // red — Z5
  acel:   '#0891b2', // cyan
  desac:  '#a855f7', // purple
}
```

### Cores das Zonas de Velocidade
- Z1 Parado: cinza
- Z2 Caminhada: verde
- Z3 Trote: azul
- Z4 Corrida: amarelo
- Z5 Alta Intensidade: laranja
- Z6 Sprint: vermelho

### Notação MD do Microciclo
- **MD** = Match Day (dia de jogo, sessão tipo='Jogo')
- **MD-N** = treino N dias antes do jogo (MD-1 = véspera; MD-3/-4 = pico de carga semanal)
- **MD+N** = treino N dias após o jogo (MD+1 = recuperação)
- Vocabulário obrigatório em features de microciclo — **nunca** usar "dia -3" ou "3 dias antes".

### Benchmarks
**MD fixo** (fallback global em métricas de time):
```ts
MD = {
  distanciaTotal: 10000,
  hsr: 600,
  acelDesacelTotal: 80,
  metragemPorMinuto: 95,
  hsrPorMinuto: 6,
  acelDesacelPorMinuto: 1.0,
}
```

**Benchmarks dinâmicos por posição** (`/api/analytics/posicoes-benchmarks`):
- Calculados como **média + p95** das sessões tipo='Jogo' por posição
- Frontend usa via helper `benchFor(posicao, key, map)` no `SessaoDashboard` — só aplica se houver ≥3 amostras (senão volta ao MD fixo)
- Donuts e BenchBars do Resumo continuam com `MD` fixo (são métricas de time, não de posição)

---

## 📐 Fórmula ACWR (Acute:Chronic Workload Ratio)

Implementada em `backend/src/routes/analytics.ts`.

```
Aguda(D) = Σ(Player Load nos últimos 7 dias antes de D) / 7
Crônica(D) = Σ(Player Load nos últimos 28 dias antes de D) / 28
ACWR(D) = Aguda / Crônica
```

**Zonas:**
| ACWR | Zona | Cor |
|------|------|-----|
| < 0.8 | Sub-treinado | Amarelo |
| 0.8 – 1.3 | Ideal | Verde |
| 1.3 – 1.5 | Atenção | Laranja |
| > 1.5 | Risco | Vermelho |

**Aviso:** ACWR só é confiável após ~28 dias de dados. Antes disso o componente mostra "Coletando dados base".

---

## 🔬 Detecção de Anomalias (`>2σ` da média pessoal)

Implementada em `/api/analytics/team-overview` (`anomalias[]` no response).

Para cada atleta com ≥4 sessões com participação:
1. `latest` = sessão mais recente; `baseline` = todas as outras
2. Para cada métrica em {Player Load, Distância, m/min}:
   - μ = média do baseline; σ = desvio padrão
   - z = (latest - μ) / σ
   - Se |z| > 2, registra a métrica como flagada (com direção `up`/`down` e percentual)
3. Atletas com pelo menos 1 métrica flagada entram em `anomalias[]`, ordenados pelo maior |z|

Renderizado no Painel como cards âmbar com chips ↑/↓ por métrica.

---

## 📜 Histórico de Implementação (cronológico)

### Fase 1 — Limpeza inicial
- Auditoria do código do estagiário
- Migração Tailwind v3 → v4
- Migração PostgreSQL → SQLite
- Fix do upload CSV (`parseBody({ all: true })`)
- Auto-criação de jogadores no upload

### Fase 2 — Layout base
- Sidebar com sessões dinâmicas
- ThemeProvider dark/light
- Cores do clube (vermelho #cc1e1e)
- Logo do Paulista FC

### Fase 3 — Páginas principais
- `/jogadores` (CRUD completo)
- `/jogador/:id` (JogadorPerfil)
- `/sessao/:id` (3 abas: Resumo / Períodos / Atletas)
- Heat-map de células com cores por intensidade

### Fase 4 — Estética PDF Catapult
- Header da sessão com tempo total + equipe + local
- 3 donuts grandes Volume/Geral/Intensidade
- Barras com benchmark line 100%
- Period cards com 6 métricas em 2 colunas
- Volume & Intensity chart por posição

### Fase 5 — Mini-barras coloridas
- Substituição de heat-map de fundo por `BarCell`
- Cores fixas por métrica em SessaoDashboard e JogadorPerfil

### Fase 6 — Filtros e ordenação
- Tab "Análise do Atleta" com busca + filtro de posição + sort por qualquer coluna

### Fase 7 — Posições numeradas
- Sistema unificado em `lib/constants.ts`
- Badges com formato "código - sigla" (ex: "7 - ATA")

### Fase 8 — Botões de ação refinados
- Hierarquia: primário (vermelho) / secundário (outline) / destrutivo (ícone)

### Fase 9 — Data automática do CSV
- Backend extrai data da linha `Date:,DD/MM/YYYY` do CSV
- Removido campo de data do formulário de upload

### Fase 10 — Analytics & Painel do Time
- Endpoint `/api/analytics/team-overview` com ACWR de todos os atletas
- Endpoint `/api/analytics/jogadores/:id/acwr` (série temporal)
- Endpoint `/api/analytics/posicoes-benchmarks` (média por posição)
- `AcwrChart` com bandas coloridas
- Página `/painel` com alertas, insights, heatmap calendário, listas por zona
- 6 colunas novas no schema (zonas Z1-Z5)

### Fase 11 — Lote 1: JogadorPerfil completo
- `TrendChart` (4 sparklines: Distância · m/min · HSR · Sprint) com delta % vs média e diferenciação de pontos jogo/treino
- `MatchTrainingCompare` — barras pareadas em 5 métricas com indicador "Treino = X% do jogo"
- `lib/insights.ts` — `buildInsights()` com 4 categorias auto-geradas: Match readiness, Forma recente, Pico, Balanço Acel × Desac
- Refactor: fetch de `/jogadores/:id/performance` agora sempre busca todos os tipos; filtro de tipo aplicado no frontend para que widgets de comparação tenham acesso a Jogo + Treino

### Fase 12 — Lote 2: SessaoDashboard avançado
- Backend: `/sessoes/:id/analise` agora retorna `historico` (médias do mesmo tipo, excluindo a sessão atual)
- `DeltaBadge` com setinhas ↑↓ vs histórico nos 3 donuts e nas 6 BenchBars do Resumo
- Marcador preto vertical na BenchBar mostrando posição da média histórica
- `VolumeIntensityScatter` — scatter SVG 2D com 4 quadrantes coloridos + zona ideal central
- Helper `benchFor(posicao, key, map)` — `Volume & Intensity` e `Scatter` consomem benchmarks dinâmicos por posição (fallback para `MD` quando posição tem <3 amostras)

### Fase 13 — Lote 3: Análises avançadas
- Backend: `/api/analytics/jogadores/:id/microciclo` — classifica MD±N pelo offset ao jogo mais próximo (empate prefere MD-)
- Backend: `posicoes-benchmarks` agora retorna `top.*` (p95 por posição — "melhor da posição")
- Backend: detecção de anomalias (z-score > 2 vs média pessoal) em `team-overview`
- `MicrocicloChart` — barras MD-4..MD+2 com cores por tipo de dia, toggle de métrica
- `RadarComparativo` — polígono atleta vs média posição vs p95
- `BoxPlotByPosition` — Tukey 1.5×IQR com outliers, toggle entre 5 métricas
- Cards de Anomalias no Painel com chips por métrica
- Memória `notacao_md_microciclo.md` salva (vocabulário obrigatório)

### Fase 14 — Página `/sessoes` inteligente
- Backend: `GET /api/sessoes/listagem` com stats agregados (atletas, carga média, duração, distância)
- `Sessoes.tsx` (novo): vista Lista por mês colapsável + vista Calendário com navegação ◄►
- Filtros: busca debounced, tipo, range datas, ordenação
- Cards ricos com tile-data, badges, 3 stats inline e barra de carga colorida por intensidade
- **Sidebar simplificado**: removido o lista inline de sessões, sobraram 4 nav links uniformes (Painel / Sessões / Elenco / Upload GPS)
- Removido `Outlet context={{ recarregarSessoes }}` e referências em `Upload.tsx`/`Sessoes.tsx`

### Fase 15 — Heatmap de Carga personalizável
- Backend: `/team-overview` aceita `start`/`end` ISO (compat: fallback 14d até hoje, max 366d)
- Response inclui `windowStart`, `windowEnd`, `windowDias` para confirmação
- Frontend Painel: chips 7/14/30/60/90d + range "De/Até" customizado
- `HeatmapCalendario` adaptativo:
  - ≤21 dias: layout linear com células 56×64px (visão original)
  - >21 dias: grid semanal estilo GitHub (7×N células 12×12px) com labels de mês e legenda gradient

### Fase 16 — Edição de sessões
- Backend: `PUT /api/sessoes/:id` — atualiza data, tipo, descrição, equipe e local
- `EditSessaoModal` componente reutilizável (`components/EditSessaoModal.tsx`)
  - Campos: tipo (toggle Treino/Jogo), descrição, data, equipe, local
  - Aviso explícito em banner âmbar quando o tipo muda (afeta ACWR, microciclo, benchmarks, anomalias, histórico)
- Botão "Editar" (ícone lápis) no header do `/sessao/:id` — abre modal, após salvar re-fetch dos dados
- Ícone lápis nos cards do `/sessoes` (hover) — edição rápida sem entrar na sessão

### Fase 17 — Comparação de jogadores
- Backend: `GET /api/analytics/comparar?ids=1,2,3` — médias (geral/jogos/treinos) + últimas 10 sessões
  - Suporte a `sessaoId` (sessão específica) e `ultimos` (últimos N jogos)
  - Retorna lista de sessões disponíveis para dropdown do filtro inteligente
- Frontend: página `/comparar` com:
  - Seleção de 2-4 jogadores com filtro por posição
  - Radar SVG sobreposto (5 métricas)
  - Barras comparativas por métrica (destaque verde = melhor)
  - Sparklines de evolução recente (dist, m/min, HSR, sprint)
  - Tabela ranking com 🥇 por métrica
  - **Filtro inteligente** com 3 camadas:
    - Chips rápidos: "Último Jogo" | "Últ. 3 Jogos" | "Últ. 5 Jogos" | "Todos os Jogos" | "Todas Sessões"
    - Dropdown para selecionar jogo/treino específico (ex: "05/04 — Portuguesa Santista x Paulista FC")
    - Re-fetch automático ao trocar filtro
- Sidebar: novo link "Comparar" entre Sessões e Configuração

### Fase 18 — Redesign UI/UX Premium
- Otimização visual profunda no `/painel`:
  - Cards de alerta (Risco/Ideal/etc.) transformados em componentes premium com anéis de progresso SVG animados e sombras estilizadas.
  - Header atualizado com barra de gradiente `vermelho→laranja` e "badges" compactos para estatísticas rápidas.
  - Tabela de atletas consolidada em visual profissional, com uma **mini-barra de ACWR inline** (com overlay da zona verde ideal) e tipografia forte.
- Otimização no `/sessoes` (Cards e Calendário):
  - Cartões ganharam faixas de "accent" laterais com cores contextuais (Jogo=vermelho, Alta/Media/Baixa carga = Laranja/Teal/Cyan).
  - Barra de carga contínua alterada para gradiente direcional.
  - Calendário reformulado para remover opacidades difusas vermelhas, utilizando faixas coloridas e fundo escuro que ressalta os badges textuais.
- **Paleta de Cores de Ação Moderna**: 
  - Saída do monocromático vermelho para uso semântico em botões: ações de salvar e edição utilizam forte contraste com tons **Indigo**, enquanto ações de remover/cancelar utilizam tons vibrantes **Rose**.
  - `EditSessaoModal` e `ConfirmModal` refeitos do zero para padrão SaaS: bordas ultra-arredondadas (`rounded-2xl`), overlay de fundo com desfoque de vidro (`backdrop-blur-sm`), ícones vetorizados no cabeçalho.

### Fase 19 — Polimento + Export PDF
- **Auditoria geral** identificou bugs e fricções; correções aplicadas:
  - `Comparar`: pré-fetch da lista de sessões no mount (dropdown agora populado desde a abertura, sem precisar comparar primeiro).
  - `Layout`: polling periódico (30s) do indicador "API Online" + botão "Tentar" quando offline (reconnect manual sem F5).
  - `ConfirmModal`: aceita props opcionais `details` (chip de contexto, ex: "05/04/2026 · Portuguesa Santista x Paulista FC") e `confirmLabel`.
  - `App.tsx`: rota catch-all `*` → `NotFound` page com link de volta e botão "Ir para o Painel".
- **Empty states**:
  - Painel — card de Anomalias agora aparece sempre; quando não há detecções, mostra mensagem verde explicando que a janela é ±2σ e que precisa ≥4 sessões por atleta.
- **Toast system** (`components/Toast.tsx`):
  - `ToastProvider` global no `App.tsx` + hook `useToast()` com atalhos `success`/`error`/`info`.
  - Auto-dismiss em 3.5s, posição fixed top-right, animação slide-in.
  - Integrado em `Sessoes` (remover/editar sessão) e `SessaoDashboard` (editar sessão).
- **Export PDF via Print CSS** (zero dependências):
  - `index.css` ganhou bloco `@media print` com força `print-color-adjust: exact`, oculta sidebar/dialogs/`.print-hide`, layout A4, `break-inside: avoid` em cards.
  - Botão "Imprimir" nos headers de **Painel**, **SessaoDashboard**, **JogadorPerfil** e **Comparar** chama `window.print()` → diálogo nativo "Salvar como PDF".
  - Marcações `print-hide` em filtros, toolbars e seleção de jogadores (Comparar) para PDF limpo.
  - Toasts e modals auto-ocultados via `@media print`.

### Fase 20 — Gestão de Elenco (status ativo/inativo + temporal)
**Problema**: jogadores são auto-criados pelo upload mas nunca saem. Em virada de temporada/reapresentação, o sistema acumula ex-atletas que poluem ACWR, comparativos e listagens.

**Solução**: modelo temporal explícito + filtros default + wizard de batch.
- **Schema** (`jogadores`): 3 colunas novas — `status` (default `'ativo'`), `dataChegada`, `dataSaida`.
- **Migration auto-aplicada no boot** (`db/index.ts`): `ensureColumn` idempotente + backfill `dataChegada = MIN(sessoes.data)` por atleta. Nenhuma ação manual necessária.
- **Backend**:
  - `GET /jogadores?status=ativo|inativo|todos` (default ativo).
  - `PUT /jogadores/:id` aceita `status`, `dataSaida` — auto-preenche `dataSaida` na transição ativo→inativo, zera ao reativar.
  - **`POST /jogadores/batch-status`** novo — `{ ids[], status, dataSaida? }` para o wizard.
  - `team-overview` filtra `status='ativo'` para ACWR, anomalias, listagens (histórico de sessões/métricas continua intacto).
- **Frontend `/jogadores` repaginado**:
  - Chips Ativos/Inativos/Todos com contagem.
  - Busca textual; aviso quando há ativos sem posição.
  - Coluna Status (badge animado) + Período (Desde DD/MM · Saiu DD/MM).
  - Modal de edição estende para status + date picker.
  - Toggle rápido de status (botão na linha) — sem precisar abrir modal.
- **Wizard "Atualizar Elenco para Reapresentação"**:
  - Botão no header → modal full-list dos ativos pré-marcados.
  - Visual: verde = permanece, rose com `line-through` = sai.
  - Footer mostra "X permanecem · Y sairão" em tempo real.
  - Confirma → batch-status com `dataSaida` = hoje → toast com contagem.
- **Painel — card "Sem participação recente >60d"**:
  - Calcula no frontend `diasSemSessao` por atleta usando `ultimaSessao` do `team-overview`.
  - Só aparece quando há candidatos.
  - Botão inline "Marcar inativo" (PUT direto, `dataSaida` = última sessão do atleta).
  - Após confirmar, atleta some do dashboard imediatamente (re-fetch).
- **Comportamento preservado**:
  - Métricas históricas e sessões nunca filtradas — só dashboards/listagens.
  - DELETE permanente continua disponível (com aviso "prefira marcar como inativo").
  - Upload de CSV cria atletas novos com `status='ativo'`, `dataChegada` = data da sessão importada.

### Fase 21 — EXC/CON Ratio + Filtro de Sessão no JogadorPerfil + replicação no SessaoDashboard
- Componente compartilhado **`components/RatioCell.tsx`** com helper `computeECRatio(acel, desac)` e prop opcional `ratio` direta (para footers de média).
- Nova coluna **"EXC/CON"** na tabela do **JogadorPerfil** e ao final da aba **Análise do Atleta** do `/sessao/:id` — `desac ÷ acel`, com semáforo de risco neuromuscular:
  - **0.85–1.15** verde (balanceado).
  - **0.70–0.85 ou 1.15–1.30** âmbar (atenção).
  - **<0.70 ou >1.30** vermelho (assimetria forte: ratio alto = sobrecarga excêntrica → risco de lesão muscular; ratio baixo = perfil concêntrico/explosivo).
- Linha de médias usa **média dos ratios (sessão-a-sessão no JogadorPerfil; atleta-a-atleta no SessaoDashboard)** — descarta entradas com acel=0; mais honesta que ratio das médias.
- Novo filtro **dropdown de sessão** ao lado de Tipo/Período no header:
  - Default "Todas as sessões" → comportamento original (agregado).
  - Selecionar uma sessão específica filtra `sessoesComPeriodo` para 1 linha → tabela, trend (vira ponto único), insights, jogo×treino, stats e gauges passam a refletir aquele snapshot.
  - Auto-limpa quando a sessão sai do conjunto disponível (ex: mudança de tipo/período).
  - Badge no header alterna entre "N sessões" e "Snapshot · DD/MM/YYYY" conforme o estado.
- ACWR, microciclo e radar continuam mostrando série completa (não filtram por sessão única, pois precisam de histórico).

### Fase 22 — Alinhamento de colunas com o PDF oficial (Metros/min + Vel. Máx)
- Padronização das duas tabelas principais para casar com a ordem do "Departamento de Performance" (PDF do clube): `Atleta → Posição → Distância → Metros/min → Vel. Máx (km/h) → HSD/Sprint → Acc → Dcc → Exc/Con`.
- **`/sessao/:id` — aba Análise do Atleta**: nova coluna **Vel. Máx (km/h)** entre `m/min` e `HSR Z4`.
  - Header sortable (`SortKey += 'velocidadeMaxima'`) + opção no dropdown "Ordenar".
  - Célula sem barra (vel. máx é métrica de pico — barra de proporção não agrega) — apenas número com 1 casa decimal; "—" quando atleta não participou (vel=0).
  - Footer média descarta entradas com vel=0 (mais honesto que diluir média com zeros).
  - colSpan empty state 12 → 13.
- **`/jogador/:id` — tabela de performance**: nova coluna **m/min** entre `Dist. Total` e `Vel. Máx`.
  - Calculada client-side a partir de `distanciaTotal / (duracao/60)` — endpoint não retorna `metragemPorMinuto` por período, mas tem dist+duração.
  - `BarCell` com `M_COLOR.mpm = '#1e3a5f'` (navy — mesma cor usada em SessaoDashboard, consistência visual).
  - `stats` ganha `avgMpm` e `maxMpm`.
  - colSpan empty state 12 → 13.
- **Zonas EXC/CON**: o PDF oficial do clube usa zonas diferentes (`<0.85 verde`, `>1.15 vermelho` — interpretação "demanda excêntrica"). Decisão registrada: **manter nossa interpretação de balanço simétrico** (`0.85–1.15 verde`). O clube alinha conosco, não o contrário.
- **`RatioCell`**: ícone direcional ao lado do número (`▼` ratio<0.85 concêntrico · `●` balanceado · `▲` ratio>1.15 excêntrico). Cor = severidade · ícone = direção em torno de 1.0 — torna inequívoco distinguir âmbar baixo de vermelho baixo em monitores de baixo contraste.

### Fase 23 — Login (autenticação single-user com JWT)
Primeiro módulo de acesso restrito, pra entregar o sistema pro Eduardo testar.
- **Backend**:
  - `bcryptjs` + `dotenv` + `hono/jwt`
  - `backend/.env` (gitignore) com `AUTH_USERNAME`, `AUTH_PASSWORD_HASH` (bcrypt cost 12), `AUTH_USER_NAME`, `AUTH_USER_ROLE`, `JWT_SECRET` (48 bytes hex), `JWT_EXPIRES_IN_HOURS`, `CORS_ORIGIN`.
  - `backend/.env.example` documenta como gerar hash/secret.
  - **`routes/auth.ts`**: `POST /api/auth/login` (valida + assina JWT HS256) e `GET /api/auth/me` (ecoa payload do token corrente).
  - **Middleware global** em `src/index.ts` aplica `jwt({ secret, alg: 'HS256' })` em todas as rotas `/api/*` exceto `/api/auth/login`.
  - Mensagem genérica em falha de login (não revela se o erro foi user vs senha).
  - CORS atualizado pra liberar header `Authorization` no pré-flight.
- **Frontend**:
  - **`lib/authClient.ts`**: storage do token/user em `localStorage` (`auth_token`, `auth_user`, `auth_expires_at`) + `installFetchInterceptor()` que faz patch em `window.fetch` injetando `Authorization: Bearer` em chamadas à `API_BASE` e tratando `401` (limpa storage + redireciona pra `/login?next=…`). Patch global evita refatorar as 18 chamadas espalhadas.
  - **`components/AuthProvider.tsx`**: contexto + hook `useAuth()`; reage a evento `auth-change` (logout interno) e `storage` (logout em outro tab).
  - **`components/ProtectedRoute.tsx`**: wrapper que redireciona pra `/login` preservando `?next=` quando não há sessão.
  - **`pages/Login.tsx`**: form simples com logo, botão "Mostrar/Ocultar senha", mensagem de erro inline, autofocus no username, autocomplete habilitado.
  - **`App.tsx`**: instala interceptor no boot; `AuthProvider` envolvendo as rotas; `/login` público; resto dentro de `<ProtectedRoute><Layout/></ProtectedRoute>`.
  - **`Layout.tsx`**: bloco de usuário no topo do footer da sidebar (avatar com iniciais + nome + role + botão "Sair" que limpa storage e navega pra `/login`).
- **Credenciais atuais (definidas em `.env`)**:
  - usuário: `eduardo.tavares`
  - senha: combinada com o admin (hash bcrypt no `.env`, fora do git).
  - role: "Preparador Físico".
  - JWT válido por 12h.
- **Trade-offs aceitos no MVP**:
  - localStorage em vez de HttpOnly cookie — vulnerável a XSS mas simples; trocar quando subir pra produção com domínio.
  - Single-user hardcoded — sem tabela `users`. Quando precisar de outro usuário, refatorar.
  - JWT_SECRET fixo no `.env` — em produção, usar secret manager (Render/Fly secrets, AWS SSM etc.).

### Fase 24 — Upload e Exibição de Fotos Reais dos Jogadores
- **Backend Hono**: Criação do endpoint `POST /api/jogadores/:id/foto` para upload de imagem (`foto`), realizando validação de tipo (JPEG, PNG, WEBP), tamanho máximo de 2MB, exclusão da foto anterior do disco e salvamento com nome único em `/uploads/fotos/`.
- **Serviço Estático**: Habilitação de `serveStatic({ root: './' })` para servir `/uploads/*` diretamente pelo backend Hono para o frontend React.
- **Frontend React**: Criação do componente `<PlayerAvatar.tsx>` que exibe a foto do atleta com formato circular e bordas neon estilizadas conforme o status ou iniciais em degradê moderno se não houver arquivo. Inclusão de botão e input de upload no modal de cadastro/edição em `Jogadores.tsx` (atualizando dinamicamente a foto e mostrando Toasts de feedback).

### Fase 25 — Redesenho e Modernização do Painel do Time (Cards Premium & Filtros)
- Refatoração profunda de `frontend/src/pages/Painel.tsx` com Glassmorphism avançado e HSL harmonizados.
- **AlertCards Interativos**: Adicionado estado `filtroZona` para realizar filtragem instantânea do elenco ao clicar nos cards de KPIs analíticos do topo (Alto Risco, Atenção, Sub-treinado, Zona Ideal), aplicando efeito neon glow de contorno brilhante.
- **Seletor de Visualização (Comutador)**: Adicionado comutador estilizado no topo do elenco para alternar suavemente entre Grid de Cards Premium e a Tabela Tática clássica refinada.
- **Grid de Cards Fisiológicos**: Layout premium de "carta tática" individual contendo o avatar real (`PlayerAvatar`), badge de posição, indicador de recência temporal relativo (ex: "Sessão hoje"), tendência de carga com setas animadas, e barra linear gráfica de ACWR que destaca a zona ideal (0.8 a 1.3).
- **Integração Geral de Avatares**: Aplicação do componente `<PlayerAvatar>` na listagem de anomalias (desvios de z-score) e na tabela de elenco para consolidação da identidade visual premium e eliminação de placeholders genéricos.

### Fase 26 — Gerenciamento do Staff Técnico (Múltiplos Usuários no Banco SQLite)
- **Tabela de Usuários**: Modelagem e inclusão da tabela `usuarios` no schema do Drizzle ORM (tanto para SQLite quanto Postgres).
- **CRUD Completo de Equipe**: Implementação da rota de backend `/api/usuarios` e da tela `/usuarios` no frontend, com formulário de cadastro, troca de senha, alteração de status ativo/inativo e remoção física.
- **Controles de Segurança e Robustez**:
  - Proteção contra auto-inativação e auto-exclusão no front e backend (comparando com o payload do JWT).
  - Criptografia forte de senha com bcryptjs (cost 12).
- **Login Híbrido Avançado**: Ajuste na rota `POST /api/auth/login` para buscar o profissional no banco de dados SQLite com fallback automático e seguro para a variável `.env` se necessário.
- **Sidebar Estendida**: Link "Usuários" incluído na seção "Administração" da sidebar do `Layout.tsx` (exclusivo para pessoal técnico autorizado).

### Fase 27 — Deploy em Produção (VPS Hostgator + HTTPS)
**Objetivo:** sair do `localhost` e entregar acesso público pro Eduardo testar de qualquer lugar, com domínio próprio e HTTPS.

**URL pública:** **https://apexpro.grupommp.com.br**

#### Infraestrutura contratada
- **VPS Hostgator Cloud 1 (VPS OCI NVMe 2)** — 1 vCPU · 2 GB RAM · 50 GB NVMe · São Paulo · Ubuntu 22.04.5 LTS
- **IP público:** `143.95.212.89` · **Porta SSH:** `22022` (não-padrão)
- **Custo:** R$ 334,68/ano (1º ano com 49% OFF) · renovação R$ 539,80/ano (~R$ 45/mês)
- **Domínio:** subdomínio `apexpro.grupommp.com.br` apontando via registro **A** no cPanel da Hostgator (zona DNS do `grupommp.com.br`)

#### Hardening e usuários
- **Swap 2 GB** criado em `/swapfile` (`swappiness=10`) — evita OOM no build do Vite, já que a RAM é 2 GB.
- **Usuário `apexpro`** (não-root) com `sudo NOPASSWD` — todo o app roda sob esse usuário.
- **SSH só por chave** — `PasswordAuthentication no`, `PermitRootLogin prohibit-password`. Duas chaves Ed25519 cadastradas:
  - `apexpro_vps` (no Windows de dev) — acesso administrativo.
  - `github_deploy` (na VPS, em `/home/apexpro/.ssh/`) — deploy key read-only configurada em `https://github.com/guiraldi1987/SisPerfformance/settings/keys` (sem `Allow write access`).
- **UFW firewall**: bloqueia tudo, libera apenas `22022/tcp` (SSH), `80/tcp` (HTTP) e `443/tcp` (HTTPS).
- **fail2ban**: jail `sshd` na porta 22022, ban de 1h após 5 falhas em 10 min.
- **`/etc/hosts`** ajustado pra resolver o hostname `vps-15396635.143.95.212.89` localmente (elimina os warnings `sudo: unable to resolve host`).

#### Stack instalada
- **Node.js v20.20.2** + **npm 10.8.2** (via NodeSource)
- **PM2 7.0.1** com `pm2 startup systemd` (sobe sozinho no reboot)
- **Nginx 1.18.0** (reverse proxy + static)
- **Certbot 5.6.0** (via snap, com renovação automática via `snap.certbot.renew.timer`)
- **build-essential + python3** (pra compilação nativa do `better-sqlite3`)
- **sqlite3** (CLI, usado pelo script de backup com `.backup` consistency-safe)

#### Layout no servidor
```
/home/apexpro/
├── apexpro/                              # repo clonado (branch main)
│   ├── backend/
│   │   ├── .env                          # produção (chmod 600, fora do git)
│   │   ├── ieeegp.db                     # SQLite local (vazio no boot — alimenta via upload)
│   │   ├── uploads/fotos/                # fotos dos atletas (gitignore)
│   │   └── ...
│   ├── frontend/
│   │   ├── .env.production               # VITE_API_URL=/api (relativo, mesmo host do front)
│   │   └── dist/                         # build do Vite (servido pelo Nginx como root)
│   └── backup.sh                         # script de backup chamado pelo cron
└── backups/                              # tarballs comprimidos (mantém 14 dias)
```

#### Arquitetura HTTP (Nginx + PM2)
- `/etc/nginx/sites-available/apexpro` → symlink em `sites-enabled/`. Config completa:
  - `listen 80` + `listen 443 ssl http2` (Certbot atualizou o conf automaticamente).
  - `root /home/apexpro/apexpro/frontend/dist;`
  - `location /api/` → `proxy_pass http://127.0.0.1:3001;` com `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, suporte a WebSocket upgrade e `proxy_read_timeout 300s`.
  - `location /uploads/` → mesmo proxy pro backend (que serve `serveStatic({ root: './' })` em `uploads/fotos/`).
  - `location /` → `try_files $uri $uri/ /index.html;` (SPA fallback).
  - Cache de assets (`js|css|woff2|svg|png|webp|...`) com `expires 30d; Cache-Control: public, immutable;`.
  - Gzip habilitado (`text/plain`, `text/css`, `application/json`, `application/javascript`, `application/xml`).
  - `client_max_body_size 10M` — pra acomodar CSVs maiores e uploads de fotos.
  - Redirect automático `http://` → `https://` (gerado pelo Certbot com `--redirect`).
  - O default server do Nginx (`/etc/nginx/sites-enabled/default`) foi removido pra evitar conflito de host header.

- **PM2**: `apexpro-backend` rodando `npm start` (que é `tsx src/index.ts`) em fork mode, com restart automático em crash e boot. Process list salvo em `~/.pm2/dump.pm2`.

#### Variáveis de ambiente de produção (`backend/.env`)
- `NODE_ENV=production`
- `PORT=3001`
- `AUTH_USERNAME=eduardo.tavares` (mesmo usuário do dev, hash bcrypt preservado)
- `AUTH_USER_NAME=Eduardo Luiz Tavares` · `AUTH_USER_ROLE=Preparador Físico`
- **`JWT_SECRET` regenerado em produção** (não compartilha com dev — boa prática). 48 bytes hex via `crypto.randomBytes`.
- `JWT_EXPIRES_IN_HOURS=12`
- `CORS_ORIGIN=https://apexpro.grupommp.com.br` (travado no domínio, sem mais wildcard `*`).

#### SSL/TLS
- Certificado emitido pelo **Let's Encrypt** via `certbot --nginx -d apexpro.grupommp.com.br --redirect --agree-tos --email guiraldi1987@gmail.com`.
- Vencimento inicial: **2026-08-23**. Renovação automática agendada pelo timer `snap.certbot.renew.timer` (roda 2x/dia, renova quando faltam <30 dias).
- ⚠️ Pegadinha resolvida durante o deploy: o cPanel da Hostgator criou automaticamente um registro A duplicado de `apexpro.grupommp.com.br` apontando pro IP do servidor compartilhado (`192.185.223.220`). Tivemos que **deletar manualmente** esse registro no "Modify The Zones" — caso contrário o DNS retornava 2 IPs e o Let's Encrypt podia falhar o challenge.

#### Backup diário (`~/apexpro/backup.sh`)
- **Cron de produção**: `0 3 * * * /home/apexpro/apexpro/backup.sh >> /home/apexpro/backups/backup.log 2>&1` (diário às 3h da manhã do horário do servidor).
- Estratégia:
  1. `sqlite3 ieeegp.db ".backup ..."` — snapshot consistente mesmo com WAL ativo (não trava o app).
  2. `tar -czf` empacota o snapshot + a pasta `uploads/` num único arquivo `apexpro-YYYYMMDD-HHMMSS.tar.gz` em `~/backups/`.
  3. Mantém os **14 backups mais recentes**, apaga o resto via `ls -1t | tail -n +15 | xargs -r rm`.
- ⚠️ **Limite atual**: backups ficam **na própria VPS**. Se o disco corromper, perdeu tudo. Pra produção séria, espelhar pra S3/Backblaze/scp off-site.

#### Repositório no GitHub
- **Repo privado**: `https://github.com/guiraldi1987/SisPerfformance` (nota: nome com 2 "f" — histórico de typo, não vale a pena renomear).
- O initial commit existia mas tinha só a Fase 1; todo o trabalho das Fases 2–26 foi consolidado num único commit `feat: fases 2-26 - sistema completo...` (49 arquivos, +11220 linhas) e empurrado pra `main`.
- `.gitignore` reforçado pra excluir: `backend/*.db*`, `backend/uploads/`, `.env*`, `chat_*_exportado.txt`, `exportar_chat.js`, `.claude/settings.local.json`.
- Os arquivos `backend/ieeegp.db*` que estavam no índice do git original foram removidos com `git rm --cached` (não afeta o local; só para de ser versionado).

#### Comandos úteis do dia a dia

**Conectar via SSH (do Windows):**
```bash
ssh -i ~/.ssh/apexpro_vps -p 22022 apexpro@143.95.212.89
```

**Deploy de novas versões (após `git push origin main` da máquina local):**
```bash
cd ~/apexpro && git pull
cd backend && npm install && npm run db:push
cd ../frontend && npm install && npm run build
pm2 restart apexpro-backend
```

**Logs do backend ao vivo:**
```bash
pm2 logs apexpro-backend --lines 50
```

**Monitor de recursos (CPU/RAM/restart count):**
```bash
pm2 monit
```

**Forçar backup manual:**
```bash
~/apexpro/backup.sh && ls -lh ~/backups/
```

**Restaurar de um backup:**
```bash
pm2 stop apexpro-backend
tar -xzf ~/backups/apexpro-YYYYMMDD-HHMMSS.tar.gz -C /tmp/
cp /tmp/ieeegp-*.db ~/apexpro/backend/ieeegp.db
cp -r /tmp/uploads ~/apexpro/backend/
pm2 start apexpro-backend
```

### Fase 28 — Correções de Print/Export PDF
Após o deploy em produção, ao testar o `window.print()` da página `/comparar`, três bugs do CSS de impressão foram descobertos e corrigidos:

1. **Conteúdo cortado a 1 página** — o `<main>` em `Layout.tsx` tem `overflow-y-auto max-h-screen` (essencial para o scroll interno na navegação), e isso **clipava** tudo que passasse da viewport ao imprimir, gerando 1 página só com o resto sumindo. **Fix:** no `@media print`, override de `main`, `html`, `body`, `#root`, `[class*="min-h-screen"]` para `overflow: visible !important; max-height: none !important; height: auto !important;`. **Esse fix afeta todas as 4 páginas com botão Imprimir** (Painel, Sessão, Jogador, Comparar), não só Comparar.
2. **Páginas em branco** — `break-inside: avoid` em `.rounded-xl/.rounded-2xl` empurrava o card do Radar (~430px) inteiro para a 2ª página quando o card anterior ocupava muito da 1ª, deixando boa parte da 1ª em branco. **Fix:** bloco geral no `@media print` que compacta paddings (`p-6 → 10px`, `px-8 → 16px`, etc.), gaps (`gap-6 → 10px`), espaçamento vertical (`space-y-6 → 8px`), tipografia do header e força o grid `lg:grid-cols-5` (Radar 2 + Métricas 3) a continuar lado a lado mesmo em print.
3. **Card "Métricas Detalhadas" cortado** — com 7 métricas e 2-4 jogadores, o card ultrapassava a altura útil da página A4 landscape. **Fix:** classe `print-compact-metrics` aplicada ao card específico, que comprime altura das barras (`h-5 → 10px`), espaçamentos internos (`space-y-4 → 4px`, `space-y-1 → 1px`) e fonte das labels/valores. Resultado: as 7 métricas cabem confortavelmente ao lado do radar na mesma página.

**Bônus:** SVGs grandes ganharam `max-height: 280px` em print (evita radar/scatter explodir), e sparklines dentro de células de tabela ganharam `max-height: 36px` (mantêm o tamanho compacto que faz sentido em relatório).

Todas as alterações ficaram concentradas em `frontend/src/index.css` (bloco `@media print`) e numa única classe no JSX de `Comparar.tsx` — sem mudança de comportamento em modo tela.

### Fase 29 — Backup do banco de dados

Feature de backup acessível pelo menu Administração → Backups.

- **O que faz:** gera um `.zip` com snapshot consistente do `ieeegp.db` (via `better-sqlite3.backup()`) + a pasta `uploads/` (fotos dos atletas), salvo em `backend/backups/` na VPS.
- **Disparo:** botão "Criar backup agora" (manual) + automático diário às 03:00 America/Sao_Paulo (`node-cron`).
- **Retenção:** mantém os 5 backups automáticos mais recentes; manuais ficam até exclusão.
- **Endpoints** (sob JWT): `POST /api/backups`, `GET /api/backups`, `GET /api/backups/:filename` (download), `DELETE /api/backups/:filename`.
- **Arquivos:** `backend/src/services/backup.ts`, `backend/src/routes/backups.ts`, `backend/src/db/index.ts` (`snapshotDatabase`), `frontend/src/pages/Backups.tsx`.
- **Deps novas:** `archiver`, `node-cron`.
- **Deploy:** após `git pull` na VPS, rodar `npm install` no backend (deps novas) antes do `pm2 restart apexpro-backend`. A pasta `backend/backups/` é criada no boot e está no `.gitignore`.

#### Trade-offs aceitos no MVP de produção
- **SQLite em vez de Postgres** — basta pro volume atual (5 users, 6 sessões/semana, DB ~200kb). Migrar quando passar de ~50 GB ou >20 conexões simultâneas.
- **Backup só local na VPS** — aceitável pra MVP; precisa virar off-site quando virar SaaS pago.
- **JWT em localStorage** — herdado do dev (Fase 23); vulnerável a XSS. Trocar por HttpOnly cookie quando subir tier de segurança.
- **Single-tier deploy** — frontend + backend + DB no mesmo VPS. Pra escalar horizontalmente, separar: VPS pequeno pro backend, S3/Cloudflare Pages pro frontend, Postgres gerenciado.
- **Sem CI/CD** — deploy é `git pull && build && pm2 restart` manual via SSH. Quando a frequência de deploy aumentar, configurar GitHub Actions com SSH deploy.

### Fase 30 — UX Onda 1: Fundações (Design System)

Primeira onda de um programa de 5 ondas documentado em `docs/superpowers/specs/2026-06-17-ux-frontend-program-design.md`. Escopo desta onda: estabelecer tokens de superfície, paleta de métricas canônica, componentes compartilhados e varredura completa de fundos hard-coded. Frontend-only — nenhuma mudança no backend.

#### Tokens de superfície (`frontend/src/index.css` — bloco `@theme`)
- CSS vars `--surface-base`, `--surface-card`, `--surface-elevated`, `--surface-input` que invertem automaticamente sob `.dark`.
- Expostos como classes utilitárias Tailwind: `.bg-surface`, `.bg-card`, `.bg-elevated`, `.bg-input`.
- CSS vars de paleta de métricas `--metric-dist`, `--metric-mpm`, `--metric-hsr`, `--metric-sprint`, `--metric-acel`, `--metric-desac` (reservadas para uso futuro em SVG inline).

#### Paleta de métricas canônica (`frontend/src/lib/constants.ts`)
- `M_COLOR` (11 chaves) de-duplicada e centralizada: anteriormente duplicada no `JogadorPerfil`, agora fonte única em `constants.ts`.
- Valores reais preservados — sem alteração visual.

#### Componentes compartilhados (`frontend/src/components/ui/`)
Quatro componentes novos do design system:
- **`Button.tsx`** — variantes `primary` / `ghost` / `danger`; foco visível acessível; tamanhos `sm` / `md` / `lg`.
- **`PageHeader.tsx`** — faixa de acento lateral colorida + eyebrow (subtítulo) + título principal. Adotado em `Backups.tsx`.
- **`LoadingState.tsx`** — skeleton animado em grade; substitui spinners ad-hoc e estados de carregamento inconsistentes. Adotado em `Painel.tsx`.
- **`EmptyState.tsx`** — estado vazio padronizado com ícone, título e descrição.

#### Varredura de tokens — fundos hex substituídos pelas utilities
14 arquivos tiveram fundos hex ad-hoc (`#050608`, `#08090c`, `#0a0a0a`, `#0d1117`, `#11161d`, `#07080a`, `#111111`) substituídos pelas utilities `bg-surface` / `bg-card` / `bg-elevated` / `bg-input`:

- **Páginas:** `Layout.tsx`, `Login.tsx`, `NotFound.tsx`, `Comparar.tsx`, `JogadorPerfil.tsx`, `Sessoes.tsx`, `SessaoDashboard.tsx`, `Jogadores.tsx`, `Painel.tsx`, `Upload.tsx`, `Usuarios.tsx`
- **Componentes:** `ConfirmModal.tsx`, `EditSessaoModal.tsx`, `PlayerAvatar.tsx`
- Variantes glass / translúcidas preservadas onde existiam.
- Emojis dos insights do `Painel.tsx` substituídos por SVGs inline (sem dependência externa).

#### Deferido para Ondas 2–4
Por decisão de escopo, as seguintes tarefas ficam para as próximas ondas:
- Consolidação de raio/borda (borderRadius tokens).
- Aplicação completa das regras de tipografia (escala de type).

#### Deploy
Frontend-only: apenas rebuild do frontend na VPS (`npm run build` em `frontend/`). Nenhuma mudança de schema, endpoints ou dependências do backend.

### Fase 31 — UX Onda 2: Estados & Segurança

Segunda onda do programa de 5 ondas (`docs/superpowers/specs/2026-06-17-ux-frontend-program-design.md`). Escopo desta onda: acessibilidade de foco no modal de confirmação, proteção de ações destrutivas, skeletons nas páginas restantes, estados vazios com CTA e validação de arquivo no Upload. Frontend-only — nenhuma mudança no backend, nenhuma dependência nova.

#### ConfirmModal acessível (`frontend/src/components/ConfirmModal.tsx`)
- Foco inicial no botão "Cancelar" ao abrir o modal.
- `Escape` cancela e fecha (sem alteração da API pública do componente).
- Focus trap entre os dois botões (Tab / Shift+Tab não escapa do modal enquanto aberto).
- Foco restaurado ao elemento que disparou a abertura ao fechar.

#### Confirmação ao inativar atleta (`frontend/src/pages/Painel.tsx`)
- A ação "Inativar Atleta" agora passa pelo `ConfirmModal` antes de ser executada.
- Antes desta onda a ação era disparada diretamente, sem nenhuma confirmação — risco de perda de dados acidental.

#### Skeletons de carregamento (`<LoadingState>`)
- `JogadorPerfil.tsx` e `SessaoDashboard.tsx` — as duas páginas com loading de tela cheia que ainda usavam estado de carregamento ad-hoc — adotaram o componente `LoadingState` criado na Onda 1.
- Cobertura de skeleton agora completa nas páginas com fetch de dados.

#### Estados vazios com CTA (`<EmptyState>`)
- `Backups.tsx` — exibe `EmptyState` quando a lista de backups está vazia.
- `Comparar.tsx` — exibe `EmptyState` quando menos de 2 jogadores estão selecionados para comparação.

#### Validação + feedback no Upload (`frontend/src/pages/Upload.tsx`)
- Valida extensão do arquivo (apenas `.csv`) e tamanho (máx. 15 MB) com erro inline descritivo.
- Botão "Enviar" fica desabilitado até que um arquivo válido seja selecionado.
- Durante o envio: spinner + texto "Processando…" no botão; botão desabilitado para evitar duplo-submit.

#### Deferido para Onda 4 — Acessibilidade
- Drag-and-drop na área de upload.
- `role="alert"` no erro de validação do Upload (anúncio a leitores de tela).

#### Deploy
Frontend-only: apenas rebuild do frontend na VPS (`npm run build` em `frontend/`). Nenhuma mudança de schema, endpoints ou dependências do backend.

### Fase 32 — Dark Premium: Vidro & Profundidade

Refresh visual do tema escuro em três incrementos, todos concentrados em `frontend/src/index.css` e em cinco páginas/componentes. Nenhuma mudança no backend, no `@media print` ou no tema claro.

#### Tokens translúcidos + halo radial de fundo (`frontend/src/index.css`)
- Substituição dos valores opacos das CSS vars de superfície no escopo `.dark` por camadas translúcidas RGBA: `--surface-card: rgba(255,255,255,0.045)`, `--surface-elevated: rgba(255,255,255,0.07)`, `--surface-input: rgba(255,255,255,0.04)`; base `#080b10`.
- Halo radial de profundidade adicionado ao `.dark body` e ao `.dark .bg-surface` via `background-image: radial-gradient(...)` — cria a sensação de vinheta central que ancora a hierarquia visual.

#### Sheen de topo + sombra de elevação (`frontend/src/index.css`)
- `.dark .bg-card` e `.dark .bg-elevated` receberam `background-image` com gradiente linear sutil (sheen de luz no topo) que simula reflexo em superfície de vidro.
- `box-shadow` de elevação adicionado aos mesmos utilitários: sombra escura difusa com highlight interno claro, separando visualmente camadas empilhadas.

#### Limpeza de hex ad-hoc — escala translúcida (5 arquivos)
Cinco arquivos ainda usavam cores hexadecimais escuras hard-coded que conflitavam com os novos tokens; substituídas pelas utilities ou variáveis semânticas:

- **`frontend/src/index.css`** — classes `.glass-panel` e `.glass-panel-hover` trocadas para `rgba` da escala translúcida.
- **`frontend/src/pages/Sessoes.tsx`** — fundos de calendário/card substituídos.
- **`frontend/src/components/Layout.tsx`** — sidebar e fundo do shell substituídos.
- **`frontend/src/pages/Painel.tsx`** — fundos de seção e cards substituídos.
- **`frontend/src/pages/SessaoDashboard.tsx`** — header sticky preservou blur em `#080b10` (overlay de scroll); demais fundos substituídos.

#### Escopo e restrições
- **Dark-only:** todas as alterações são restritas aos seletores `.dark …`. O tema claro ficou intacto.
- **`@media print` (nesta fase):** não foi tocado. ⚠️ Verificação posterior (Fase 33) revelou que o relatório **saía com fundo escuro** ao imprimir do modo escuro — bug pré-existente desde a Onda 1, **corrigido na Fase 33**.
- **Sem libs externas, sem mudança de schema ou endpoint.**

#### Deploy
Frontend-only: rebuild do frontend na VPS (`npm run build` em `frontend/`). Nenhuma dep nova.

---

### Fase 33 — Correção: impressão saía com fundo escuro

Verificação visual headless (Chrome + PDF real) da Fase 32 revelou que **relatórios impressos a partir do modo escuro saíam com fundo escuro** — `Ctrl+P → Salvar PDF` em `/sessao/:id` gerava página preta com texto claro, contrariando o objetivo do bloco `@media print` (`body { background: #fff }`). Bug **pré-existente desde a Onda 1** (não introduzido pela Fase 32): o wrapper de página usa `.bg-surface`, escuro no `.dark`, e com `* { print-color-adjust: exact }` o fundo escuro era forçado pra impressão — mas o bloco print só resetava `html/body`, não as utilities de superfície nem o `header` sticky.

Correção (`frontend/src/index.css`, dentro de `@media print`):
- `.bg-surface/.bg-card/.bg-elevated/.bg-input`, `.glass-panel(-hover)`, `.stripe-bg`, `header` e `.sticky` → `background: #fff`, `background-image: none`, `backdrop-filter: none` (e `.sticky` vira `position: static`).
- Famílias de texto neutras (`text-slate/gray/zinc/neutral-*`) → `#1e293b` para legibilidade no papel (o quase-branco do dark ficaria invisível). Cores semânticas (vermelho do clube, métricas, donuts) e `text-white` sobre cor preservados.

Resultado: impressão idêntica e limpa (fundo branco, texto escuro, cores semânticas intactas) tanto do modo escuro quanto do claro. Validado via PDF real (`page.pdf`, `printBackground` on/off — saídas idênticas).

#### Deploy
Frontend-only: rebuild do frontend na VPS. Nenhuma dep nova.

---

### Fase 34 — UX Onda 4 (Acessibilidade WCAG 2.1 AA) + Onda 5 (Clareza de domínio)

Penúltima e última ondas do programa de UX (`docs/superpowers/specs/2026-06-17-ux-frontend-program-design.md`; a Onda 3 — Mobile — foi pulada por ora). Plano: `docs/superpowers/plans/2026-06-22-ux-onda4-5-acessibilidade-clareza.md`. Execução subagent-driven (implementer + review por task) + varredura **axe-core headless** (Chrome via puppeteer) como gate objetivo. Frontend-only.

**Onda 4 — Acessibilidade:**
- **Regiões `aria-live`:** novo `components/RouteAnnouncer.tsx` (anuncia título da página ao navegar), `aria-live` movido pro container estático dos toasts, `role="alert"` no erro de login.
- **Formulários:** `htmlFor`/`id` nos 5 campos do Upload; toggle de senha do Login agora focável (`tabIndex` removido) com `aria-label`/`aria-pressed`.
- **Ícones e landmarks:** `aria-hidden` nos ícones decorativos da sidebar/logout; `aria-label` em `<aside>` e nos dois `<nav>`.
- **Charts:** `role="img"`+`aria-label` nos 8 gráficos (Gauge/Acwr/Trend/Radar/BoxPlot/Scatter via `<svg>`; MatchTrainingCompare via `<div>`). MicrocicloChart, por ter `<button>` interno de métrica, usa `role="group"` (não `role="img"`, que proíbe filhos interativos).
- **Ações por linha:** `aria-label` único por sessão nos botões Editar/Excluir + foco visível (`focus-within`/`focus-visible`).
- **Controles de filtro (axe):** `aria-label` nos `<select>` e `<input type=date>` sem rótulo (Sessões, Comparar, JogadorPerfil, SessaoDashboard, Jogadores, Usuarios).
- **Tabelas roláveis (axe):** `tabIndex={0}` + `aria-label` nos contêineres `.overflow-x-auto` de tabelas largas (foco de teclado p/ rolar).
- **Contraste:** texto cinza-claro informativo escurecido no claro (`text-slate-400`→`text-slate-500`, **só no claro**, `dark:` preservado) — reduziu violações sérias de contraste (Painel light 317→108, SessaoDashboard 47→19).
- **Movimento:** `prefers-reduced-motion` estendido (iteration-count + scroll-behavior).

**Onda 5 — Clareza:** tooltips (`title=`) explicando **ACWR** (cabeçalho da tabela) e **z-score** (chip de anomalia) no Painel; legenda do heatmap passou a comunicar a unidade ("Player Load médio/dia").

**Verificação (axe-core headless, dark+light):** zerados os **críticos** (`select-name`, `label`) e o sério de tabelas (`scrollable-region-focusable`). Build verde; impressão (`Ctrl+P`) revalidada (branca, sem regressão); paridade dark/light conferida por screenshot.

**Residuais conhecidos (precisam de decisão de design/estrutura — NÃO bloqueiam):**
- **Contraste de texto de cor semântica** (ex.: `text-emerald-500` de status, badges de anomalia branco-sobre-âmbar): ~108 nós (Painel claro) / ~19 (SessaoDashboard claro) / 5 badges (Painel escuro). Atingir AA exige escurecer a paleta semântica (verde/âmbar) — decisão de marca.
- **`nested-interactive`** no card de Sessões (botões Editar/Excluir aninhados num card que é `<button>`): pré-existente, exige reestruturar o card.
- **Landmarks** (`landmark-no-duplicate-main`/`-unique`/`-is-top-level`, `region`, `heading-order`): moderados; estruturação de `<main>`/regiões por página.

#### Deploy
Frontend-only: rebuild do frontend na VPS. Nenhuma dep nova.

---

### Fase 35 — Residuais de Acessibilidade (card, landmarks, heading-order, badges, contraste parcial)

Ataque aos residuais da Fase 34. Spec: `docs/superpowers/specs/2026-06-23-ux-residuais-acessibilidade-design.md`; plano: `docs/superpowers/plans/2026-06-23-ux-residuais-acessibilidade.md`. Gate por axe-core headless. Frontend-only.

**Zerados (axe = 0 para essas regras, claro+escuro):**
- **`nested-interactive` (card de Sessões):** o card era `<button>` aninhando os `<button>` Editar/Excluir. Vira `<div>` não-interativo com um `<button>` "esticado" (`absolute inset-0`) **irmão** dos botões de ação (padrão stretched-link) — sem aninhamento, navegável por teclado. (Atenção: `role="button"` tem a mesma restrição de `<button>`; não resolve — tem que ser `<div>` + link esticado.)
- **Landmarks:** havia `<main>` duplicado (Layout + um por página). Agora o Layout provê o **único** `<main>`; as 6 páginas internas usam `<div>`; o Login (fora do Layout) ganhou seu próprio `<main>`. Resolve `landmark-no-duplicate-main`/`-unique`/`-is-top-level`/`region`/`landmark-one-main`.
- **`heading-order`:** níveis sequenciais (h1→h2→h3) em Painel/Sessões; `EmptyState` (compartilhado) passou a `h2` (seguro p/ Comparar, que já tem h1+h2).
- **Badges de posição** (texto branco sobre cor de posição clara): novo helper `ensureContrastBg(hex)` em `constants.ts` escurece **só o fundo do badge** até branco bater 4.5:1 — cores de posição em gráficos/legendas ficam vivas.

**Parcial — contraste de cor semântica no texto:**
- `ensureContrastBg` reaproveitado para escurecer cores semânticas usadas como **texto pequeno** (labels de zona via `info.color` inline) até AA; classes `text-{cor}-500` → `-700` só no claro (gráficos/fills via `bg-`/`stroke-`/inline-style ficam vivos). Reduziu bastante (Painel 103→~53; Comparar/Upload/Usuários/Backups zerados).
- **Residual conhecido (NÃO bloqueia):** ~120 nós de texto colorido pequeno inline nas páginas com muitos gráficos (JogadorPerfil/SessaoDashboard/Jogadores + resto do Painel). É um long tail de sites inline distintos; o caminho limpo é um refactor de tokens (variantes de texto escuras separadas das cores de gráfico). Medição axe entre scan single-page e full-sweep diverge — convergir exige cuidado. Tratar em esforço dedicado.

**Verificado:** build verde; impressão (`Ctrl+P`) sem regressão (PDF real); paridade dark/light por screenshot (o Dark Premium e o visual claro intactos).

#### Deploy
Frontend-only: rebuild do frontend na VPS. Nenhuma dep nova.

---

### Fase 36 — Fix: popup de `<select>` nativo ilegível no tema escuro

**Bug:** ao abrir o dropdown "Selecionar jogo/sessão" em `/comparar` (modo escuro), o popup nativo abria com fundo **branco** e texto cinza-claro — datas quase invisíveis.

**Causa:** o dark mode é por classe (`.dark`), mas nenhum `color-scheme` era declarado fora do `@media print`. Sem isso, o Chrome/Windows renderiza o popup nativo do `<select>` no esquema claro do SO enquanto o texto herda a cor clara do trigger (`text-slate-200`) → claro-sobre-branco.

**Fix (global, `index.css`/`@layer base`):** `:root { color-scheme: light }` + `.dark { color-scheme: dark }` (controles nativos seguem o tema), reforçado com cores explícitas em `.dark select option`/`optgroup` (à prova de navegadores que ignoram `color-scheme` no popup). Conserta **todos** os `<select>` nativos do app de uma vez (jogo, posição, etc.), não só o do Comparar. Print continua forçando `color-scheme: light` (regra `!important` no `@media print`, intacta). Frontend-only, sem deps.

#### Deploy
Frontend-only: rebuild do frontend na VPS. Nenhuma dep nova.

---

### Fase 37 — Dropdown custom (`Select`) com fidelidade total ao tema

Sequência da Fase 36: o `color-scheme` deixou o popup nativo legível, mas o `<select>` nativo tem limites intransponíveis — cor de fundo sólida única (não pega o gradiente dos cards) e **barra de seleção azul do SO** (Windows), que destoa do vermelho-clube. Para os 2 selects do `/comparar` (posição e sessão), o usuário pediu fidelidade total.

**Componente novo:** `frontend/src/components/ui/Select.tsx` — dropdown não-nativo, reutilizável, padrão **WAI-ARIA listbox**:
- `role="combobox"` no gatilho (`aria-haspopup/expanded/controls/activedescendant`) + `role="listbox"`/`option` no popup, `aria-selected` no item atual.
- Teclado completo: ↑/↓, Home/End, Enter/Espaço, Escape, Tab, **type-ahead**; fecha por clique-fora.
- Visual 100% do tema: gatilho idêntico ao antigo (`bg-input`, borda, chevron), popup com fundo `#141b26`+sheen no dark / branco no light, **item selecionado em vermelho-clube + check**, cabeçalho de grupo "Treinos" mutado. Sem barra azul do Windows.
- Popup vai num **portal** (`createPortal` no `body`) com posição `fixed` calculada do gatilho + flip pra cima — necessário porque o `<main>` é `overflow-y-auto` (contexto de clipping); um popup `absolute` seria cortado. Reposiciona em scroll (capture) e resize.

**API:** `value`/`onChange(value)`/`options: {value,label,group?}[]`/`ariaLabel`/`className`. Os outros `<select>` nativos do app (Upload, Usuários, EditSessaoModal) seguem nativos — continuam legíveis pela Fase 36; podem migrar pro `Select` depois se quiser consistência total.

**Verificado:** build verde + `tsc` limpo; smoke-test real headless (puppeteer-core + Chrome do sistema, preview isolado) com captura **dark+light** — fidelidade confirmada, grupo/seleção/placeholder corretos, e checagem programática de `aria-expanded`/`aria-selected`/`aria-activedescendant` + `clippedBelow:false` (sem clipping).

#### Deploy
Frontend-only: rebuild do frontend na VPS. Nenhuma dep nova.

---

## ✅ Status — Tudo do roadmap original implementado

Todos os Lotes 1, 2 e 3 do plano original foram concluídos:

- **Lote 1 — JogadorPerfil completo**
  - [x] Trend line multi-métrica (4 sparklines)
  - [x] Match vs Training load (barras pareadas)
  - [x] Smart insights textuais (4 categorias)

- **Lote 2 — SessaoDashboard avançado**
  - [x] Comparativo sessão vs histórico (setinhas ↑↓)
  - [x] Scatter Volume × Intensidade
  - [x] Consumir benchmarks dinâmicos por posição

- **Lote 3 — Análises avançadas**
  - [x] Microciclo MD- no perfil do jogador
  - [x] Radar comparativo
  - [x] Box plot por posição
  - [x] Detecção de anomalias (>2σ)

### Bônus extras já entregues
- Página `/sessoes` com vista lista + calendário e filtros completos
- Heatmap de carga com janela personalizável (chips + range customizado, layout adaptativo)
- Edição de sessões (2 pontos de acesso: card list + header dashboard, aviso de impacto ao mudar tipo)
- Comparação lado a lado de jogadores (radar + barras + sparklines + ranking)
- Export PDF via Print CSS em todas as 4 páginas-chave (Painel, Sessão, Jogador, Comparar) — zero deps, fidelidade total à UI
- Toast system global + página 404 + reconnect API
- **Gestão de elenco com status ativo/inativo, datas de chegada/saída, wizard de reapresentação e sugestões automáticas de inatividade**

### Infraestrutura entregue
- ✅ Sistema **em produção** com domínio próprio, HTTPS, backup diário automatizado e PM2 garantindo uptime — pronto para o Eduardo testar de qualquer lugar.

### Bônus que ainda precisariam dados extras
- **Heatmap posicional** — precisaria coordenadas GPS por segundo (Catapult não exporta no CSV)
- **Wellness/RPE × carga** — precisaria input subjetivo dos jogadores (formulário separado)
- **Match readiness score composto** (ACWR + dias desde última pesada + RPE)

---

## 🚀 Como Rodar

### Ambientes
- **Desenvolvimento (local)**: `http://localhost:5173/` (Vite) + `http://localhost:3001/api` (Hono)
- **Produção (Hostgator VPS)**: **https://apexpro.grupommp.com.br** (Nginx + PM2 + Let's Encrypt) — ver Fase 27 para detalhes completos da infra

### Pré-requisitos
- Node 20+
- Python (apenas para gerar imagens dos PDFs de referência — opcional)

### Setup inicial (primeira vez)
```bash
# Backend
cd backend
npm install
npm run db:push    # cria/atualiza schema SQLite
npm run dev        # roda em :3001

# Frontend (outro terminal)
cd frontend
npm install
npm run dev        # roda em :5173
```

### Após mudanças no schema
```bash
# Pare o backend (Ctrl+C)
cd backend
del ieeegp.db ieeegp.db-wal ieeegp.db-shm  # opcional, se quiser limpar
npm run db:push
npm run dev
```

### Após `git clone` em outra máquina
```bash
cd "IEEEGP - Cel Eduardo"
cd backend && npm install && npm run db:push && npm run dev &
cd ../frontend && npm install && npm run dev
```

> ⚠️ O arquivo `backend/ieeegp.db` é local e contém os dados. Se mudou de máquina, faça upload dos CSVs novamente OU copie o arquivo `.db` da máquina anterior.

---

## 🧪 Testando o Sistema

1. Acessar `http://localhost:5173/` em dev ou `https://apexpro.grupommp.com.br` em produção
2. **Upload**: importar CSV no `/upload` (data lida automaticamente do CSV)
3. **Painel**: ver `/painel` — anomalias aparecem se houver atletas com desvio >2σ; heatmap pode ser ajustado nos chips ou range
4. **Sessões**: ver `/sessoes` — alternar Lista/Calendário, filtrar por tipo, buscar por adversário
5. **Sessão**: clicar em qualquer card → 3 abas (Resumo com setinhas + scatter + box plot, Períodos, Atletas)
6. **Jogador**: clicar em uma linha da aba "Atletas" → trend, jogo×treino, insights, ACWR, microciclo, radar, gauges
7. **Editar posição**: `/jogadores` → clicar em "Editar" e selecionar posição numerada (ex: "7 - Atacante")

---

## 📂 Arquivos de Referência (no projeto)

- `Relatório de GP por posição II.pdf` — referência da tabela do JogadorPerfil
- `XV de Jaú x Paulista.pdf` — referência das 4 páginas do dashboard de sessão
- `pdf_pages/page_1.png` a `page_4.png` — screenshots renderizados

---

## 🔁 Continuação em Outra Máquina

**Para retomar a conversa com o Claude Code:**

1. Clone/copie o projeto para a outra máquina
2. Rode `npm install` em ambos `backend/` e `frontend/`
3. Abra o Claude Code no diretório do projeto
4. Diga ao Claude: *"Leia o HANDOVER.md para entender onde paramos"*

**Sobre exportar este chat:**
O chat completo do Claude Code não é exportável programaticamente, mas o histórico é armazenado em:
`~/.claude/projects/c--Users-DELL-Desktop-IEEEGP---Cel-Eduardo/`
Esse diretório contém os arquivos `.jsonl` da conversa e a memória do projeto (`memory/MEMORY.md` + arquivos de tipos `feedback`/`project`/`reference`). Em outra máquina, o Claude Code começa fresh — por isso este HANDOVER.md é a forma mais confiável de transferir contexto.

> 📌 **Convenção de manutenção**: toda alteração não-trivial (rota nova, página nova, refactor estrutural) deve ser refletida neste HANDOVER.md ao final do trabalho — atualizar Estrutura, Endpoints, Páginas, Histórico (nova "Fase N") e a data no rodapé.

---

## 📝 Decisões de Design Importantes

- **CSV Catapult** é a fonte primária — o sistema é construído em volta dele
- **Player Load** é a métrica de carga preferida para ACWR (vs distância simples)
- **Período "Session"** representa o total da sessão; outros períodos são subdivisões
- **Posições numeradas** seguem padrão tático brasileiro mas são **opcionais** (jogadores criados via upload começam sem posição)
- **Benchmark MD fixo** (10000m, 600m HSR…) é fallback global; sempre que possível, frontend usa **benchmarks dinâmicos por posição** (média ou p95) calculados das sessões tipo='Jogo'
- **Histórico de comparação no Resumo** usa apenas sessões do **mesmo tipo** da atual (Treino vs Treino, Jogo vs Jogo) — evita comparar maçãs com laranjas
- **Microciclo MD±N** é classificado pelo jogo mais próximo do **próprio atleta** (empate → MD-) — focado em preparação, não em recuperação genérica
- **Radar do jogador** usa apenas Jogos do atleta como base (casa com `posicoes-benchmarks` que também é só de jogos)
- **Anomalias** exigem ≥4 sessões (3 de baseline + 1 atual) para que μ/σ tenham sentido estatístico

---

**Última atualização:** sessão de chat de 2026-06-24 — Deploy em produção na VPS Hostgator Cloud 1 (Ubuntu 22.04, IP 143.95.212.89) com hardening completo (UFW, fail2ban, SSH só por chave, usuário não-root `apexpro`), stack Node 20 + PM2 + Nginx + Certbot, repo privado `guiraldi1987/SisPerfformance` com deploy key read-only, SSL Let's Encrypt em `https://apexpro.grupommp.com.br` (renovação automática), backup diário do SQLite via cron com retenção de 14 dias, e CORS travado no domínio de produção (Fase 27); correções no CSS de impressão para que o conteúdo flua entre páginas e o layout fique compacto estilo relatório nas 4 páginas com botão Imprimir (Fase 28); feature de backup do banco de dados com disparo manual + automático diário às 03:00, retenção de 5 backups automáticos e página de administração em `/backups` (Fase 29); UX Onda 1 — tokens de superfície, paleta `M_COLOR` canônica, 4 componentes compartilhados (`Button`, `PageHeader`, `LoadingState`, `EmptyState`), varredura de fundos hex ad-hoc em 14 arquivos e troca de emojis por SVG no Painel (Fase 30); UX Onda 2 — `ConfirmModal` acessível (foco/trap/Escape/restore), confirmação obrigatória ao inativar atleta no Painel, skeletons em `JogadorPerfil` e `SessaoDashboard`, estados vazios com CTA em `Backups` e `Comparar`, validação de extensão/tamanho + feedback de envio no `Upload` (Fase 31); Dark Premium — tokens `.dark` translúcidos (surface-card/elevated/input em RGBA), halo radial de fundo, sheen de topo + sombra de elevação nos utilitários `.bg-card`/`.bg-elevated`, limpeza de hex ad-hoc em 5 arquivos (`index.css`, `Sessoes.tsx`, `Layout.tsx`, `Painel.tsx`, `SessaoDashboard.tsx`); dark-only, light intacto (Fase 32); correção da impressão que saía com fundo escuro ao imprimir do modo escuro (bug pré-existente desde a Onda 1) — reset de superfícies/`header`/`.sticky` e escurecimento das famílias de texto neutras dentro do `@media print`, validado via PDF real headless; impressão agora sai branca e legível em ambos os temas (Fase 33); UX Onda 4 (Acessibilidade WCAG 2.1 AA) + Onda 5 (Clareza) — regiões `aria-live` (toast/erro/troca de rota via `RouteAnnouncer`), labels de formulário/filtros, `aria-hidden`+landmarks na sidebar, nome acessível nos 8 charts, ações de sessão com foco visível, tabelas roláveis focáveis, contraste de texto muted no claro (`slate-400`→`500`), reduce-motion, tooltips de ACWR/z-score e unidade no heatmap; validado com axe-core headless (críticos e sério de tabelas zerados; residual de contraste de cor semântica + nested-interactive do card documentado) — Onda 3 (Mobile) pulada por ora (Fase 34); residuais de acessibilidade — card de sessão com link esticado (corrige `nested-interactive`), `<main>` único (Layout) + `<main>` no Login, `heading-order` sequencial, contraste AA nos badges de posição (helper `ensureContrastBg`), e redução parcial do contraste de texto de cor semântica (labels de zona + classes de status escurecidas no claro; long tail inline nas páginas de gráfico documentado como residual); estrutural zerado no axe, build verde, print sem regressão (Fase 35); fix do popup nativo de `<select>` que abria ilegível (fundo branco + texto claro) no tema escuro — `color-scheme` declarado por tema no `index.css` + cores explícitas de `option`/`optgroup`, conserta todos os selects do app (jogo, posição, etc.) de uma vez (Fase 36); dropdown custom `Select` (WAI-ARIA listbox via portal) substituindo os 2 selects do `/comparar` com fidelidade total ao tema — item selecionado em vermelho-clube, sem a barra azul do Windows, verificado headless dark+light (Fase 37).
