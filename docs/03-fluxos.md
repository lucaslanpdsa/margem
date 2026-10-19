# 3. Fluxos

Cada fluxo tem o caminho principal e as variações. Os nomes de botões estão como aparecem na tela.

## 3.1 Primeiro acesso

```mermaid
flowchart LR
  A[Entrar com Google] --> B[Bem-vindo ao Margem<br/>como funciona] --> C[Qual é o seu horário?<br/>dias, início/fim, pausas] --> D[Salvar e começar] --> E[Dia vazio]
```

1. **Entrar com Google** (tela de entrada, com o resumo "Como funciona").
2. Janela **Bem-vindo ao Margem**: os 3 passos do app e a régua de exemplo. **Continuar**.
3. **Qual é o seu horário?**: marca os dias, escolhe início e fim de cada um, e as pausas fixas (almoço vem pronto). Atalho "Repetir segunda até sexta". **Salvar e começar**.
4. Fechar a janela (X ou fora dela) pula a configuração e mantém o horário padrão (seg a sex, 08–18, almoço 12–13).
5. Cai no **Dia**, sem tarefas: "Nenhuma tarefa neste dia. Adicione acima ou pelo botão Nova tarefa."

![Entrar](img/01-entrar.png) ![Configuração inicial](img/02-configuracao-inicial.png)

## 3.2 Montar a rotina (tarefas que repetem)

1. **Tarefas** › campo "Nova que repete, ex: Academia 1h" › Enter.
   - Com tempo no fim ("Academia 1h"): cria direto, nos dias que têm horário.
   - Sem tempo ("Academia"): abre o formulário para completar.
2. Ajustar os dias tocando em **Seg…Dom** na linha (não deixa ficar sem nenhum dia).
3. Ajustar o tempo tocando nele ("1h") e digitando ("1h30"), Enter.
4. Para horário fixo ou "cumpro o tempo": toque no nome › **Mais opções**.
5. Conferir **Fixas** e **Livre** embaixo da grade: quanto a rotina ocupa e quanto sobra em cada dia. Livre negativo (vermelho) = a rotina não cabe no seu horário daquele dia.

## 3.3 Criar uma tarefa de uma vez

| Por onde | Dia que recebe | Sem tempo informado |
|---|---|---|
| **Nova** (barra/botão) | o dia aberto no Dia | abre o formulário (tempo obrigatório) |
| Dia › "Nova tarefa, ex: Revisar PR 45m" | o dia aberto | abre o formulário |
| Tarefas › "Nova para hoje, ex: Revisar PR 45m" | hoje | **cria com 30min** |

Formulário: Nome · Uma vez / Repete · dia · Quanto tempo leva · Mais opções (horário, como termina). **Criar**.

## 3.4 Durante o dia: registrar tempo

```mermaid
flowchart TD
  S[Dia] --> P{Vai fazer agora?}
  P -- sim --> Play[▶ na tarefa<br/>ou janela › Cronômetro/Pomodoro]
  Play --> Run[Timer rodando<br/>conta ao vivo no dia]
  Run -- esqueci de dar play --> Adj[Começou às… › Mudar]
  Run --> Stop[■ Parar] --> T1[Aviso: 23min registrados em X]
  P -- já fiz --> Add[Toque na tarefa › Adicionar tempo já feito<br/>15m/30m/1h/2h ou 3h 20m / 14:00-15:30<br/>Quando: Hoje/Ontem/Outro dia · Nota]
  Add --> T2[Aviso: 1h adicionados em X · hoje]
  P -- passou tempo sem registrar --> Gap[Topo › O que você fez?<br/>distribui o tempo entre tarefas]
```

Regras:

- O ▶ usa o último modo usado (cronômetro por padrão).
- Parar com menos de 1 minuto não registra ("Menos de 1 minuto: não foi registrado").
- Começar timer em outra tarefa encerra e registra o anterior.
- Foco sem tarefa (só pela aba Foco): ao parar, pergunta "Em que você trabalhou?".
- O horário de início ajustado tem que ser de hoje e não pode ser no futuro.

## 3.5 Concluir, pular, encurtar

| Ação | Onde | Efeito |
|---|---|---|
| Concluir | círculo na linha · janela › Concluir | sai da lista (vai para "Concluídas"); o que faltava volta para a sobra |
| Concluir tarefa "cumpro o tempo" | automático | conclui quando o registrado chega na meta (ícone de alvo em vez de círculo) |
| Pular hoje | janela › Pular hoje · "Para dar tempo" | só tarefas que repetem; sai da conta do dia; desfazer na janela |
| Encurtar para X | "Para dar tempo" (tarefas "cumpro o tempo") | tempo só de hoje; "Voltar ao normal" na janela |
| Amanhã | "Para dar tempo" (tarefas de uma vez) | muda a data para o dia seguinte |

## 3.6 Dia apertado ("Não dá tempo")

1. O topo fica vermelho: **Não dá tempo: 43min a mais** e a barra mostra o vermelho depois da marca do fim do horário.
2. Abaixo aparece **Para dar tempo, tire 43min de hoje**, com até 4 tarefas (primeiro as sem horário, as maiores antes) e a ação de cada uma: **Pular hoje**, **Amanhã** ou **Encurtar para…**.
3. Se houver tempo sem registro, **O que você fez?** costuma resolver parte do aperto, porque o que foi feito e não registrado ainda conta como "falta".

## 3.7 Tarefas atrasadas

1. Tarefas de uma vez de dias anteriores, não concluídas, aparecem no Dia (só hoje) como aviso: **2 tarefas ficaram de dias anteriores · 1h05**.
2. **Trazer para hoje** muda a data de todas; abrindo o aviso, **Hoje** traz uma por vez.
3. Em Tarefas, elas aparecem no grupo **Atrasadas**, com a data em vermelho.

## 3.8 Pomodoro

```mermaid
stateDiagram-v2
  [*] --> Foco: Começar
  Foco --> PausaPronta: fim do foco (registra)
  Foco --> [*]: Parar e registrar
  PausaPronta --> Pausa: Começar pausa
  PausaPronta --> Foco: Pular pausa
  PausaPronta --> [*]: Encerrar
  Pausa --> ProximoFoco: fim da pausa
  Pausa --> Foco: Próximo foco
  Pausa --> [*]: Encerrar
  ProximoFoco --> Foco: Começar foco
  ProximoFoco --> [*]: Encerrar
```

- Com **Pausas automáticas** ligado, "Pausa pronta" vira "Pausa" direto. Com **Início de foco automático**, "Próximo foco" vira "Foco" direto. Os dois vêm desligados.
- Só o foco conta como feito.
- Avisos (notificação, se permitida, e bipe) no fim do foco e da pausa.

## 3.9 Horário da tarefa e avisos

1. Formulário › Mais opções › **Adicionar horário** (pode ter vários: 08–11 e 14–18). O tempo da tarefa vira a soma dos horários (dá para mudar).
2. Com o app aberto, no horário: "Trabalho começa agora (08:00–11:00)", "Trabalho: pausa até as 14:00", "Trabalho recomeça agora (14:00–18:00)", "Trabalho terminou por hoje".
3. Conflito com outra tarefa nos próximos 14 dias aparece como aviso no formulário (não impede salvar) e na linha do Dia.

## 3.10 Mudar o horário

- **De sempre**: Tarefas › Seu horário › Editar › dias, início/fim, pausas › Salvar.
- **Só de um dia**: Dia › Mudar › início/fim › Salvar · ou **Sem horário** · ou **Voltar ao padrão**.

## 3.11 Organizar e limpar

- **Pausar** (tarefas que repetem): formulário › Pausar. Some dos dias e vai para Tarefas › Pausadas › Retomar.
- **Excluir**: formulário › Excluir (confirmação do navegador). Os registros continuam.
- **Buscar**: Tarefas › Buscar tarefa (ignora acentos).
