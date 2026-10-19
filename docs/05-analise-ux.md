# 5. Análise de UI/UX

Análise feita percorrendo o app com dados de exemplo (celular e computador) e lendo o código. O critério é o objetivo do app: **saber a qualquer hora quanto tempo ainda tenho e se dá tempo**, com o mínimo de esforço para manter os números certos.

Cada ponto traz o problema, a evidência, o impacto e uma proposta. A prioridade considera quanto o ponto atrapalha o uso diário e quanto custa mudar.

## Resumo

| # | Ponto | Prioridade | Esforço |
|---|---|---|---|
| 1 | Tocar numa tarefa faz coisas diferentes em cada tela | Alta | Baixo |
| 2 | Registros aparecem em três lugares, com três formatos | Alta | Médio |
| 3 | Janela da tarefa longa demais no celular | Alta | Médio |
| 4 | Tarefa de uma vez não tem "mudar data" no Dia | Alta | Baixo |
| 5 | Ações sem desfazer (apagar registro, pular, amanhã, trazer) | Alta | Médio |
| 6 | Falhas ao salvar passam em silêncio | Alta | Médio |
| 7 | Criação rápida se comporta diferente em cada campo | Média | Baixo |
| 8 | "Pausa" tem três significados | Média | Baixo |
| 9 | Foco começa em Pomodoro e o ▶ em Cronômetro | Média | Baixo |
| 10 | Permissão de notificação pedida em três lugares (uma de surpresa) | Média | Baixo |
| 11 | Não há visão dos próximos dias | Média | Médio |
| 12 | Tarefas de uma vez concluídas somem | Média | Baixo |
| 13 | Configurações espalhadas (conta dentro de Tarefas) | Média | Baixo |
| 14 | Alvos de toque pequenos no celular | Média | Baixo |
| 15 | Computador usa só uma coluna estreita | Baixa | Médio |
| 16 | Ajuda curta e textos repetidos na entrada | Baixa | Baixo |
| 17 | Ir para um dia específico só pelas setas | Baixa | Baixo |
| 18 | Estados vazios e de carregamento simples | Baixa | Baixo |

---

## Alta prioridade

### 1. Tocar numa tarefa faz coisas diferentes em cada tela

- **Evidência**: no Dia, tocar na tarefa abre a **janela da tarefa** (registrar, concluir, pular). Em Tarefas, tocar no nome abre o **formulário de edição**. Para editar a partir do Dia são dois toques (janela › Editar tarefa); para registrar a partir de Tarefas, não há caminho.
- **Impacto**: o mesmo gesto tem resultados diferentes e o usuário precisa lembrar onde está. É a principal causa da sensação de "telas avulsas".
- **Proposta**: tocar numa tarefa abre **sempre a janela da tarefa**, que passa a ser a "página da tarefa": registrar, histórico, concluir/pular e um **Editar** no topo. Em Tarefas, a linha continua com os atalhos (dias, tempo, data) e o toque no nome abre a mesma janela.

### 2. Registros aparecem em três lugares, com três formatos

- **Evidência**:
  - Janela da tarefa › Registros: histórico por dia, edita tempo, dia e nota.
  - Foco › "Hoje · Xh registrados": só hoje, edita só o tempo e troca a tarefa numa lista; não mostra nota.
  - "O que você fez?": cria registros, mas não mostra os existentes.
- **Impacto**: não há um lugar para ver "o que eu fiz hoje" em todas as tarefas com o formato novo. Registro sem tarefa só aparece em Foco.
- **Proposta**: um componente só de lista de registros (o de `TimeEntries.tsx`), usado na janela da tarefa (filtrado pela tarefa) e num bloco **"Registros de hoje"** no fim do Dia (todas as tarefas, com a tarefa em cada linha e "Sem tarefa" destacado). A lista de Foco passa a usar o mesmo componente ou sai.

### 3. Janela da tarefa longa demais no celular

- **Evidência**: [`img/06-janela-da-tarefa.png`](img/06-janela-da-tarefa.png). Ela tem resumo, começar timer, adicionar tempo (atalhos, campo, quando, nota), histórico e, no fim, Editar/Pular/Concluir. Com histórico, Concluir fica a várias rolagens de distância.
- **Impacto**: as ações mais comuns depois de registrar (concluir, pular) ficam escondidas.
- **Proposta**:
  - Ações (Concluir, Pular hoje, Editar) num rodapé fixo da janela ou logo abaixo do resumo.
  - "Adicionar tempo já feito" recolhido num botão; ao abrir, mostra atalhos, campo, quando e nota.
  - Histórico mostrando 3 dias e "Ver tudo".

### 4. Tarefa de uma vez não tem "mudar data" no Dia

- **Evidência**: a janela da tarefa oferece **Pular hoje** só para as que repetem. Para uma tarefa de uma vez, mudar a data só existe em Tarefas (menu de data) ou na sugestão "Para dar tempo" (Amanhã), que só aparece quando não dá tempo.
- **Impacto**: "não vou fazer isso hoje" é uma ação diária, e para tarefas de uma vez ela exige trocar de aba.
- **Proposta**: na janela da tarefa de uma vez, **Mudar dia** com Amanhã / Próxima segunda / Outro dia (o mesmo menu de Tarefas), no lugar de "Pular hoje".

### 5. Ações sem desfazer

- **Evidência**: apagar registro (lixeira) apaga na hora, sem confirmação. Pular hoje, Amanhã, Encurtar e Trazer para hoje tiram coisas da tela sem aviso. Excluir tarefa usa a confirmação nativa do navegador, diferente do resto do app.
- **Impacto**: um toque errado apaga horas registradas sem volta, e uma tarefa some da lista sem a pessoa entender para onde foi.
- **Proposta**: o aviso de rodapé ganha **Desfazer** (5s) para: registro apagado, pulada, movida para amanhã, encurtada, trazida para hoje e concluída. Excluir tarefa usa uma janela do próprio app.

### 6. Falhas ao salvar passam em silêncio

- **Evidência**: as gravações no Firestore (`db.ts`) não têm tratamento de erro nos componentes. Se a internet cair ou a gravação falhar, nada avisa.
- **Impacto**: o app mostra o tempo como registrado e depois ele some. Num app cujo valor é o número estar certo, isso quebra a confiança.
- **Proposta**: tratar erro de gravação em um lugar só (ex: um `save()` comum que mostra "Não foi possível salvar. Tentar de novo"), e ligar a persistência offline do Firestore para registrar sem internet.

---

## Média prioridade

### 7. Criação rápida se comporta diferente em cada campo

- **Evidência**: "Nova tarefa" no Dia sem tempo **abre o formulário**; "Nova que repete" sem tempo **abre o formulário**; "Nova para hoje" em Tarefas sem tempo **cria com 30min**.
- **Proposta**: o mesmo comportamento nos três. Sugestão: criar com um tempo padrão e mostrar o tempo destacado para ajustar na hora, ou abrir o formulário nos três.

### 8. "Pausa" tem três significados

- **Evidência**: pausa fixa do horário (almoço), pausa do pomodoro e **Pausar** tarefa (= arquivar).
- **Impacto**: "Pausadas" em Tarefas parece ter a ver com pomodoro ou almoço.
- **Proposta**: trocar **Pausar tarefa** por **Desativar** / "Desativadas" (ou "Arquivar"). Pausa fica só para intervalo.

### 9. Foco começa em Pomodoro e o ▶ em Cronômetro

- **Evidência**: o ▶ da linha usa o último modo usado (cronômetro por padrão). A aba Foco sempre abre em **Pomodoro**.
- **Proposta**: a aba Foco abre no último modo usado também.

### 10. Permissão de notificação pedida em três lugares

- **Evidência**: Foco › ··· › "Avisar quando o tempo acabar"; formulário com horário › "Permitir notificações para os avisos"; e um pedido automático do navegador **no primeiro Começar** de qualquer timer (`startTimer` em `pomodoro.ts`).
- **Impacto**: o pedido automático aparece sem contexto, e quem nega sem querer não tem um lugar claro para ligar de novo.
- **Proposta**: tirar o pedido automático. Pedir só quando o usuário liga algo que avisa (tarefa com horário, pomodoro), com uma frase dizendo para que serve, e ter um lugar fixo com o estado das notificações.

### 11. Não há visão dos próximos dias

- **Evidência**: a antiga visão da semana saiu. Para saber se amanhã está cheio, é preciso ir ao Dia e avançar com as setas. Em Tarefas, "Fixas/Livre" considera só as que repetem, sem as de uma vez.
- **Proposta**: em Tarefas, trocar "Fixas/Livre" por uma linha **"Esta semana"** com o livre real de cada dia (repetem + de uma vez daquele dia), tocável para abrir o dia. Assim a carga da semana aparece sem uma tela nova.

### 12. Tarefas de uma vez concluídas somem

- **Evidência**: em Tarefas, "Não repetem" mostra só as pendentes. Uma tarefa concluída por engano num dia passado só volta se você navegar até aquele dia.
- **Proposta**: um grupo recolhido **Concluídas (últimos 7 dias)** em "Não repetem", com Reabrir.

### 13. Configurações espalhadas

- **Evidência**: seu horário em Tarefas; pomodoro em Foco › ···; notificações em dois lugares; conta e Sair no fim de Tarefas (e na barra lateral no computador); recolher a barra no computador.
- **Impacto**: "onde eu mudo X?" não tem resposta óbvia, principalmente conta e notificações.
- **Proposta**: manter horário em Tarefas e pomodoro em Foco (estão perto de onde são usados) e criar um menu de **conta** (avatar no cabeçalho do celular) com: notificações, como funciona e sair. Tirar conta e Sair do fim de Tarefas.

### 14. Alvos de toque pequenos no celular

- **Evidência**: dias Seg…Dom em Tarefas (32×36px), tempo editável (cerca de 20px de altura), ✎ e 🗑 dos registros (32×32px), chips de data. O recomendado é 44×44px.
- **Proposta**: aumentar a área de toque desses botões no celular (pode manter o desenho com área invisível maior).

---

## Baixa prioridade

### 15. Computador usa só uma coluna estreita

- **Evidência**: [`img/17-dia-computador.png`](img/17-dia-computador.png). O conteúdo fica numa coluna de 768px e sobra muito espaço dos lados.
- **Proposta**: no Dia, em telas largas, duas colunas: topo do dia (fixo ao rolar) à esquerda e tarefas à direita. Em Tarefas, repetem e não repetem lado a lado.

### 16. Ajuda curta e textos repetidos na entrada

- **Evidência**: na entrada, o título e o subtítulo dizem quase a mesma coisa ("Saiba quanto ainda cabe…" / "Saiba a qualquer hora quanto tempo ainda tem…"). "Como funciona" explica só o Dia: não fala de Tarefas, Foco, pular, encurtar nem "O que você fez?".
- **Proposta**: subtítulo diferente do título (ex: "Diga seu horário, suas tarefas e registre o que fez. O app mostra se dá tempo."). "Como funciona" com uma seção curta por aba.

### 17. Ir para um dia específico só pelas setas

- **Proposta**: tocar na data do cabeçalho abre um calendário.

### 18. Estados vazios e de carregamento simples

- **Evidência**: "Carregando…" em texto; Foco sem registros mostra "Nada registrado ainda hoje."; Dia vazio sugere "Adicione acima ou pelo botão Nova tarefa".
- **Proposta**: Dia vazio com dois atalhos ("Criar tarefa", "Montar rotina em Tarefas"); carregamento com o esqueleto das telas.

---

## O que já funciona bem (manter)

- O topo do dia responde a pergunta do app numa linha, e "Para dar tempo" transforma o diagnóstico em ação.
- ▶ direto na tarefa e "Começou às… · Mudar" deixam registrar tempo quase sem esforço.
- Registrar com dia e nota, e o histórico por dia, deixam o tempo confiável.
- A grade de Tarefas permite ajustar a rotina sem abrir formulários.
- Avisos curtos confirmam o que aconteceu.

## Sugestão de ordem

1. **Consistência** (1, 4, 7, 8, 9): pouco esforço e tira a maior parte da confusão.
2. **Confiança nos números** (5, 6): desfazer e erros de gravação.
3. **Registros num lugar só** (2, 3): janela da tarefa mais curta e "Registros de hoje" no Dia.
4. **Planejamento** (11, 12): semana em Tarefas e concluídas.
5. Restante (10, 13–18).
