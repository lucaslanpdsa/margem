# margem.

Gerenciador de rotina flexível. Mostra, para cada dia, **quanto tempo você tem, quanto já fez, quanto falta e quanto ainda sobra** — com agenda estilo Google Agenda e pomodoro contando o tempo real das tarefas.

## O que tem na v1

- **Tarefas** de três tipos:
  - **Avulsa**: num dia específico, ou sem dia (vai para a *caixa de entrada*). Pode ter **prazo**.
  - **Dias fixos**: repete nos dias da semana escolhidos.
  - **Meta semanal**: X horas por semana, em qualquer dia (ex: 5h de inglês).
- **Prioridade** (alta, média, baixa) e **categoria**.
- **Adição rápida**: digite `Revisar PR 45` ou `Estudar React 1h30` e a estimativa é lida do final.
- **Agenda do dia e da semana**: arraste tarefas da lista para a agenda para criar blocos; mova e redimensione blocos.
- **Seu horário**: de que horas a que horas você tem para tarefas em cada dia, com pausas fixas (almoço). O app acompanha o relógio e sabe quanto do dia já passou. Dá para mudar o horário de um dia específico.
- **Extras fora do horário**: tarefa marcada na agenda fora do seu horário (ex: aula às 20h) não ocupa o tempo do dia e aparece separada.
- **Painel do dia**: feito / falta / planejado / livre, com alerta quando o dia passa do limite.
- **Semana**: cada dia mostra sua barra de capacidade e o tempo livre no cabeçalho.
- **Pomodoro**: conta **minutos reais** (parar no meio registra o parcial), sobrevive a recarregar a página e funciona entre dispositivos. Notificação + som ao fim.
- **Registro manual de tempo** para o que foi feito sem timer, e correção de registros.
- **“O que faço agora?”**: se há bloco na agenda agora, ele; senão, a primeira tarefa flexível (prazo → prioridade → menor) e quanto tempo há até o próximo compromisso.
- **Atrasadas**: avulsas de dias passados aparecem hoje com botão para replanejar.
- PWA: dá para instalar no celular.

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

Next.js (App Router) + TypeScript + Tailwind · Firebase (Auth com Google + Firestore) · FullCalendar · deploy na Vercel.

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
    views.tsx          Dia, Semana, Tarefas, Ajustes
    Calendar.tsx       agenda (FullCalendar) e blocos
    DaySidebar.tsx     "agora", fila do dia, metas, caixa de entrada
    CapacityPanel.tsx  painel e barra de capacidade
    Timer.tsx          pomodoro flutuante
    TaskForm.tsx / LogTimeForm.tsx
  lib/
    metrics.ts         toda a lógica de capacidade e ordenação (pura, testada)
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

## Próximos passos (v2)

- Sugestão “o que faço agora” mais inteligente (cabe na janela livre, energia, contexto).
- Estimado × real por categoria, para calibrar estimativas.
- Revisão semanal.
- Importar eventos do Google Agenda para descontar da capacidade.
