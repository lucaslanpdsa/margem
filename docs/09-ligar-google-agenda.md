# 9. Ligar o Google Agenda

O Margem lê (só lê) o Google Agenda. Para funcionar em produção, faça uma vez:

## 1. Google Cloud (projeto do Firebase, `margem-3c8a7`)

1. Abra [console.cloud.google.com](https://console.cloud.google.com) e escolha o projeto do Firebase.
2. **APIs e serviços › Biblioteca** › procure **Google Calendar API** › **Ativar**.
3. **APIs e serviços › Tela de consentimento OAuth** (ou "Google Auth Platform"):
   - Em **Acesso a dados / Escopos**, adicione `.../auth/calendar.readonly`.
   - Enquanto o app estiver em **Teste**, adicione seu e-mail em **Usuários de teste**. Só quem está lá consegue conectar.
4. **APIs e serviços › Credenciais**: abra o cliente **Web client (auto created by Google Service)** (é o que o login com Google do Firebase já usa).
   - Em **Origens JavaScript autorizadas**, adicione `https://margem-swart.vercel.app` (e `http://localhost:3000` para testar local).
   - Copie o **ID do cliente** e a **Chave secreta do cliente**.

## 2. Firebase

- **Configurações do projeto › Contas de serviço › Gerar nova chave privada**. Guarde o JSON (é o mesmo da cobrança).
- **Firestore › Regras**: publique o `firestore.rules` do repositório (ele fecha `agenda/{uid}` para o app).

## 3. Vercel (Settings › Environment Variables)

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | ID do cliente |
| `GOOGLE_CLIENT_ID` | o mesmo ID do cliente |
| `GOOGLE_CLIENT_SECRET` | chave secreta do cliente |
| `FIREBASE_SERVICE_ACCOUNT` | o JSON da conta de serviço, inteiro numa linha |

Depois, **Deployments › ⋯ › Redeploy** (variáveis novas só entram num deploy novo).

## 4. No app

Menu da conta › **Google Agenda** › **Conectar Google Agenda**. Como o app está em teste, o Google mostra "O Google não verificou este app": toque em **Avançado › Acessar margem (não seguro)**. Isso some depois da verificação.

## Para vender (depois)

Ler a agenda é uma permissão "sensível". Para sair do modo Teste (mais de 100 usuários, sem o aviso), o Google pede verificação do app: página inicial e política de privacidade no domínio, vídeo mostrando o uso da permissão e justificativa. Pode levar algumas semanas. A política de privacidade precisa citar o Google Agenda (só leitura, nada é guardado além do acesso).
