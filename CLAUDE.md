# Margem — guia para o Claude

@AGENTS.md

Leia isto antes de mudar qualquer coisa. Detalhes em [`docs/`](docs/README.md); decisões e o que já foi descartado em [`docs/decisoes.md`](docs/decisoes.md).

## O produto

App pessoal de rotina flexível (PWA, pt-BR). Responde duas perguntas: **quanto tempo eu ainda tenho hoje?** e **dá tempo de fazer o que falta?**

Princípios (vêm do dono, valem para toda mudança):

- **Simples e objetivo.** Antes de adicionar algo, pergunte se dá para resolver tirando ou juntando. Feature que confunde é pior que feature que falta.
- **O número tem que estar certo.** Se um cálculo pode enganar (ex: contar tempo que não foi feito), não faça.
- **Rotina flexível.** O horário de trabalho do dono não é fixo: nada pode supor que o horário da tarefa foi cumprido.
- **Registrar tempo com o mínimo de esforço** (▶ na tarefa, adicionar depois, "O que você fez?").

Público: o próprio dono (desenvolvedor, usa no computador durante o expediente e no celular). Inspirações citadas por ele: ClickUp (registro de tempo), Pomofocus (pomodoro).

## Como trabalhar com o dono

- **Português do Brasil**, frases curtas, sem jargão técnico na conversa (ele lê no celular às vezes). Nomes de botões entre aspas ou em negrito.
- **Questione antes de implementar.** Ele pediu isso: avalie se a ideia faz sentido para o objetivo do app, aponte o custo e proponha a melhor versão. Quando houver escolha real, dê 2–3 opções curtas com a sua recomendação e pergunte. Quando a ideia é boa e clara, faça.
- **Mostre, não descreva.** Para mudança visual, rode a prévia (`/dev`) e mande uma captura antes ou depois de publicar.
- **Publicar = push na `main`.** A Vercel publica sozinha (margem-swart.vercel.app). Ele testa em produção e volta com prints. Rode lint, testes e build antes (comando `/verificar`).
- Ao terminar, diga em poucas linhas o que mudou para ele (em termos de tela), não o que mudou no código.

## Stack e comandos

Next.js 16 (App Router, **leia AGENTS.md**: APIs mudaram), React 19, TypeScript, Tailwind 4, Firebase (Auth Google + Firestore), date-fns, lucide-react, Vitest. Deploy na Vercel.

| Comando | Para quê |
|---|---|
| `npm run dev` | servidor local (precisa de `.env.local`, ver `.env.example`; a prévia `/dev` não precisa) |
| `npx eslint src` | lint (inclui regras do React Compiler: nada de `Date.now()`/`new Date()` no render) |
| `npm test` | testes (`src/lib/metrics.test.ts`, regras de conta e de tempo) |
| `npm run build` | build e checagem de tipos de verdade |
| `npx tsc --noEmit` | rápido, mas acusa `LayoutProps` em `layout.tsx` (tipo gerado pelo Next no build); ignore esse |
| `python3 scripts/capturar-telas.py --url http://localhost:3000` | capturas das telas para `docs/img` (usa a prévia) |

Comandos prontos em `.claude/commands/`: `/verificar`, `/previa`, `/publicar`.

## Mapa do código

```
src/app/page.tsx            entra no App
src/app/dev/page.tsx        prévia com dados de exemplo (só em dev): /dev?cenario=…&abrir=…#aba
src/dev/fixtures.ts         dados de exemplo e cenários da prévia
src/components/
  App.tsx                   casca: login, abas (#dia, #tarefas, #foco), barra lateral/inferior, cabeçalho (data abre calendário), esqueleto
  AccountMenu.tsx           menu da conta: notificações (lugar fixo), Como funciona, Sair
  store.tsx                 auth + dados em tempo real; migra tarefas antigas; timer rodando vira registro "ao vivo"
  dialogs.tsx               abre as janelas globais: editTask (formulário) e logTime (janela da tarefa)
  views.tsx                 aba Dia (duas colunas no computador) e "Registros de hoje"
  CapacityPanel.tsx         topo do dia: título, linha do tempo, "O que você fez?", "Para dar tempo", Detalhes
  DaySidebar.tsx            lista de tarefas do dia, criação rápida, aviso de atrasadas, concluídas
  TaskRow.tsx               linha da tarefa no Dia (círculo, progresso, ▶/■)
  LogTimeForm.tsx           janela da tarefa: feito, começar timer, adicionar tempo, registros, pular/mudar dia/concluir
  TimeEntries.tsx           adicionar tempo (dia e nota); lista de registros única: da tarefa (por dia) e do dia (DayEntries)
  TaskForm.tsx              formulário de criar/editar tarefa
  TasksPage.tsx             aba Tarefas: seu horário, Esta semana, grade "Repetem", "Não repetem" por data + concluídas, desativadas
  ScheduleEditor.tsx        editor do horário semanal e pausas
  FocusView.tsx             aba Foco (pomodoro/cronômetro), config do pomodoro, "Em que você trabalhou?"
  Timer.tsx                 motor do timer (sempre montado) + barra flutuante
  TimerStart.tsx            "Começou às … · Mudar"
  SlotAlerts.tsx            avisos de início/pausa/fim do horário das tarefas (app aberto)
  toast.tsx                 avisos de rodapé (Desfazer, erro de gravação), "Sem internet", useTimerActions (start/stop com aviso)
  DayMenu.tsx               menu Hoje/Amanhã/Próxima segunda/Outro dia
  Onboarding.tsx            configuração inicial e "Como funciona"
  ui.tsx                    Button, IconButton, Modal, Panel, Segmented, Switch, TimeSelect, inputCls, cx
src/lib/
  types.ts                  modelo de dados (Task, Session, Settings, ActiveTimer)
  metrics.ts                contas do dia (pura e testada)
  schedule.ts               horário do dia, horários das tarefas, conflitos, eventos de aviso
  pomodoro.ts               ciclo do timer, registro ao vivo, ajustar início
  db.ts                     leitura/escrita no Firestore; toda escrita passa por write()/saved() (erro vira aviso; na prévia não grava)
  firebase.ts               app, auth e Firestore com cache no aparelho (offline, várias abas)
  preview.ts                PREVIEW_UID da prévia
  dates.ts                  chaves de dia, durações ("3h 20m"), intervalos ("14:00-15:30"), nomes de dia
  migrate.ts                conversão de dados antigos (metas semanais)
```

## Modelo de dados (Firestore, `users/{uid}/…`)

- `tasks/{id}`: `title`, `repeat` (`once` | `weekdays`), `estimateMin`, `date` (once), `weekdays` (0=dom), `slots` (horários), `doneBy` (`time` = conclui pelo tempo), `completedAt` (once), `completions`/`skipped`/`estimateFor` (mapas por dia `"yyyy-MM-dd"`), `archived` (desativada), `createdAt`.
- `sessions/{id}`: `taskId` ("" = sem tarefa), `date`, `minutes`, `kind` (`pomodoro` | `manual`), `startedAt`/`endedAt` (iguais = "sem horário"), `note`. O prefixo do id diz a origem: `sw-` cronômetro, `pomo-` pomodoro, outro = manual.
- `meta/settings`: `windows` (horário por dia da semana), `breaks`, `windowOverrides` (por data), `focusMin`, `breakMin`, `autoStartFocus`, `autoStartBreaks`, `activeTimer`, `lastTimerMode`, `pendingAssign`, `scheduleSet`, `onboarded`.

Regras: toda escrita nova vai em `db.ts` usando `write(uid, () => …)` (avisa erro, não trava sem internet, não grava na prévia); ações que tiram ou movem algo mostram `toast(texto, { undo })`; Firestore não aceita `undefined` (use `clean` em `db.ts`); `saveSettings` substitui cada campo enviado por inteiro (`mergeFields`); campos novos precisam ser opcionais e ter migração em `migrate.ts` se mudarem o significado de dados antigos.

## Regras de negócio que não podem quebrar

Ver [`docs/01-conceitos.md`](docs/01-conceitos.md). Resumo:

- Feito = só registros (incluindo o timer rodando). **O horário da tarefa não conta tempo sozinho** (foi tentado e removido).
- Sobra = tempo do dia − max(feito, já passou) − falta. Tarefas "extra" (horário todo fora do seu horário) ficam fora da conta.
- Tarefa `doneBy: "time"` conclui quando o registrado chega na meta do dia (`estimateFor[dia] ?? estimateMin`).
- Registro com menos de 1 minuto não é salvo (o usuário é avisado).

Toda mudança de conta ganha teste em `metrics.test.ts`.

## Fluxo de trabalho

1. Leia a página da área em `docs/04-telas.md` e as decisões em `docs/decisoes.md` (evita refazer o que foi descartado).
2. Questione/proponha (ver acima). Combine antes se for grande ou ambíguo.
3. Implemente seguindo o estilo do código: comentários curtos em português explicando o porquê, nomes de tela iguais aos da interface.
4. `/verificar`. Para UI, `/previa` e confira no celular (390px) e no computador.
5. Atualize a documentação no mesmo commit:
   - `docs/04-telas.md` se mudou uma tela; `docs/03-fluxos.md` e `docs/02-navegacao.md` se mudou um caminho.
   - `docs/decisoes.md` se uma decisão de produto foi tomada ou revertida.
   - `docs/05-analise-ux.md`: marque o ponto como feito.
   - Imagens: `python3 scripts/capturar-telas.py --so <nome>` com o servidor de dev rodando.
6. Commit em português, mensagem dizendo o que mudou para o usuário. `/publicar`.

## Armadilhas conhecidas

- **Next 16**: confira a doc em `node_modules/next/dist/docs/` antes de usar APIs de rota/servidor. `AGENTS.md` é mantido pelo `next dev`; se ele aparecer modificado, commite junto (o próprio arquivo pede isso).
- **React Compiler lint** (`react-hooks/purity`, `set-state-in-effect`): nada de `Date.now()` no render; use `useNow()` (`Timer.tsx`) ou estado iniciado em efeito.
- **Não rode prettier no arquivo inteiro**: o projeto usa linhas longas (~160) e não tem config; o diff vira ruído.
- **Fuso**: datas de dia são chaves locais `yyyy-MM-dd` (`dates.ts`); não use `toISOString().slice(0,10)` para dia.
- **Prévia** (`/dev`): uid `preview` (`src/lib/preview.ts`), nada é salvo; `TimeEntries` lê o histórico da prévia em vez do Firestore. Código de produção não importa `src/dev/` (só a página `/dev`), para os dados de exemplo não irem para o pacote. Em produção `/dev` devolve 404.
- Antes de `git push`, `git fetch origin main && git rebase origin/main` (o dono também edita).

## Pendências

O backlog de UX está em [`docs/05-analise-ux.md`](docs/05-analise-ux.md), com prioridade e status.
