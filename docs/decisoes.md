# Decisões de produto

Registro do que foi decidido, e por quê, para não refazer o que já foi descartado. Mais recente primeiro. Ao tomar ou reverter uma decisão, acrescente aqui.

## Out 2026

### 19/10 — Revisão de design
- **Topo do Dia enxuto**: legenda curta sempre visível (tocar abre Detalhes); horário do dia e "Mudar" foram para Detalhes; "Para dar tempo" virou o botão **Como dar tempo** (recolhido). Objetivo: a lista de tarefas aparecer na primeira tela do celular.
- **Vermelho só no número e na barra.** Sugestões e aviso de atrasadas em cinza.
- **Azul forte só para ação.** ▶ da linha em contorno (azul só rodando); dias ligados em azul claro (Tarefas e formulário). Seta › da linha da tarefa saiu (a linha toda abre).
- **Registros: tocar na linha edita** (lápis e lixeira saíram da lista; apagar fica na edição).
- Barra do timer compacta; escolha de tarefa do Foco em lista própria; dia da tarefa com Hoje · Amanhã · Outro dia.
- **Identidade "Grafite"** (escolhida entre 3 opções; "Papel", com fundo creme, pareceu pouco profissional): botões de ação em preto (`brand`), cor só para informação (verde feito, azul a fazer, vermelho não cabe); links em `accent` (azul). Ícone preto com o primeiro trecho verde.
- **Adiado:** grade semanal de horas e semana em colunas com arrastar (Sunsama). Avaliado como pouco útil agora porque a maior parte da rotina repete; rever se mudar tarefas de dia virar rotina.

### 19/10 — Os 18 pontos da análise
- **Desfazer em vez de confirmar.** Ações que tiram ou movem algo mostram "Desfazer" no aviso do rodapé. Excluir tarefa deixou de usar a confirmação do navegador.
- **Gravação nunca falha em silêncio.** Toda escrita passa por `saved()`/`write()` (`db.ts`): erro vira aviso vermelho; sem resposta do servidor a tela não trava. **Firestore com cache no aparelho** (funciona sem internet).
- **Registros num lugar só**: a mesma lista (`TimeEntries.tsx`) na janela da tarefa, em "Registros de hoje" (Dia) e em Foco.
- **Janela da tarefa curta**: ações logo abaixo do resumo; "Adicionar tempo já feito" recolhido; histórico com 3 dias.
- **Semana em Tarefas** ("Esta semana"/"Próxima"), com o livre real de cada dia; substituiu a linha Fixas/Livre da grade.
- **Concluídas dos últimos 7 dias** em "Não repetem", com Reabrir.
- **Menu da conta** é o lugar fixo de notificações, ajuda e sair. Sem pedido automático de notificação.
- **Computador em duas colunas** (Dia e Tarefas). **Toque na data abre o calendário.** Alvos de toque de 40–44px no celular.
- **Dia vazio** leva a "Criar tarefa" ou "Montar rotina". Esqueleto no carregamento.

### 19/10 — Consistência entre telas
- **Tocar numa tarefa abre sempre a janela da tarefa** (Dia e Tarefas). "Editar" fica no cabeçalho da janela. Antes, em Tarefas o nome abria direto a edição.
- **Tarefa de uma vez tem "Mudar dia"** na janela (Hoje, Amanhã, Próxima segunda, Outro dia). Tarefa que repete tem "Pular hoje".
- **Criação rápida sem tempo abre o formulário** em todos os campos. O tempo importa para a conta, então não se inventa um padrão.
- **"Desativar" em vez de "Pausar" tarefa.** "Pausa" fica só para intervalo (almoço, pomodoro).
- **Foco abre no último modo usado**, igual ao ▶.

### 19/10 — Registro de tempo no estilo ClickUp
- Adicionar tempo com **dia (Hoje/Ontem/Outro) e nota**. Duração aceita "3h 20m" e intervalo "14:00-15:30".
- **Histórico da tarefa por dia** na janela da tarefa, com editar e apagar.
- **Ajustar a hora de início do timer** ("Começou às … · Mudar"), só hoje e não no futuro.
- **Adiado:** Timesheet (grade semanal tarefas × dias). Ideia: colocar em Foco, renomeada "Tempo". O dono preferiu só os itens acima por ora.

### 19/10 — Contagem automática pelo horário: removida
- Foi tentado (16/10) contar como feito o horário da tarefa que já passou.
- **Removido** porque a rotina do dono é flexível: mostrava 2h07 de Trabalho às 10h sem ele ter trabalhado e marcava como concluída uma tarefa cujo horário tinha passado.
- O horário da tarefa serve para: agenda, avisos de início/fim, marcar "extra" e conflitos. **Feito vem só de registro.** Não reintroduzir sem uma opção explícita por tarefa e pedido do dono.

### 16/10 — Topo do dia
- Termos: **Dá tempo: sobram X / Não dá tempo: X a mais**, legenda Feito · Sem registro · A fazer · Não cabe · Sobra.
- Barra como **linha do tempo** (início, agora, fim; o que não cabe depois do fim).
- **"O que você fez?"** para distribuir o tempo sem registro. **"Para dar tempo"** com Pular hoje / Amanhã / **Encurtar para X** (só hoje, para tarefas por tempo; pular o trabalho inteiro não faz sentido).
- Legenda e explicações recolhidas em "Detalhes" para o card ficar leve.

### 16/10 — Timer
- **▶ na linha da tarefa** (último modo usado; cronômetro na primeira vez) e janela da tarefa com Cronômetro/Pomodoro + adicionar tempo.
- **Timer rodando conta ao vivo** no dia (só o foco).
- **Menos de 1 minuto não registra**, com aviso. Aviso também quando registra ("23min registrados em X").
- Pomodoro: **Início de foco automático** e **Pausas automáticas**, desligados por padrão (nomes como no Pomofocus). Só o foco conta como feito (a opção "foco + pausa" saiu).
- **Descartado:** pausa longa a cada 4 pomodoros (oferecido, não pedido).

### 16/10 — Avisos de horário
- Avisos no início e no fim de cada horário da tarefa, com "pausa até as 14:00" / "recomeça" quando há mais de um horário.
- **Só com o app aberto.** Push com o app fechado exige service worker, guardar inscrição e um agendador (Vercel grátis só agenda 1x/dia; funções agendadas do Firebase pedem plano pago). Adiado até o dono sentir falta no celular.

### 16/10 — Estrutura de navegação
- Abas: **Dia · Tarefas · Foco** (+ "Nova"). Celular: Dia, Tarefas, Nova, Foco (4 itens iguais).
- **Semana e Tarefas viraram uma aba só** ("Tarefas" = área de organização). A visão dia a dia da semana saiu; o agregado da semana é a linha Fixas/Livre.
- **Ajustes saiu**: "Seu horário" foi para o topo de Tarefas; conta/Sair no fim de Tarefas (e na barra lateral no computador).
- A aba fica no endereço (`#tarefas`), recarregar mantém a aba; o dia volta para hoje.

### 16/10 — Tarefas
- Tela de Tarefas como **configuração da rotina**: "Repetem" em grade da semana (toque nos dias), "Não repetem" agrupadas por data, criação rápida em cada grupo, busca.
- **Pular hoje** para tarefa que repete (sai da conta do dia; o feito continua).

### 16/10 — Limpeza
- **Removidos**: metas semanais (migradas para "repete seg a sex, por tempo, meta/5"), prioridade, prazo, categoria, caixa de entrada, blocos de agenda salvos e "sugestão do que fazer agora". Não apareciam mais e confundiam.
- Formulário: horário e "como termina" em **"Mais opções"**.

### Antes de 16/10
- **Sem "margem de folga"**: o tempo planejado já inclui pausas. O dia é definido pelo **horário** (de que horas a que horas) com pausas fixas, e o app sabe quanto do dia já passou.
- Firebase (o dono já tinha vários projetos no Supabase) + Vercel.
