# 8. Ligar a cobrança

O código do Pro e do Mercado Pago já está pronto. Enquanto estes passos não forem feitos, **todo mundo usa o Pro de graça** e o botão de assinar não aparece.

## 1. Regras do Firestore (obrigatório, 2 min)

O arquivo `firestore.rules` ganhou a coleção `billing` (o app só lê; quem grava é o servidor).

Firebase Console › Firestore › **Regras** › colar o conteúdo de `firestore.rules` › **Publicar**.

## 2. Chave de servidor do Firebase (5 min)

1. Firebase Console › engrenagem › **Configurações do projeto** › **Contas de serviço**.
2. **Gerar nova chave privada** › baixa um arquivo `.json`.
3. Esse JSON inteiro vai na variável `FIREBASE_SERVICE_ACCOUNT` (passo 4). Não coloque no Git.

## 3. Mercado Pago (10 min)

1. Crie ou entre na conta em mercadopago.com.br/developers › **Suas integrações** › **Criar aplicação** (produto: Assinaturas).
2. **Credenciais de teste** primeiro: copie o *Access token* de teste para validar o fluxo com um comprador de teste.
3. Depois, **Credenciais de produção** › *Access token* (vai em `MP_ACCESS_TOKEN`).
4. **Notificações (webhooks)**: URL `https://margem-swart.vercel.app/api/mercadopago`, evento **Planos e assinaturas** (`subscription_preapproval`). Se o painel não oferecer esse evento, tudo bem: o app confere a assinatura ao voltar do pagamento e uma vez por dia.

## 4. Variáveis na Vercel

Vercel › projeto margem › **Settings** › **Environment Variables** (ambiente Production):

| Variável | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | o JSON do passo 2, inteiro |
| `MP_ACCESS_TOKEN` | o token do passo 3 |
| `NEXT_PUBLIC_SITE_URL` | `https://margem-swart.vercel.app` (ou o domínio próprio) |
| `NEXT_PUBLIC_BILLING_ENABLED` | `1` (é isto que liga a cobrança) |

Depois: **Deployments** › último › **Redeploy**.

## 5. Antes de anunciar

- [ ] Preencher `contactEmail` (e, se quiser, o nome completo em `owner`) em `src/lib/legal.ts`. A LGPD exige um canal de contato.
- [ ] Testar com credencial de teste: assinar, voltar ao app ("Assinatura confirmada"), cancelar.
- [ ] Revisar privacidade e termos com um advogado quando passar de algumas dezenas de assinantes.
- [ ] Domínio próprio (ex: margem.app) e trocar `NEXT_PUBLIC_SITE_URL`.

## Como funciona por dentro

- `POST /api/assinatura` cria a assinatura (preapproval) com `external_reference = uid` e devolve o link de pagamento.
- `POST /api/assinatura/sincronizar` busca no Mercado Pago a assinatura da pessoa e grava `billing/{uid}`.
- `POST /api/assinatura/cancelar` cancela; o Pro vale até `paidUntil`.
- `POST /api/mercadopago` recebe o aviso e só usa o id para buscar a assinatura com o nosso token.
- `src/lib/plan.ts` decide Grátis/Pro: assinatura ativa, ou paga até uma data futura, ou 14 dias desde a criação da conta.
