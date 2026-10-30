# Decisões de produto

Registro do que foi decidido, e por quê, para não refazer o que já foi descartado. Mais recente primeiro. Ao tomar ou reverter uma decisão, acrescente aqui.

## Out 2026

### 30/10 (tarde) — Nova tela de Tarefas (desenho aprovado no canvas "Margem — nova tela de Tarefas")
- O dono queria criar, gerir e analisar melhor (citou Jira, ClickUp, Trello). **Quadro por status (A fazer/Fazendo/Feito) descartado**: não responde "cabe?", e tarefa que repete não tem um status só.
- **Computador**: "Semana" (quadro por dia, estilo Trello/Sunsama, com quanto cabe em cada dia) e "Lista" (tabela estilo ClickUp com filtros, semana e estimado × real). **Celular**: faixa da semana com rótulo e lista em cartões; sem quadro (arrastar no celular é ruim).
- **Prioridade = a ordem da fila do dia** (arrastar no quadro). Sem campo de prioridade (removido em 16/10 por confundir).
- **Um campo de criar** que entende repetição ("ter e qui", "seg a sex", "todo dia", "toda sexta", "às terças"). Um dia sozinho ("sexta") continua sendo data. Sem tempo, a que repete nasce com 30min (o texto avisa).
- Saíram: botões Seg…Dom em cada tarefa (mudava a rotina sem querer), divisão "Repetem/Não repetem", grupo "Depois" (confundia com a aba), calendário com horários da semana (agora é a agenda).

### 30/10 — Google Agenda: horários na agenda, o Dia para as tarefas
- O dono quer separar três coisas: **agenda** para se organizar com horários, **ponto** para ver que horas entrou e saiu do trabalho, **Dia/tempo** só para tarefas. As tasks do trabalho continuam no Jira.
- **Google Agenda só leitura.** Compromissos com horário saem do tempo livre do dia, como pausas (`agendaBreaks` em `dayMetrics`), e a fila passa por cima deles. O app nunca cria nem muda eventos (sincronizar nos dois sentidos é onde esse tipo de integração quebra).
- **Não contam**: evento de dia inteiro e evento marcado como **Disponível** no Google. É assim que um bloco de foco ("Estudar 19–21h"), que já é o tempo das tarefas, fica na agenda sem descontar em dobro. Convite recusado também não conta. Entram as agendas marcadas no Google.
- Com ponto e agenda juntos, o mesmo horário conta uma vez (as pausas se juntam).
- Acesso permanente guardado só no servidor (`agenda/{uid}`), para não pedir o Google de novo a cada hora. Custo: precisa de chave do Firebase e da chave secreta do Google na Vercel (`docs/09-ligar-google-agenda.md`). Para vender a assinatura com isso, o Google exige verificar o app (pode levar semanas); para o dono e testadores funciona sem.
- Descartadas: agenda própria dentro do app (o dono já se organiza no Google) e voltar a agenda/calendário visual (removida em 16/10 por complicar). No Dia, a agenda é só uma lista curta, depois das tarefas no celular.
- **Próximo passo a decidir:** com horários na agenda, o horário fixo nas tarefas, os conflitos e o "Cumpro o tempo" com horário podem sair.

### 29/10 (fim da tarde) — Trabalho vira ponto
- O dono percebeu que misturava a contagem de horas do trabalho com o planejamento de tarefas. **O trabalho deixa de ser tarefa e vira ponto**: entrada, pausas, saída, jornada do dia, **saída prevista** e saldo da semana. As tarefas usam só o tempo **fora** do trabalho. Pesquisa e opções no documento "Margem — Ponto separado das tarefas".
- **Caminho B (ponto simples)**. Regras da CLT (tolerância, banco de horas com prazo, avisos de intervalo, de hora extra e de 11h entre jornadas) ficaram para depois, só se fizer falta: o ponto do Margem é pessoal, não substitui o da empresa.
- Marcações são registro, então o "trabalhado" é honesto. O que falta da jornada é **previsto** a partir de agora (ou da entrada habitual), pulando as pausas fixas, e só ocupa o tempo; nunca conta como feito. Dia passado sem saída marcada não inventa horas.
- **Seu dia** (ex.: 07–23) passa a ser o tempo disponível, com o trabalho dentro; o "Extra" quase some.
- **Transformar a tarefa "Trabalho" em ponto**: convite uma vez no Dia (ou menu da conta › Ponto do trabalho). Jornada a partir da tarefa, registros com horário viram marcações, cronômetro rodando vira entrada, tarefa desativada, tudo com Desfazer. Os registros antigos dela não contam como tarefa (`work.taskId`), para não contar em dobro.
- Saldo da semana conta a partir do dia em que o ponto começou (`work.since`).
- **Entrar** abre o Planejar o dia (se ainda não planejou). "Fechar o dia" aparece 1h antes do fim do seu dia.
- Janelas (Modal) passaram a abrir no corpo da página: dentro da coluna "grudada" do Dia, ficavam atrás da lista.

### 29/10 (tarde) — O Margem abre e fecha o dia
- Diagnóstico com o dono (ele não sentia vontade de usar; o trabalho já está no Jira): o app pedia esforço todo dia (registrar tudo, estimar tudo) e devolvia valor tarde. O centro passa a ser **capturar, planejar e fechar**; o trabalho fica no Jira e entra só como bloco.
- **Modo leve** (menu da conta › Registrar tempo): sem ▶ (menos nas "Cumpro o tempo"), "Já passou" no lugar de "Sem registro", sem "O que você fez?", "Esta semana", encaixe e estimativas. A conta do dia continua honesta sem registro (relógio + o que falta). Contas novas começam no leve; as antigas, como estavam.
- **Bloco reservado** (decidido no mesmo dia; o dono pediu a recomendação): no modo leve, uma tarefa "Cumpro o tempo" **com horário** (ex: Trabalho 08–11 e 14–18) não deve a meta; o horário dela sai do tempo do dia, como uma pausa, e a fila passa por cima. Nada conta como feito (o "Feito" continua só com registros), então não contradiz "o horário não conta tempo sozinho". Sem horário, ela continua pedindo o cronômetro. Descartadas: deixar devendo as 7h (o dia ficava sempre "não dá tempo") e contar o horário que passou como feito (já recusado em 19/10). Consequência: no modo leve, "Seu horário" deve cobrir o dia todo (ex: 07:00–22:00), com o trabalho dentro como bloco. O dia só aparece como encerrado depois do fim do horário (`ended`), mesmo que os blocos ocupem o resto.
- **Revisto: caixa de entrada** (removida em 16/10) volta como **Depois**, com um momento certo (o planejar) e fora de todas as contas. **Lembrete** = de uma vez com dia e sem tempo.
- **Revisto: criar sem tempo**. Antes abria o formulário (19/10). Agora o tempo só é pedido quando a tarefa entra num dia, num toque (15min/30min/1h/2h ou Lembrete); Enter ainda abre o formulário.
- **Captura em uma linha** entende dia e tempo no fim: hoje, amanhã, depois de amanhã, dia da semana (o próximo, nunca hoje), "dia 10", "15/11", "1h".
- **Planejar o dia** (cartão até planejar ou "Agora não") e **Fechar o dia** (cartão depois do horário). O fechamento da manhã continua para quem não fechou à noite, agora com **Depois**.
- Ficaram para depois de 2 semanas de uso: avisos com o app fechado, áreas e revisão de domingo, projetos longos, Jira. Sinal para seguir: planejou o dia em 8 de 14 dias.

### 29/10 — Fila do dia, previsão, estimativas e fechamento
- **Fila do dia** (pedido do dono: "ter uma fila ajuda muito a organizar os dias"): a lista "Tarefas de hoje" ganhou ordem escolhida e **horário previsto** em cada tarefa, com **Agora** na primeira e a linha **Não cabe hoje**. Não é a "sugestão do que fazer agora" removida em 16/10: a ordem é sempre da pessoa, o app nunca reordena.
- Mover: menu **⋮** (Fazer agora, Subir, Descer) no celular e arrastar no computador (arrastar continua descartado na semana).
- **Tarefa com horário ainda por vir fica no horário dela**; quando o horário passa, o que falta vai para a fila. A previsão usa o que falta pelos registros (nunca supõe horário cumprido) e o total que não cabe bate com o "Não cabe" do topo.
- Ordem guardada por dia em `days/{data}.order`. Trazida de dia anterior entra no **fim** da fila.
- **Estimado vs. realizado** (Pro): ao concluir pelo círculo, a estimativa daquele momento é guardada (`estAtDone`). O fator só aparece com 10+ tarefas com registro e **só mostra, não muda estimativas**. "Cumpro o tempo" e tarefas sem registro ficam de fora.
- **Fechamento do dia**: o aviso de atrasadas virou a decisão de cada uma (hoje, outro dia, excluir) com o resumo de ontem. Feito na abertura do dia seguinte (aviso com o app fechado continua adiado). Sem "backlog": a caixa de entrada continua removida. A fotografia do dia (`days/{data}`: planejado, feito) guarda o histórico para "dias em que o plano coube".
- **Mudar dia mostra quanto sobra** em cada opção ("sobra 1h20", "não cabe · +30min"). Fila para dias futuros não foi feita: a rotina é quase toda de tarefas que repetem.
- Fila grátis (faz abrir o app todo dia); estimativas no Pro.

### 20/10 — Semana como agenda em Tarefas
- "Esta semana" deixou de ser só números ("-2h37") e mostra **as atividades de cada dia** (colunas no computador; dia escolhido no celular). Assim Tarefas mostra a rotina como a gente pensa nela: "o que tenho na quarta?". Só leitura; mudar continua na grade e nos formulários (arrastar segue descartado).
- "Seu horário" virou uma linha compacta em cima da semana.
- Na agenda da semana, **tocar numa atividade abre o formulário da tarefa** (exceção à regra "tocar abre a janela da tarefa": a janela mostra o dia aberto no Dia, não o da coluna, e em Tarefas o objetivo é editar).
- A semana em Tarefas virou **calendário com horários** no computador (pedido do dono: "devia ser tipo um calendário"). Antes as colunas só tinham nomes e os horários tinham sido tirados; sem horário não dava para ver a rotina. Tarefas sem horário ficam numa faixa em cima, como "dia inteiro". Depois: **fechado por padrão** ("Ver horários"), porque ocupava a tela toda e a prioridade em Tarefas são as listas.
- **Janela da tarefa e formulário de edição viraram um modal só** (como no ClickUp): detalhes editáveis e tempo/registros juntos, cada campo salva sozinho. O formulário ficou só para criar. A antiga regra "na semana, tocar abre o formulário" deixou de existir: tudo abre a mesma janela.
- **Objetivos do dia dentro da tarefa** (pedido do dono, que planeja o dia seguinte puxando tickets do Jira): lista para marcar na janela da tarefa, sem tela nova. Sem tempo por objetivo, para o número continuar certo; "Levar para amanhã" para não reescrever; contagem "1/3" na linha do Dia. Grátis, porque é o que faz abrir o app todo dia. Não é um gerenciador de tickets: sem prioridade, prazo ou responsável.

### 20/10 — Foco = pomodoro avulso (estilo Pomofocus)
- O Foco não fala mais de cronômetro nem de registros: abas Foco/Pausa, Começar/Pausar/Continuar, pular, contador "#" do dia, cor muda na pausa.
- Visual: volta o **anel que vai se preenchendo** (o cartão colorido do Pomofocus foi testado e o dono preferiu o anel).
- **Lista de tarefas do pomodoro, igual ao Pomofocus** (revisto no mesmo dia, a pedido do dono): lista própria, estimativa em pomodoros definida pela pessoa, feitos contam por foco completo, "Termina às". **Importar tarefas de hoje** traz as do app com sugestão (tempo que falta ÷ foco + pausa); depois disso são independentes. Não registra nem mexe em horas. (Antes, no mesmo dia: contagem automática nas tarefas do app com estimado derivado; trocada porque o estimado precisa ser da pessoa e não pode mudar com o tamanho do pomodoro.)
- O cronômetro aparece **só na barra flutuante, em todas as telas** (inclusive no Foco), com bolinha vermelha, para não esquecer que está registrando.

### 20/10 — Pomodoro separado do registro de horas
- **O pomodoro não registra mais tempo.** É só o ritmo (foco, pausa, avisos, início automático no estilo Pomofocus). **Quem registra é o cronômetro**, um registro do início ao fim. Os dois podem rodar juntos no Foco.
- Por quê: cada fase gravando um registro criava muitos caminhos e bugs (app fechado no meio do ciclo, dois aparelhos abertos, registros picados de 25/5min, pausas virando "sem registro").
- **Substitui** o "Contar as pausas por tarefa" (feito na mesma manhã): com o cronômetro rodando, a pausa conta naturalmente; para não contar, pare o cronômetro na pausa.
- Saíram: o ▶ "no último modo usado" (agora sempre cronômetro), o botão "Pomodoro" da janela da tarefa, "Em que você trabalhou?" (o cronômetro sempre tem tarefa). Timer antigo em andamento é convertido (foco vira cronômetro; pausa some). Registros antigos de pomodoro ficam como estão.

### 20/10 — Pausa do pomodoro pode contar, por tarefa
- Revisto o "só o foco conta" de 16/10: no trabalho do dono a pausa faz parte do expediente.
- **Por tarefa, não global**: "Trabalho" conta as pausas, "Estudar" não (a meta da semana e a constância continuam honestas). A chave fica no **Foco**, abaixo da tarefa escolhida, e é guardada na tarefa (`countBreaks`), então vale também para o ▶. A configuração inicial já cria "Trabalho" com ela ligada.
- Considerado e não feito (por ora): mostrar a pausa como "Pausa" na barra do dia para tarefas que não contam (hoje ela aparece como "sem registro").

### 19/10 — Produto pago para quem trabalha e estuda
- **Público**: quem trabalha e estuda (ver [06](06-publico-alvo.md)); plano em [07](07-plano-assinatura.md).
- **Meta da semana sem campo novo**: é a soma do planejado nos dias da tarefa. As metas semanais antigas (removidas em 16/10) eram outro tipo de tarefa e confundiam; esta é só um acompanhamento das tarefas que repetem.
- **Número registrado sempre**: concluir pelo círculo cumpre o dia (atraso, constância), mas a semana mostra só horas registradas.
- **Encaixe** só para tarefas sem horário fixo (academia às 18:30 não se recupera à tarde).
- **App em `/app`, vendas em `/`** (servidor, aparece em buscas). Quem já entrou é redirecionado; atalhos antigos com `#aba` continuam funcionando.
- **Pro = semana, encaixe, constância.** O grátis continua com tudo o que já existia. Teste de 14 dias pela data de criação da conta, sem cartão e sem gravar nada.
- **Cobrança**: Mercado Pago (assinatura sem plano). A situação fica em `billing/{uid}`, gravada só pelo servidor; o app só lê. Avisos do Mercado Pago só disparam uma nova leitura na API (não confiamos no conteúdo). Sem as chaves, todo mundo é Pro.
- **LGPD**: política e termos em linguagem simples, baixar dados e excluir conta no app. O e-mail de contato fica para o dono preencher em `src/lib/legal.ts`.
- **Adiado**: lembrete com o app fechado (precisa de chave do Firebase e agendador).

### 19/10 — Revisão de design
- **Topo do Dia enxuto**: legenda curta sempre visível (tocar abre Detalhes); horário do dia e "Mudar" foram para Detalhes; "Para dar tempo" virou o botão **Como dar tempo** (recolhido). Objetivo: a lista de tarefas aparecer na primeira tela do celular.
- **Vermelho só no número e na barra.** Sugestões e aviso de atrasadas em cinza.
- **Azul forte só para ação.** ▶ da linha em contorno (azul só rodando); dias ligados em azul claro (Tarefas e formulário). Seta › da linha da tarefa saiu (a linha toda abre).
- **Registros: tocar na linha edita** (lápis e lixeira saíram da lista; apagar fica na edição).
- Barra do timer compacta; escolha de tarefa do Foco em lista própria; dia da tarefa com Hoje · Amanhã · Outro dia.
- **Identidade: fica o azul de antes.** Testadas 3 opções; "Papel" (fundo creme) pareceu pouco profissional; "Grafite" (ações em preto) foi aplicada e revertida no mesmo dia porque ficou "preto e branco, sem vida".
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
