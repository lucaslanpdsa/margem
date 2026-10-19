# Documentação do Margem

O Margem responde duas perguntas: **quanto tempo eu ainda tenho hoje?** e **dá tempo de fazer o que falta?**

Esta pasta descreve o app como ele está (outubro de 2026): o que cada tela faz, todos os fluxos e opções, e uma análise de UI/UX com o que pode melhorar.

| Documento | O que tem |
|---|---|
| [1. Conceitos e contas](01-conceitos.md) | Glossário (tarefa, horário, feito, sobra…) e como cada número é calculado |
| [2. Navegação](02-navegacao.md) | Mapa de telas e janelas, e por onde se chega em cada uma |
| [3. Fluxos](03-fluxos.md) | Passo a passo dos fluxos: primeiro acesso, criar tarefa, registrar tempo, dia apertado… |
| [4. Telas e opções](04-telas.md) | Referência de cada tela e janela, com todas as opções |
| [5. Análise de UI/UX](05-analise-ux.md) | Problemas encontrados, com evidência, proposta, prioridade e status |
| [Decisões](decisoes.md) | O que foi decidido e o que foi descartado, com o porquê |

As imagens em [`img/`](img) são geradas pela prévia com dados de exemplo (`/dev`, só em desenvolvimento) com `python3 scripts/capturar-telas.py`, no celular (390px) e no computador (1280px).

Para manter esta documentação viva: ao mudar uma tela ou fluxo, atualize a página correspondente em `04-telas.md`, o diagrama em `02-navegacao.md` se mudar o caminho, `decisoes.md` se for uma decisão de produto, e regenere as imagens afetadas. O guia para o Claude está em [`../CLAUDE.md`](../CLAUDE.md).
