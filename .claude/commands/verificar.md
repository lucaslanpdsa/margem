---
description: Roda lint, testes e build do Margem e resume o resultado
---

Rode, nesta ordem, e pare no primeiro que falhar:

1. `npx eslint src`
2. `npm test`
3. `npm run build`

Se algo falhar, mostre o erro relevante (não o log inteiro) e corrija se a causa estiver clara. Lembre que `npx tsc --noEmit` acusa `LayoutProps` em `layout.tsx` por causa de tipos que só o build gera; o `npm run build` é a checagem que vale.

No fim, uma linha: "lint ok · N testes ok · build ok" (ou o que falhou).
