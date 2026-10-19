---
description: Verifica, faz commit em português e publica o Margem (push na main = deploy na Vercel)
argument-hint: "[resumo da mudança]"
---

1. Rode o `/verificar` (lint, testes, build). Não publique com falha.
2. Confira `git status`: nada de arquivos temporários (`src/app/preview`, capturas soltas, `.env*`).
3. Documentação no mesmo commit, se a mudança tocou nisso: `docs/04-telas.md`, `docs/03-fluxos.md`, `docs/02-navegacao.md`, `docs/decisoes.md`, status em `docs/05-analise-ux.md`, imagens em `docs/img`.
4. Commit em português: título curto no formato `tipo(área): o que mudou` (feat, fix, refactor, docs, revert) e corpo em tópicos dizendo o que muda para quem usa.
5. `git fetch origin main && git rebase origin/main && git push origin HEAD:main`.
6. Diga ao dono, em poucas linhas e em termos de tela, o que mudou e que em 1–2 minutos aparece em margem-swart.vercel.app.

Mudança: $ARGUMENTS
