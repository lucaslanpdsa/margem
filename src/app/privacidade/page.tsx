import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, contactText } from "@/lib/legal";
import { LegalPage } from "../_site/SiteChrome";

export const metadata: Metadata = { title: "Política de privacidade · Margem" };

// Texto em linguagem simples, seguindo a LGPD (Lei 13.709/2018). Revisar com um advogado antes de escala grande.
export default function Privacidade() {
  return (
    <LegalPage title="Política de privacidade">
      <p>
        Esta política explica quais dados o {LEGAL.product} usa, para quê, onde ficam e como você controla tudo. O responsável pelos dados (controlador, na LGPD) é {LEGAL.owner}.
        Para qualquer pedido sobre seus dados, escreva para {contactText()}.
      </p>

      <h2>Quais dados usamos</h2>
      <ul>
        <li>
          <b>Conta Google:</b> nome, e-mail e foto, recebidos quando você entra com o Google. Não temos acesso à sua senha.
        </li>
        <li>
          <b>O que você cadastra:</b> seu horário, tarefas, registros de tempo e notas, e as preferências do app (pomodoro, notificações).
        </li>
        <li>
          <b>Assinatura:</b> se você assinar o Pro, guardamos a situação da assinatura (ativa, cancelada) e o identificador dela no Mercado Pago. Os dados do cartão ou do Pix
          ficam só com o Mercado Pago; nunca passam por nós.
        </li>
        <li>
          <b>Dados técnicos:</b> registros de acesso dos servidores (endereço IP, data e hora), mantidos pelos provedores de hospedagem por segurança.
        </li>
      </ul>
      <p>Não usamos seus dados para publicidade, não vendemos e não compartilhamos com ninguém além dos provedores abaixo.</p>

      <h2>Para que usamos e com qual base legal</h2>
      <ul>
        <li>
          <b>Fazer o app funcionar</b> (mostrar seu dia, suas tarefas e seus registros em qualquer aparelho): execução do contrato com você (art. 7º, V).
        </li>
        <li>
          <b>Cobrar a assinatura</b> e cumprir obrigações fiscais: execução do contrato e obrigação legal (art. 7º, II e V).
        </li>
        <li>
          <b>Segurança e prevenção de abuso</b> (registros de acesso): legítimo interesse (art. 7º, IX) e Marco Civil da Internet.
        </li>
      </ul>

      <h2>Onde os dados ficam</h2>
      <p>
        Usamos o Google Firebase (login e banco de dados), a Vercel (hospedagem do site) e o Mercado Pago (pagamentos). Os servidores do Google e da Vercel podem ficar fora do
        Brasil; essa transferência internacional segue as cláusulas de proteção de dados desses provedores (art. 33 da LGPD). Seus dados ficam separados por conta: só você,
        logado, consegue ler e alterar os seus.
      </p>
      <p>
        O app também guarda uma cópia dos seus dados no seu aparelho, para funcionar sem internet. Essa cópia some quando você sai da conta ou limpa os dados do navegador. Não
        usamos cookies de rastreamento ou de publicidade; só o armazenamento necessário para o login e para funcionar sem internet.
      </p>

      <h2>Por quanto tempo</h2>
      <p>
        Enquanto sua conta existir. Ao excluir a conta, apagamos na hora as tarefas, registros e preferências. Cópias de segurança dos provedores são apagadas no ciclo deles
        (em geral, até 30 dias). Dados de pagamento podem ser mantidos pelo prazo exigido pela lei fiscal.
      </p>

      <h2>Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
      <ul>
        <li>
          <b>Acessar e levar seus dados:</b> no app, menu da conta › <b>Seus dados</b> › <b>Baixar meus dados</b> (arquivo com tudo).
        </li>
        <li>
          <b>Corrigir:</b> direto no app, editando tarefas e registros.
        </li>
        <li>
          <b>Excluir:</b> menu da conta › <b>Seus dados</b> › <b>Excluir minha conta</b>.
        </li>
        <li>
          <b>Tirar dúvidas, revogar consentimento ou reclamar:</b> escreva para {contactText()}. Você também pode procurar a ANPD (Autoridade Nacional de Proteção de Dados).
        </li>
      </ul>

      <h2>Menores de idade</h2>
      <p>O {LEGAL.product} é para maiores de 18 anos. Se você é menor, use só com autorização de um responsável.</p>

      <h2>Mudanças</h2>
      <p>
        Se esta política mudar de forma importante, avisamos no app antes de valer. Veja também os <Link href="/termos">termos de uso</Link>.
      </p>
    </LegalPage>
  );
}
