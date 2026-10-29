---
description: Sobe a prévia do Margem com dados de exemplo e captura as telas pedidas
argument-hint: "[cenário ou tela, ex: apertado, tarefas, janela da tarefa]"
---

Objetivo: ver a interface sem login, com dados de exemplo, e mostrar ao dono.

1. Suba o servidor em segundo plano: `npx next dev -p 3130` e espere `http://localhost:3130/dev` responder 200.
2. Endereços da prévia (`src/app/dev/page.tsx`, dados em `src/dev/fixtures.ts`):
   - `/dev?cenario=dia` (padrão) · `fila` · `leve` · `noite` · `apertado` · `timer` · `vazio` · `onboarding` · `entrar`
   - aba pelo hash: `#tarefas`, `#foco`
   - janela aberta: `?abrir=tarefa` · `nova` · `editar`
3. Capturas:
   - as da documentação: `python3 scripts/capturar-telas.py --url http://localhost:3130 [--so nome]` (salva em `docs/img`)
   - avulsas: Playwright (Python), celular 390×844 com `device_scale_factor=2` e computador 1280×860; esconda o indicador do Next com o CSS `nextjs-portal{display:none!important}`. Para trocar só o hash, vá antes para `about:blank`, senão a página não recarrega.
4. Olhe as imagens antes de mandar: texto cortado, sobreposição, coisas fora da tela.
5. Mande as capturas ao dono com uma legenda curta ("dados de exemplo").
6. Ao terminar, pare o servidor e apague `.next` se tiver sido criado só para isso.

Tela pedida: $ARGUMENTS
