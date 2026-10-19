# 4. Telas e opções

Referência de cada tela e janela, de cima para baixo. Arquivo do código entre parênteses.

---

## Entrar (`App.tsx`)

![Entrar](img/01-entrar.png)

- Título "Saiba quanto ainda cabe no seu dia." e o resumo **Como funciona** (3 passos + régua de exemplo).
- **Entrar com Google**. Erro de domínio não autorizado aparece embaixo do botão.

## Configuração inicial (`Onboarding.tsx`)

![Configuração inicial](img/02-configuracao-inicial.png)

Aparece enquanto o horário não foi definido.

| Passo | Conteúdo | Ações |
|---|---|---|
| 1. Bem-vindo ao Margem | Como funciona | Continuar |
| 2. Qual é o seu horário? | Editor de horário (igual ao de Tarefas) | Voltar · Salvar e começar |

Fechar (X, Esc ou fora) pula e mantém o horário padrão.

---

## Dia (`views.tsx`, `CapacityPanel.tsx`, `DaySidebar.tsx`, `TaskRow.tsx`)

![Dia](img/03-dia.png) ![Dia com detalhes](img/04-dia-detalhes.png)

**Cabeçalho**: "Hoje" ou o dia da semana, data, setas ‹ › para outros dias, **Hoje** (quando em outro dia), (?) Como funciona (celular).

**Topo do dia**

| Elemento | Detalhe |
|---|---|
| Título | Dá tempo: sobram X · Não dá tempo: X a mais · X feitos (dia encerrado) · Hoje sem horário |
| Frase | "Você tem 2h30 de tarefas e só 44min até as 18:00." |
| Horário | "Seu horário hoje: 08:00–18:00 (9h) · alterado só hoje · **Mudar**". Mudar abre, ali mesmo: início, fim, Salvar, Sem horário, Voltar ao padrão, Cancelar |
| Barra (linha do tempo) | início, **agora** e fim do horário marcados; verde = feito, cinza = sem registro, azul = a fazer, hachurado = sobra, vermelho depois do fim = não cabe |
| Sem registro | aparece com 5min ou mais: "43min já passaram sem nada registrado · **O que você fez?**" |
| Para dar tempo | aparece quando não dá tempo: até 4 tarefas com **Pular hoje** / **Amanhã** / **Encurtar para X** |
| Detalhes | recolhido; abre a legenda com o valor e a explicação de cada cor, e o total "extra" |

**Tarefas de hoje**

| Elemento | Detalhe |
|---|---|
| Campo "Nova tarefa, ex: Revisar PR 45m" | Enter cria no dia aberto; sem tempo, abre o formulário. Mostra uma prévia ("Enter cria … com 45min") |
| Aviso de atrasadas | só hoje: "N tarefas ficaram de dias anteriores · Xh" · **Trazer para hoje**; abrindo, **Hoje** em cada uma |
| Linha da tarefa | círculo (concluir) ou alvo (tarefa "cumpro o tempo") · nome (até 2 linhas) · progresso "feito de tempo" · horário · "● 12:03" se o timer está nela · "extra" · aviso de conflito · › · **▶ / ■** |
| Toque na linha | abre a **Janela da tarefa** |
| Ordem | primeiro as com horário (pela hora), depois as outras (pela criação) |
| Concluídas / Puladas | recolhido no fim, com contagem |

## Janela "O que você fez?" (`CapacityPanel.tsx`)

![O que você fez](img/05-o-que-voce-fez.png)

- "Falta distribuir X" / "Tudo distribuído" / "X a mais do que passou".
- Cada tarefa do dia: feito, **Tudo aqui**, − / + de 15 em 15 min.
- **Registrar X** cria um registro manual por tarefa, no dia aberto, sem horário.

## Janela da tarefa (`LogTimeForm.tsx`, `TimeEntries.tsx`)

![Janela da tarefa](img/06-janela-da-tarefa.png)

| Bloco | Conteúdo |
|---|---|
| Cabeçalho | nome da tarefa · **Editar** (abre o formulário) · fechar |
| Feito hoje / Feito em 18/10 | total do dia aberto, "de X", barra; "Encurtada só neste dia · Voltar ao normal" quando for o caso |
| Começar agora | **Cronômetro** · **Pomodoro 25min** (some se concluída ou pulada) |
| Timer rodando (no lugar do anterior) | "Cronômetro rodando", relógio, "Começou às 10:16 · Mudar", **Parar** |
| Adicionar tempo já feito | 15m · 30m · 1h · 2h · campo "3h 20m ou 14:00-15:30" + **Adicionar** · Quando: Hoje / Ontem / Outro dia · Nota |
| Registros | "Total X em N dias"; por dia (Hoje, Ontem, Sex 16/10…) com total; linha: horário ou "sem horário", nota, origem, tempo, ✎, 🗑; os 5 dias mais recentes e "Mostrar mais" |
| Editar registro (✎) | tempo ou intervalo, dia (Hoje/Ontem/Outro), nota, ✓ / ✕ |
| Rodapé | **Pular hoje** / Desfazer pulo (as que repetem) · **Mudar dia** (as de uma vez; menu abre para cima) · **Concluir** / Reabrir (só "marco como feita") |

---

## Formulário da tarefa (`TaskForm.tsx`)

![Nova tarefa](img/07-nova-tarefa.png) ![Mais opções](img/08-nova-tarefa-mais-opcoes.png) ![Editar](img/09-editar-tarefa.png)

| Campo | Opções |
|---|---|
| Nome | obrigatório |
| Uma vez / Repete | Uma vez: data · Repete: Seg…Dom |
| Quanto tempo leva / Meta de tempo | "45m, 1h30, 6h"; obrigatório |
| Mais opções › Horário | um ou mais trechos início–fim; "Adicionar outro horário"; o tempo vira a soma; "Permitir notificações para os avisos" |
| Mais opções › Como termina | Marco como feita · Cumpro o tempo |
| Avisos | conflito de horário com outras tarefas nos próximos 14 dias (não impede salvar) |
| Erros | sem nome, sem tempo, repete sem dia, horário que termina antes de começar |
| Rodapé (editar) | **Excluir** (confirmação) · **Desativar** / Reativar (só as que repetem) · Cancelar · **Salvar** |
| Rodapé (nova) | Cancelar · **Criar** |

"Mais opções" já vem aberto quando a tarefa tem horário ou é "cumpro o tempo".

---

## Tarefas (`TasksPage.tsx`)

![Tarefas](img/10-tarefas.png)

| Bloco | Conteúdo e ações |
|---|---|
| Seu horário | resumo ("Seg a Sex, 08:00–18:00 · Sáb, 09:00–12:00 · almoço 12:00–13:00") · **Editar** |
| Buscar tarefa | filtra pelo nome, sem acentos |
| Repetem | por linha: nome (abre a janela da tarefa), tempo editável, horário, "meta de tempo", "extra", botões **Seg…Dom**. Embaixo: **Fixas** e **Livre** por dia. Criação rápida "Nova que repete, ex: Academia 1h" |
| Não repetem | grupos Atrasadas, Hoje, Amanhã, Esta semana, Depois; por linha: nome (abre a janela da tarefa), tempo editável, horário, data (menu: Hoje, Amanhã, Próxima segunda, Outro dia). Criação rápida "Nova para hoje, ex: Revisar PR 45m" (sem tempo abre o formulário) |
| Desativadas | recolhido; nome abre a edição; **Reativar** |
| Conta | "Conectado como …" · **Sair** |

Tarefas de uma vez concluídas não aparecem aqui.

## Seu horário (`ScheduleEditor.tsx`)

![Seu horário](img/11-seu-horario.png)

- Por dia: liga/desliga, início, fim, total do dia. Atalho **Repetir segunda até sexta**.
- Pausas fixas: nome, início, fim, remover, **Adicionar pausa**.
- "Total na semana: Xh para tarefas". **Cancelar** · **Salvar**.

---

## Foco (`FocusView.tsx`)

![Foco](img/12-foco.png) ![Foco rodando](img/14-foco-rodando.png)

| Estado | Tela |
|---|---|
| Parado | Pomodoro / Cronômetro (abre no último modo usado) · relógio (25:00 ou 00:00) · "Pronto para começar" · tarefa (lista com as do dia, ou "Sem tarefa") · **Começar** |
| Foco rodando | modo · anel de progresso · "Foco" / "Contando" · tarefa · "Começou às … · Mudar" · **Parar e registrar** |
| Pausa pronta | **Começar pausa** · Encerrar · Pular pausa |
| Pausa rodando | Encerrar · **Próximo foco** |
| Próximo foco | **Começar foco** · Encerrar |

Embaixo: "Hoje · Xh registrados" (recolhido), com cada registro de hoje: horário, tarefa (trocável numa lista), origem, tempo, ✎, 🗑.

**··· Configurar pomodoro** (`PomodoroMenu`):

![Configurar pomodoro](img/13-pomodoro-config.png)

- Foco (5–180 min, passo 5) e Pausa (1–60 min).
- Início de foco automático · Pausas automáticas (desligados).
- Avisar quando o tempo acabar (permissão de notificação).

## Em que você trabalhou? (`FocusView.tsx › AssignDialog`)

Depois de um foco sem tarefa: escolha uma das tarefas abertas de hoje ou "Sem tarefa por enquanto". **Salvar**.

---

## Elementos globais

| Elemento | Onde | Detalhe |
|---|---|---|
| Barra do timer | flutuante, fora da aba Foco | relógio, tarefa ou "Pausa", "Começou às … · Mudar", Parar / Começar / Pular / Encerrar / Próximo conforme o estado; tocar abre Foco |
| Avisos (toasts) | rodapé, 3,5s | tempo registrado, menos de 1 minuto, tempo adicionado, início/pausa/fim de horário |
| Avisos de horário (`SlotAlerts.tsx`) | com o app aberto | início, pausa entre horários, recomeço e fim; tolerância de 2min; não repete ao recarregar |
| Como funciona (`Onboarding.tsx › HelpDialog`) | (?) | os 3 passos e a régua de exemplo |

![Dia com timer rodando](img/15-dia-timer-rodando.png) ![Como funciona](img/16-como-funciona.png)

Outros estados do Dia:

![Não dá tempo](img/19-dia-apertado.png) ![Dia sem tarefas](img/20-dia-vazio.png)

## No computador

![Dia no computador](img/17-dia-computador.png)
![Tarefas no computador](img/18-tarefas-computador.png)

Barra lateral com Nova tarefa, Dia, Tarefas, Foco, Como funciona, conta (Sair) e Recolher (lembrado no navegador). O conteúdo fica numa coluna central de até 768px.
