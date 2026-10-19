# margem.

Responde duas perguntas: **quanto tempo eu ainda tenho hoje?** e **estou em dia ou atrasado?**

Documentação completa (conceitos, navegação, fluxos, telas e análise de UI/UX): [`docs/`](docs/README.md).

## O que o app faz

- **Seu horário**: de que horas a que horas você tem para tarefas em cada dia, com pausas fixas (almoço). O app acompanha o relógio.
- **Tarefas** de uma vez (num dia) ou que repetem (em dias da semana), com o tempo de cada uma e horários opcionais (pode ter mais de um, ex: 08–11 e 14–18).
- **Horário da tarefa**: aparece na agenda e o app avisa no início e no fim (com o app aberto). O tempo feito vem só do que você registra.
- **Como termina** (em "Mais opções"): marcando como feita (terminou antes, o resto volta para o dia) ou cumprindo o tempo (ex: trabalhar 7h).
- **Registrar tempo**: toque na tarefa e registre 15m, 30m, 1h, 2h, outra duração ou um intervalo como 14:00-15:30 (registros editáveis), ou use a aba **Foco** (pomodoro ou cronômetro).
- **Topo do dia**: "Sobram 2h10" ou "Atrasado 1h50". Atrasado mostra o que dá para tirar de hoje, com "Amanhã" ou "Pular hoje".
- **Tarefas**: a tela para organizar. No topo, **seu horário** resumido numa linha (toque para editar). As que repetem aparecem como uma grade da semana (toque nos dias para ligar ou desligar), com o total fixo e o livre de cada dia embaixo; as que não repetem ficam agrupadas por data (atrasadas, hoje, amanhã, esta semana, depois). Tempo e data mudam com um toque, o nome abre a edição completa, e cada grupo tem criação rápida ("Academia 1h").
- Tarefa com horário fora do seu horário vira extra e não ocupa o tempo do dia. Tarefas de dias anteriores não concluídas aparecem num aviso, com "Trazer para hoje".

### Como as contas funcionam

| Termo | Cálculo |
|---|---|
| Tempo do dia | horário do dia (ex: 07:00–18:00) menos pausas (ex: almoço) |
| Feito | tempo registrado no dia (timer, pomodoro e manual, incluindo o timer rodando), sem contar os extras |
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

O mapa do código, o modelo de dados e o jeito de trabalhar no projeto estão em [`CLAUDE.md`](CLAUDE.md). Para ver o app sem login, com dados de exemplo, rode `npm run dev` e abra `http://localhost:3000/dev` (cenários em `src/dev/fixtures.ts`).

### Dados no Firestore

```
users/{uid}/tasks/{id}       tarefas
users/{uid}/sessions/{id}    tempo trabalhado (pomodoro e manual)
users/{uid}/meta/settings    horário, pausas, pomodoro e timer ativo
```
