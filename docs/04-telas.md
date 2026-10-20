# 4. Telas e opções

Referência de cada tela e janela, de cima para baixo. Arquivo do código entre parênteses. Imagens geradas pela prévia (`/dev`) com dados de exemplo.

---

## Páginas públicas (`src/app/page.tsx`, `privacidade/`, `termos/`, `_site/`)

Renderizadas no servidor. O app fica em **`/app`**.

| Página | Conteúdo |
|---|---|
| `/` Página de vendas | Promessa ("Saiba todo dia quanto tempo sobra para estudar"), **Começar grátis** (→ `/app`), 4 recursos, "Comece em 2 minutos", preços Grátis × Pro, dúvidas, rodapé com Privacidade e Termos. Quem já entrou é mandado para `/app` (marca `margem.entrou` no navegador); `/?site` mostra a página mesmo assim |
| `/privacidade` | Política de privacidade (LGPD): dados, finalidades e base legal, onde ficam, prazo, direitos e como exercer no app |
| `/termos` | Termos de uso: planos, teste de 14 dias, renovação, cancelamento, arrependimento de 7 dias, foro |

Responsável, e-mail de contato e preços ficam em `src/lib/legal.ts`.

## Entrar (`App.tsx`)

![Entrar](img/01-entrar.png)

- "Saiba quanto ainda cabe no seu dia." + "Diga seu horário e suas tarefas, registre o que fez, e o app mostra a qualquer hora se dá tempo."
- Resumo **Como funciona** (3 passos e régua de exemplo) e **Entrar com Google**. Erro de domínio não autorizado aparece embaixo do botão.
- Embaixo: "Ao entrar, você concorda com os termos de uso e a política de privacidade" e **Conhecer o Margem** (→ `/?site`).
- Enquanto carrega, um esqueleto da tela (sem texto "Carregando…").

## Configuração inicial (`Onboarding.tsx`)

![Configuração inicial](img/02-configuracao-inicial.png)

Aparece enquanto o horário não foi definido.

| Passo | Conteúdo | Ações |
|---|---|---|
| 1. Bem-vindo ao Margem | Como funciona | Continuar |
| 2. Qual é o seu horário? | Editor de horário (igual ao de Tarefas) | Voltar · Continuar |
| 3. Sua rotina (só conta sem tarefas) | **Trabalho** (liga/desliga, 4h · 6h · 8h por dia, seg a sex, "cumpro o tempo") e **O que você quer encaixar** (nome, Seg a sex · Seg a sáb · Todos os dias, 30min · 1h · 1h30 · 2h, "Meta da semana: 5h") | Voltar · Salvar e começar (cria as tarefas) |

Fechar (X, Esc ou fora) pula e mantém o horário padrão.

---

## Cabeçalho e navegação (`App.tsx`, `AccountMenu.tsx`)

| Elemento | Celular | Computador |
|---|---|---|
| Título e data | "Hoje" / dia da semana; **tocar na data abre o calendário** (só no Dia) | igual |
| Setas ‹ › e **Hoje** | no Dia | no Dia |
| Menu da conta | avatar no canto do cabeçalho | nome no rodapé da barra lateral |
| Abas | barra de baixo: Dia · Tarefas · **Nova** · Foco | barra lateral: **Nova tarefa** · Dia · Tarefas · Foco · Recolher |

**Menu da conta**

![Menu da conta](img/21-menu-da-conta.png)

- Nome e e-mail.
- **Notificações**: ativadas / "Ativar" / bloqueadas no navegador (com instrução) / não suportadas. É o lugar fixo para ligar os avisos.
- **Plano** (só com a cobrança ligada): "Pro grátis · faltam N dias · Assinar", "Plano grátis · Conhecer o Pro" ou "Assinatura Pro · Ver ou cancelar".
- **Seus dados**: **Baixar arquivo** (tudo da conta em JSON) e **Excluir conta…** (confirmação, pede o Google de novo, apaga tudo e volta para a página de vendas).
- **Como funciona**, **Sair** e os links Privacidade · Termos.

**Assinar** (`Pro.tsx`): Anual (R$ 79) ou Mensal (R$ 9,90), texto de renovação e reembolso, **Assinar** abre o pagamento do Mercado Pago. Ao voltar (`/app?assinatura=ok`), confirma e avisa. **Assinatura Pro**: plano, próxima cobrança ou até quando vale, **Cancelar assinatura** (confirmação).

---

## Dia (`views.tsx`, `CapacityPanel.tsx`, `DaySidebar.tsx`, `TaskRow.tsx`)

![Dia](img/03-dia.png) ![Dia com detalhes](img/04-dia-detalhes.png)

No computador, duas colunas: o topo do dia fica parado à esquerda e as tarefas e os registros rolam à direita.

![Dia no computador](img/17-dia-computador.png)

**Topo do dia**

| Elemento | Detalhe |
|---|---|
| Título | Dá tempo: sobram X · Não dá tempo: X a mais · X feitos (dia encerrado) · Hoje sem horário |
| Frase | "Você tem 2h30 de tarefas e só 44min até as 18:00." (+ "Horário só hoje." se o horário do dia foi alterado) |
| Barra (linha do tempo) | início, **agora** e fim do horário marcados; verde = feito, cinza = sem registro, azul = a fazer, hachurado = sobra, vermelho depois do fim = não cabe |
| Legenda | sempre visível embaixo da barra, só com as partes que existem: "Feito 1h55 · Sem registro 1h16 · A fazer 5h · Não cabe 1h · Sobra 30min" · **Detalhes ›**. Tocar abre os detalhes |
| Botões | **O que você fez?** (com 5min ou mais sem registro e alguma tarefa no dia) · **Como dar tempo** (quando não dá tempo) |
| Como dar tempo | recolhido; abre "Tire X de hoje com um destes:" e até 4 tarefas com **Pular hoje** / **Amanhã** / **Encurtar para X**, cada uma com Desfazer |
| Detalhes | recolhido; "Seu horário hoje: 08:00–18:00 (9h) · **Mudar**" (início, fim, Salvar, Sem horário, Voltar ao padrão, Cancelar) e a explicação de cada cor, com o total "extra". Em dia sem horário o botão é "Mudar horário deste dia" |

**Tarefas de hoje**

| Elemento | Detalhe |
|---|---|
| Campo "Nova tarefa, ex: Revisar PR 45m" | Enter cria no dia aberto; sem tempo, abre o formulário. Prévia "Enter cria … com 45min" |
| Aviso de atrasadas | só hoje: "N tarefas ficaram de dias anteriores · Xh" · **Trazer para hoje** (com Desfazer); abrindo, **Hoje** em cada uma |
| Linha da tarefa | círculo (concluir, com Desfazer) ou alvo (tarefa "cumpro o tempo") · nome (até 2 linhas) · progresso · horário · "● 12:03" se o timer está nela · "extra" · conflito · **▶ / ■** (contorno cinza; azul só com o timer rodando) |
| Toque na linha | abre a **Janela da tarefa** |
| Ordem | primeiro as com horário (pela hora), depois as outras (pela criação) |
| Concluídas / Puladas | recolhido no fim |
| Dia vazio | "Nenhuma tarefa neste dia." com **Criar tarefa** e **Montar rotina em Tarefas** |

![Dia sem tarefas](img/20-dia-vazio.png) ![Não dá tempo](img/19-dia-apertado.png)

**Encaixe** (Pro, no topo do dia, só hoje e quando dá tempo): "Sobram 40min hoje: dá para recuperar 40min de Estudar." · **Começar** (cronômetro). Usa a tarefa mais atrasada na semana que não tem horário fixo.

**Esta semana** (Pro; no computador embaixo do topo do dia, no celular depois das tarefas)

| Elemento | Detalhe |
|---|---|
| Linha por tarefa que repete | nome, "3h25 de 9h" (registrado de planejado na semana), barra (laranja se atrasada), "1h30 atrasado" · "em dia" · "semana cumprida" |
| Fim de semana | "Para fechar a semana faltam 4h até domingo." |
| Toque na linha | janela **Constância**: dias seguidos, esta semana, dia a dia (verde cumprido, laranja ficou para trás), "1h30 ficaram para trás" · **Recuperar** (começa o timer), últimas 5 semanas |
| No grátis | cartão "Esta semana · Pro" com **Conhecer o Pro** |

**Registros de hoje** (recolhido, com o total e "N sem tarefa")

![Registros de hoje](img/22-registros-de-hoje.png)

Todos os registros do dia, de todas as tarefas. Cada linha: tarefa, nota, horário · origem, tempo. **Tocar na linha edita**: tarefa, tempo/intervalo, dia, nota e 🗑 apagar (com Desfazer). Registro sem tarefa aparece com **Escolher tarefa**. O timer rodando aparece como "● rodando".

## Janela "O que você fez?" (`CapacityPanel.tsx`)

![O que você fez](img/05-o-que-voce-fez.png)

- "Falta distribuir X" / "Tudo distribuído" / "X a mais do que passou".
- Cada tarefa do dia: feito, **Tudo aqui**, − / + de 15 em 15 min.
- **Registrar X** cria um registro manual por tarefa, no dia aberto, sem horário (com Desfazer).

## Janela da tarefa (`TaskDialog.tsx`, `TimeEntries.tsx`)

![Janela da tarefa](img/06-janela-da-tarefa.png)

Abre ao tocar numa tarefa no Dia, em Tarefas ou na semana (aí mostra o dia da coluna tocada). **Um lugar só para a tarefa**, como no ClickUp: editar, registrar e ver os registros. Computador: detalhes à esquerda e tempo à direita. Celular: tempo primeiro, "Detalhes da tarefa" embaixo.

| Bloco | Conteúdo |
|---|---|
| Cabeçalho | nome editável (salva ao sair do campo ou Enter) · fechar |
| Detalhes | **Quando** (Uma vez: Hoje/Amanhã/Outro dia · Repete: Seg…Dom), **Quanto tempo leva** / **Meta de tempo**, **Horário** (vários, com aviso de conflito), **Como termina**. **Cada campo salva sozinho** (sem "Salvar"); erro aparece embaixo e não grava. Rodapé: **Excluir** (Desfazer) · **Desativar**/Reativar (as que repetem) · "As mudanças são salvas sozinhas." |
| Feito hoje / Feito em 18/10 | total do dia aberto, "de X", barra; "Encurtada só neste dia · Voltar ao normal" quando for o caso |
| Ações (dentro do resumo) | **Pular hoje** / Desfazer pulo (as que repetem) · **Mudar dia** (as de uma vez: Hoje, Amanhã, Próxima segunda, Outro dia) · **Concluir** / Reabrir (só "marco como feita"). Todas com aviso e Desfazer |
| Começar | **Começar cronômetro** (some se concluída ou pulada). O pomodoro fica no Foco, separado |
| Timer rodando (no lugar do anterior) | "Cronômetro rodando", relógio, "Começou às 10:16 · Mudar", **Parar** |
| Adicionar tempo já feito | botão recolhido; aberto: 15m · 30m · 1h · 2h · campo "3h 20m ou 14:00-15:30" + **Adicionar** · Quando: Hoje / Ontem / Outro dia · Nota |
| Registros | "Total X em N dias"; por dia com total; os 3 dias mais recentes e "Mostrar mais"; tocar num registro edita tempo, dia e nota, com 🗑 para apagar (Desfazer) |

---

## Formulário da tarefa (`TaskForm.tsx`, só para criar; editar é na janela da tarefa)

![Nova tarefa](img/07-nova-tarefa.png) ![Mais opções](img/08-nova-tarefa-mais-opcoes.png) ![Editar](img/09-editar-tarefa.png)

| Campo | Opções |
|---|---|
| Nome | obrigatório |
| Uma vez / Repete | Uma vez: **Hoje · Amanhã · Outro dia** (calendário) · Repete: Seg…Dom |
| Quanto tempo leva / Meta de tempo | "45m, 1h30, 6h"; obrigatório |
| Mais opções › Horário | um ou mais trechos início–fim; "Adicionar outro horário"; o tempo vira a soma; "Permitir notificações para os avisos" |
| Mais opções › Como termina | Marco como feita · Cumpro o tempo |
| Avisos | conflito de horário com outras tarefas nos próximos 14 dias (não impede salvar) |
| Erros | sem nome, sem tempo, repete sem dia, horário que termina antes de começar |
| Rodapé (editar) | **Excluir** (sem confirmação, com Desfazer; os registros ficam) · **Desativar** / Reativar (só as que repetem) · Cancelar · **Salvar** |
| Rodapé (nova) | Cancelar · **Criar** |

"Mais opções" já vem aberto quando a tarefa tem horário ou é "cumpro o tempo".

---

## Tarefas (`TasksPage.tsx`)

![Tarefas](img/10-tarefas.png)

Horário numa linha e a semana como agenda, na largura toda; no computador, "Repetem" ao lado de "Não repetem".

![Tarefas no computador](img/18-tarefas-computador.png)

| Bloco | Conteúdo e ações |
|---|---|
| Seu horário | uma linha: "Seu horário · Seg a Sex, 08:00–18:00 · Sáb, 09:00–12:00 · Almoço 12:00–13:00 · **Editar**" (no celular o horário desce para a linha de baixo) |
| Esta semana / Próxima | 7 dias com quanto sobra (verde) ou falta (vermelho); tocar no dia abre o Dia. **Computador: calendário** com as tarefas nos horários delas (o seu horário em branco, fora dele cinza, linha vermelha no agora, "extra" em laranja, concluídas em verde e riscadas); tarefas sem horário numa faixa "sem horário" em cima, com o tempo. **Celular:** faixa de dias; tocar num dia mostra a lista dele embaixo (hoje aberto), cada linha com horário (ou "sem horário"), nome e tempo, e **Abrir o dia ›**. **Tocar numa tarefa abre o formulário dela** (editar) |
| Buscar tarefa | filtra pelo nome, sem acentos |
| Repetem | por linha: nome (abre a janela da tarefa), tempo editável, horário, "meta de tempo", "extra", botões **Seg…Dom** abaixo do nome (ligado = azul claro, desligado = contorno; largura toda no celular). Criação rápida "Nova que repete, ex: Academia 1h" (sem tempo abre o formulário) |
| Não repetem | grupos Atrasadas, Hoje, Amanhã, Esta semana, Depois; por linha: nome (abre a janela), tempo editável, horário, data (menu: Hoje, Amanhã, Próxima segunda, Outro dia; com Desfazer). **Concluídas · últimos 7 dias** recolhido, com **Reabrir**. Criação rápida "Nova para hoje, ex: Revisar PR 45m" (sem tempo abre o formulário) |
| Desativadas | recolhido; nome abre a edição; **Reativar** |

## Seu horário (`ScheduleEditor.tsx`)

![Seu horário](img/11-seu-horario.png)

- Por dia: liga/desliga, início, fim, total do dia. Atalho **Repetir segunda até sexta**.
- Pausas fixas: nome, início, fim, remover, **Adicionar pausa**.
- "Total na semana: Xh para tarefas". **Cancelar** · **Salvar**.

---

## Foco (`FocusView.tsx`)

![Foco](img/12-foco.png) ![Foco rodando](img/14-foco-rodando.png)

Pomodoro avulso, no estilo do Pomofocus. **Não registra tempo e não fala de tarefas.**

| Elemento | Detalhe |
|---|---|
| Tela | abas **Foco / Pausa** (trocar zera e deixa a fase pronta) e o **anel que vai se preenchendo** com o relógio (azul no foco, verde na pausa) |
| Botões | **Começar foco** / **Começar pausa** · **Pausar** · **Continuar**; ⏭ pula para a próxima fase (foco pulado não conta) |
| Embaixo | "#2 · Hora de focar!" (ou o nome da tarefa escolhida) / "Hora da pausa!", "3 pomodoros hoje", **Zerar** |
| Tarefas (lista do pomodoro) | lista própria, como no Pomofocus: círculo concluir · nome (tocar = focar nesta; aparece embaixo do "#") · **feitos / estimados** · ✎ (nome, pomodoros estimados − +, Apagar com Desfazer). **Adicionar tarefa** e, quando há tarefas de hoje fora da lista, **Importar de hoje (N)** ao lado, que abre a escolha: caixa de marcar por tarefa com "~N pomodoros"; as "extra" (fora do seu horário, ex: academia) vêm desmarcadas; as desmarcadas ficam de fora até amanhã (apagadas da lista podem voltar). Sem nada escolhido, a primeira não concluída vira a do foco; concluir a escolhida passa para a próxima. Feitos acima do estimado ficam em laranja |
| ··· da lista | **Importar tarefas de hoje (N)** (só quando há algo novo; as abertas do Dia, estimativa sugerida = tempo que falta ÷ foco + pausa; não repete) · **Limpar concluídas** · **Limpar tudo** (com Desfazer) |
| Rodapé | "Pomodoros 2/5 · Termina às 18:18 (1h30)" (não concluídas; ciclo atual) |
| ··· | foco e pausa em minutos (a fase em andamento termina com o tempo antigo; a parada já mostra o novo), início automático, avisos |

O cronômetro (que registra) aparece só na barra flutuante, também nesta tela.

![Foco no computador](img/24-foco-computador.png)

**··· Configurar pomodoro**

![Configurar pomodoro](img/13-pomodoro-config.png)

- Foco (5–180 min, passo 5) e Pausa (1–60 min).
- Início de foco automático · Pausas automáticas (desligados).
- Avisar quando o tempo acabar (permissão de notificação).

---

## Elementos globais

| Elemento | Onde | Detalhe |
|---|---|---|
| Barra do timer | flutuante | **cronômetro** (em todas as telas, com bolinha vermelha piscando): tempo, tarefa, "Começou às … · Mudar", **Parar**; tocar abre a tarefa · **pomodoro** (fora do Foco, rodando ou pausado): "Pomodoro · Foco 15:59", **Continuar** ou **Pular** |
| Avisos (toasts) (`toast.tsx`) | rodapé | confirmação (3,5s), com **Desfazer** (6s), ou erro vermelho "Não foi possível salvar" |
| Sem internet | topo | "Sem internet · salva quando voltar"; as mudanças ficam no aparelho e são enviadas quando a conexão volta |
| Avisos de horário (`SlotAlerts.tsx`) | com o app aberto | início, pausa entre horários, recomeço e fim; tolerância de 2min; não repete ao recarregar |
| Como funciona (`Onboarding.tsx › HelpDialog`) | menu da conta | os 3 passos, a régua, o que cada aba faz e dicas |

![Aviso com Desfazer](img/23-desfazer.png) ![Dia com timer rodando](img/15-dia-timer-rodando.png) ![Como funciona](img/16-como-funciona.png)
