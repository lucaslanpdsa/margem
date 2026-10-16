# margem.

Responde duas perguntas: **quanto tempo eu ainda tenho hoje?** e **estou em dia ou atrasado?**

## O que o app faz

- **Seu horário**: de que horas a que horas você tem para tarefas em cada dia, com pausas fixas (almoço). O app acompanha o relógio.
- **Tarefas** de uma vez (num dia) ou que repetem (em dias da semana), com o tempo de cada uma e horários opcionais (pode ter mais de um, ex: 08–11 e 14–18).
- **Como termina**: marcando como feita (o tempo é estimativa; terminou antes, o resto volta para o dia) ou cumprindo o tempo (ex: trabalhar 7h).
- **Reportar tempo**: botão Registrar em cada tarefa (15m, 30m, 1h, 2h, outra duração ou um intervalo como 14:00-15:30; registros editáveis), ou a aba **Foco** (pomodoro ou cronômetro).
- **Topo do dia**: "Em dia · sobram 2h10" ou "Atrasado · 1h50 a mais do que cabe".
- **Tarefas**: uma tela para organizar, com duas vistas. **Agenda**: a semana dia a dia, com a barra e quanto sobra ou passa; toque numa tarefa para editar ou crie uma num dia. **Lista**: todas as tarefas, as que repetem e as que não repetem (por data).
- Tarefa com horário fora do seu horário vira extra e não ocupa o tempo do dia. Tarefas de dias anteriores não concluídas aparecem para trazer para hoje.

### Como as contas funcionam

| Termo | Cálculo |
|---|---|
| Tempo do dia | horário do dia (ex: 07:00–18:00) menos pausas (ex: almoço) |
| Feito | tempo registrado no dia (pomodoro + manual), sem contar os extras |
| Passou | horário que já passou no relógio sem nada registrado |
| Falta | para cada tarefa não concluída do horário: estimativa − feito |
| Livre | o que resta do horário − falta (negativo = não cabe) |

Concluir uma tarefa antes da estimativa libera o tempo restante dela.

## Stack

Next.js (App Router) + TypeScript + Tailwind · Firebase (Auth com Google + Firestore) · deploy na Vercel.

## Configuração

### 1. Firebase

1. Crie um projeto em <https://console.firebase.google.com>.
2. **Authentication → Método de login →** ative **Google**.
3. **Firestore Database →** crie o banco (modo produção).
4. **Firestore → Regras →** cole o conteúdo de [`firestore.rules`](firestore.rules) e publique.
5. **Configurações do projeto → Seus apps →** adicione um **App da Web** e copie a configuração.

### 2. Local

```bash
cp .env.example .env.local   # preencha com a configuração do passo 5
npm install
npm run dev                  # http://localhost:3000
npm test                     # testes da lógica de capacidade
```

### 3. Vercel

1. Importe o repositório na Vercel.
2. Em **Settings → Environment Variables**, adicione as seis variáveis do `.env.example`.
3. Faça o deploy.
4. No Firebase, em **Authentication → Configurações → Domínios autorizados**, adicione o domínio da Vercel (ex: `margem.vercel.app`).

## Estrutura

```
src/
  app/                 layout, página e manifesto PWA
  components/
    App.tsx            casca: login, abas, navegação de datas
    store.tsx          auth + dados em tempo real do Firestore
    views.tsx          Dia, Tarefas (agenda e lista), Ajustes
    CapacityPanel.tsx  topo do dia (em dia / atrasado) e barra
    DaySidebar.tsx     lista de tarefas do dia
    FocusView.tsx      aba Foco (pomodoro / cronômetro)
    TaskForm.tsx / LogTimeForm.tsx / ScheduleEditor.tsx
  lib/
    metrics.ts         conta do dia (pura, testada)
    schedule.ts        horário, relógio e horários das tarefas
    db.ts              leitura/escrita no Firestore
    pomodoro.ts        ciclo do timer
```

### Dados no Firestore

```
users/{uid}/tasks/{id}       tarefas
users/{uid}/blocks/{id}      blocos na agenda
users/{uid}/sessions/{id}    tempo trabalhado (pomodoro e manual)
users/{uid}/meta/settings    horário, pausas, pomodoro e timer ativo
```
