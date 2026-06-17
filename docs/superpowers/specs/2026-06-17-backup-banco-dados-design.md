# Spec — Feature de Backup do Banco de Dados

**Data:** 2026-06-17
**Projeto:** ApexPRO (Paulista FC)
**Status:** aprovado no brainstorming, aguardando revisão do spec

---

## 1. Objetivo

Permitir gerar backups do sistema que (a) capturam o banco de dados **e** as fotos dos
atletas, (b) ficam salvos numa pasta na VPS e (c) podem ser baixados pelo usuário. Além do
disparo manual, um backup automático roda diariamente — cobrindo o cenário de queda da VPS
em que ninguém lembrou de clicar.

## 2. Decisões (confirmadas no brainstorming)

| # | Decisão | Valor |
|---|---|---|
| Conteúdo | O que entra no backup | `ieeegp.db` (snapshot consistente) **+** pasta `uploads/`, compactados num `.zip` |
| Disparo | Como é acionado | Manual (botão) **+** automático diário |
| Gestão | Recursos na tela | Criar, listar, baixar e excluir |
| Retenção | Quantos manter | **5 automáticos** (poda os mais antigos); **manuais ficam até o usuário excluir** |
| Horário auto | Quando roda o diário | **03:00 (America/Sao_Paulo)** |
| Libs novas | Dependências backend | `archiver` (zip multi-arquivo) + `node-cron` (agendamento) |
| Acesso | Quem pode usar | Só autenticado (JWT), sem trava por papel — coerente com a rota `usuarios` |

## 3. Escopo

**Dentro:** geração de backup (.zip com DB + uploads), salvamento na VPS, listagem,
download autenticado, exclusão, poda automática, agendamento diário, página no frontend.

**Fora (YAGNI):**
- **Restauração** (subir um .zip para sobrescrever o banco) — não pedido, e arriscado; fica para uma fase futura se necessário.
- **Backup off-site** (S3, Google Drive etc.) — fora do escopo; os zips ficam só na VPS.
- **Postgres** — produção é SQLite. Se `DB_TYPE=postgres`/`DATABASE_URL` apontar para Postgres, a rota de criação retorna erro claro em vez de gerar um zip inválido.

## 4. Abordagem escolhida

Geração nativa em Node (portável entre o dev Windows e a VPS Linux), sem depender de
binários do SO:

1. `better-sqlite3.backup()` gera um snapshot consistente do `.db` mesmo com o app rodando
   em modo WAL.
2. `archiver` compacta o snapshot + a pasta `uploads/` num único `.zip`.
3. `node-cron` agenda a execução diária.

Alternativas descartadas: shell out para `sqlite3`/`zip` (depende de binários, quebra no dev
Windows); implementação zero-dependência (reimplementaria cron e zip à mão, mais frágil).

## 5. Arquitetura

```
backend/src/services/backup.ts   ← lógica isolada: createBackup / listBackups / deleteBackup / pruneBackups
backend/src/routes/backups.ts    ← rotas HTTP finas que chamam o service
backend/src/db/index.ts          ← + snapshotDatabase(destPath) encapsulando sqlite.backup()
backend/src/index.ts             ← + app.route('/api/backups', ...) + start do cron diário
backend/backups/                 ← pasta dos .zip (criada no boot com mkdir recursivo; gitignored)
frontend/src/pages/Backups.tsx   ← nova página (criar / listar / baixar / excluir)
frontend/src/App.tsx             ← + import lazy + <Route path="/backups">
frontend/src/pages/Layout.tsx    ← + NavLink "Backups" no grupo "Administração" + ícone novo
.gitignore                       ← + backend/backups/
```

`backup.ts` é uma unidade fechada: recebe caminhos de configuração, devolve metadados
`{ filename, size, createdAt, source }`. A rota HTTP e o agendador chamam a **mesma**
função `createBackup(source)`; nenhum dos dois conhece os detalhes de como o zip é montado.

## 6. Fluxo de criação

1. Monta o nome com timestamp (America/Sao_Paulo) + origem:
   - manual → `apexpro-backup-manual-2026-06-17_1430.zip`
   - automático → `apexpro-backup-auto-2026-06-17_0300.zip`
2. `snapshotDatabase(tmpPath)` → `sqlite.backup(tmpPath)` (snapshot íntegro).
3. `archiver('zip')` adiciona `tmpPath` como `ieeegp.db` e a pasta `uploads/` como `uploads/`,
   escrevendo direto em `backend/backups/<nome>.zip`.
4. Aguarda o `close` do stream de saída; apaga o `tmpPath`.
5. **Poda:** mantém os 5 `.zip` `auto` mais recentes (apaga os mais antigos);
   os `manual` não são podados.
6. Retorna os metadados do backup criado.

## 7. Endpoints

Todos sob o middleware JWT de `/api/*` (autenticado).

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/backups` | Cria um backup manual agora; retorna metadados |
| `GET` | `/api/backups` | Lista os `.zip` salvos: `{ filename, size, createdAt, source }`, mais recentes primeiro |
| `GET` | `/api/backups/:filename` | Baixa o `.zip` (`Content-Disposition: attachment`) |
| `DELETE` | `/api/backups/:filename` | Exclui um `.zip` |

**Validação de `:filename`** (proteção contra path traversal): aceita apenas nomes que casam
com `^apexpro-backup-(auto|manual)-\d{4}-\d{2}-\d{2}_\d{4}\.zip$`; rejeita qualquer `..`,
barra ou caractere fora do padrão. O arquivo é sempre resolvido para dentro de
`backend/backups/` e o caminho final é conferido contra essa raiz antes de ler/excluir.

## 8. Agendamento automático

`node-cron` agenda `createBackup('auto')` para **todo dia às 03:00 (America/Sao_Paulo)**,
iniciado no boot do `index.ts` (sobe junto com o processo `pm2`). Cada execução é envolvida
em `try/catch` com log de sucesso/erro no console (visível via `pm2 logs`). Falha de uma
execução não derruba o servidor.

## 9. Frontend — página Backups

- Botão **"Criar backup agora"**: dispara `POST /api/backups`, mostra spinner, toast de
  sucesso/erro (`useToast` existente), e recarrega a lista.
- Lista/tabela dos backups: data formatada, tamanho em MB, badge **auto/manual**, e ações
  **Baixar** e **Excluir** (reusa o `ConfirmModal` existente para a exclusão).
- **Download autenticado:** `fetch(\`${API_BASE}/backups/${filename}\`)` → `res.blob()` →
  `URL.createObjectURL` → clique programático num `<a download>` → `revokeObjectURL`. O
  `installFetchInterceptor()` global já injeta o `Authorization: Bearer`, então não há token
  na URL.
- Aviso fixo na tela: "Backup automático diário às 03:00. Mantém os últimos 5 automáticos;
  os manuais ficam até serem excluídos."
- Integração: import lazy + `<Route path="/backups">` em `App.tsx`; `NavLink` "Backups" no
  grupo "Administração" de `Layout.tsx` com um ícone novo (banco/arquivo).

## 10. Segurança

- Todas as rotas só autenticadas (coerente com `usuarios`, que também não trava por papel).
- O `.zip` contém a tabela `usuarios` com hashes bcrypt → nunca exposto sem login e **nunca**
  servido pela rota estática pública `/uploads/*`; só sai pela rota autenticada `/api/backups/:filename`.
- `backend/backups/` adicionado ao `.gitignore` (nunca vai para o repositório).
- Validação de path traversal no parâmetro `:filename` (ver seção 7).

## 11. Testes / verificação

O projeto não tem framework de testes hoje (`"test"` em `package.json` é um stub). Não será
instalado um harness completo sem pedido explícito. Verificação proposta:

- **Smoke script standalone** (`node`): roda `createBackup('manual')`, abre o `.zip` gerado,
  confirma que o `ieeegp.db` interno é um arquivo SQLite válido (header `SQLite format 3`) e
  que a pasta `uploads/` foi incluída.
- **Teste manual pela tela:** criar backup, ver na lista, baixar e abrir o zip, excluir.
- Se for desejado TDD de verdade, montar o `vitest` no backend (fora do escopo padrão deste spec).

## 12. Impacto no deploy (HANDOVER Fase 27)

Ao subir para a VPS: `git pull` → **`npm install` no backend** (novas libs `archiver` +
`node-cron`) → build do frontend → `pm2 restart apexpro-backend`. A pasta `backend/backups/`
é criada automaticamente no boot (mkdir recursivo); o agendador inicia junto com o processo
`pm2`. Registrar como **Fase 29** no `HANDOVER.md` (estrutura/endpoints/páginas + data no rodapé).

## 13. Critérios de aceite

- [ ] Clicar "Criar backup agora" gera um `.zip` em `backend/backups/` contendo `ieeegp.db` válido + `uploads/`.
- [ ] A lista mostra os backups com data, tamanho e origem (auto/manual), mais recentes primeiro.
- [ ] Baixar entrega o `.zip` correto, autenticado, sem token na URL.
- [ ] Excluir remove o arquivo da VPS após confirmação.
- [ ] Backup automático roda às 03:00 e a poda mantém só os 5 automáticos mais recentes; manuais permanecem.
- [ ] Acesso bloqueado sem JWT; `:filename` inválido é rejeitado (sem path traversal).
- [ ] `backend/backups/` está no `.gitignore`.
