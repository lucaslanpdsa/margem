# 1. Conceitos e contas

## Glossário

| Termo | O que é |
|---|---|
| **Seu horário** | De que horas a que horas você tem para tarefas em cada dia da semana (ex: seg a sex, 08:00–18:00). Dia sem horário = dia sem tarefas. |
| **Pausa fixa** | Intervalo que vale para todos os dias e não conta como tempo para tarefas (ex: almoço 12:00–13:00). |
| **Horário só de um dia** | Exceção para uma data específica (Dia › Detalhes › "Mudar"). Pode ser outro horário ou "sem horário". |
| **Tarefa que repete** | Acontece em dias fixos da semana (ex: seg, qua, sex). |
| **Tarefa de uma vez** | Acontece num dia. Sem dia (versões antigas) conta como de hoje. |
| **Tempo da tarefa** | Quanto você espera gastar nela no dia (estimativa). |
| **Encurtar hoje** | Tempo da tarefa trocado só para uma data (sugestão "Encurtar para…"). |
| **Como termina** | *Marco como feita* (padrão): conclui pelo círculo; terminou antes, o resto volta para o dia. *Cumpro o tempo*: conclui sozinha quando o tempo registrado chega na meta (ex: trabalhar 7h). |
| **Horário da tarefa** | Opcional, um ou mais trechos (ex: 08:00–11:00 e 14:00–18:00). Serve para a agenda, para os avisos de início e fim e para marcar "extra". **Não conta tempo sozinho.** |
| **Extra** | Tarefa cujo horário fica todo fora do seu horário (ex: academia às 18:30 com horário até 18:00). Não entra nas contas do dia. |
| **Registro** | Um pedaço de tempo feito numa tarefa: vem do cronômetro, do pomodoro ou é adicionado à mão. Tem dia, duração, horário (opcional) e nota (opcional). |
| **Registro sem tarefa** | Foco feito sem escolher tarefa. Conta no dia; o app pergunta depois em que você trabalhou. |
| **Pular hoje** | Tira uma tarefa que repete só daquele dia. O que já tinha sido feito continua contando. |
| **Mudar dia** | Muda a data de uma tarefa de uma vez (Hoje, Amanhã, Próxima segunda, Outro dia). |
| **Desativar tarefa** | Tira uma tarefa que repete de todos os dias, sem apagar o histórico (vai para "Desativadas"). |
| **Atrasada** | Tarefa de uma vez com data no passado e não concluída. |
| **Meta da semana** | Soma do tempo planejado de uma tarefa que repete nos dias dela, de segunda a domingo (1h30 seg a sex = 7h30). Não é um campo: muda quando muda o tempo, os dias, "Pular hoje" ou "Encurtar". |
| **Atraso da semana** | O que ficou faltando nos dias que já passaram, descontado o que foi feito a mais hoje. Dia concluído pelo círculo conta como cumprido. |
| **Dias seguidos** | Dias planejados cumpridos em sequência, contando para trás; dias sem plano não quebram, e hoje só quebra depois que passar. |
| **Grátis / Pro** | Pro = semana, encaixe e constância. Teste de 14 dias contado da criação da conta. Sem a cobrança ligada, todos são Pro. |

## As contas do dia

Todas as contas são por dia e só consideram tarefas dentro do seu horário (as "extra" ficam de fora).

| Número | Cálculo |
|---|---|
| **Tempo do dia** | horário do dia − pausas fixas |
| **Já passou** | quanto do tempo do dia o relógio já andou (dia passado = tudo, dia futuro = nada) |
| **Feito** | soma dos registros do dia, incluindo o timer rodando e registros sem tarefa |
| **Sem registro** | já passou − feito (o tempo que passou e não tem nada registrado) |
| **Falta** (por tarefa) | tempo da tarefa − feito nela; 0 se concluída ou pulada |
| **A fazer** | o que falta e ainda cabe até o fim do horário |
| **Não cabe** | o que falta e passa do fim do horário |
| **Sobra** | tempo do dia − max(feito, já passou) − falta (se negativo, "não dá tempo") |

O título do dia é um destes:

- **Dá tempo: sobram 1h30**: a sobra é positiva.
- **Não dá tempo: 38min a mais**: o que falta passa do fim do horário.
- **5h40 feitos**: o horário do dia já acabou.
- **Hoje sem horário**: não há horário para tarefas nesse dia.

### Exemplo

Horário 08:00–18:00 com almoço 12–13 (9h). Às 15:00 já passaram 6h. Você registrou 5h e faltam 3h de tarefas.

- Sem registro = 6h − 5h = **1h**
- Restam 3h até as 18:00 → as 3h de tarefas cabem exatamente → **Dá tempo: sobram 0min**
- Se faltassem 3h40 → **Não dá tempo: 40min a mais**

## O que conta em cada lugar

| Lugar | Conta o quê |
|---|---|
| Topo do dia | registros do dia (com timer rodando), tarefas do dia dentro do horário |
| Linha da tarefa | registros daquela tarefa naquele dia / tempo do dia dela |
| Janela da tarefa › Registros | todos os registros da tarefa, de todos os dias |
| Dia › Registros de hoje · Foco › "Hoje · Xh registrados" | todos os registros do dia, de todas as tarefas |
| Dia › Esta semana | por tarefa que repete: registrado na semana / soma do planejado; atraso só dos dias passados (`src/lib/week.ts`) |
| Tarefas › Esta semana | por dia: tempo do dia − falta das tarefas daquele dia (repetem + de uma vez); dias passados mostram o feito |
