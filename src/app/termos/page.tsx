import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, PRICES, contactText } from "@/lib/legal";
import { LegalPage } from "../_site/SiteChrome";

export const metadata: Metadata = { title: "Termos de uso · Margem" };

// Termos em linguagem simples, com o que o Código de Defesa do Consumidor exige para assinatura online.
export default function Termos() {
  return (
    <LegalPage title="Termos de uso">
      <p>
        Ao usar o {LEGAL.product} você concorda com estes termos. O serviço é oferecido por {LEGAL.owner}. Dúvidas: {contactText()}.
      </p>

      <h2>O que é o serviço</h2>
      <p>
        Um app para organizar o tempo do dia e da semana: horário, tarefas, registros de tempo, metas e constância. Ele mostra contas a partir do que você informa; as decisões
        sobre a sua rotina são suas.
      </p>

      <h2>Sua conta</h2>
      <ul>
        <li>Você entra com uma conta Google e é responsável pelo que acontece nela.</li>
        <li>Para maiores de 18 anos, ou menores com autorização de um responsável.</li>
        <li>Não use o serviço para atividades ilegais nem tente acessar dados de outras pessoas.</li>
      </ul>

      <h2>Planos e pagamento</h2>
      <ul>
        <li>
          <b>Grátis:</b> o dia, as tarefas, o timer e os registros, sem prazo.
        </li>
        <li>
          <b>Pro:</b> {PRICES.monthly.label} {PRICES.monthly.per} ou {PRICES.yearly.label} {PRICES.yearly.per}, cobrados pelo Mercado Pago com renovação automática no mesmo
          valor, até você cancelar.
        </li>
        <li>
          <b>Teste:</b> toda conta nova tem {PRICES.trialDays} dias do Pro sem cobrança e sem cartão. Ao fim, volta para o grátis se você não assinar.
        </li>
        <li>Mudança de preço é avisada com pelo menos 30 dias de antecedência e só vale na renovação seguinte.</li>
      </ul>

      <h2>Cancelamento e reembolso</h2>
      <ul>
        <li>Cancele quando quiser no app (menu da conta › Assinatura) ou na sua conta do Mercado Pago, sem multa.</li>
        <li>O Pro continua até o fim do período já pago; não há cobrança nova.</li>
        <li>
          <b>Direito de arrependimento:</b> em até 7 dias da primeira cobrança, você pode pedir o reembolso integral (art. 49 do Código de Defesa do Consumidor) por{" "}
          {contactText()}.
        </li>
      </ul>

      <h2>Disponibilidade</h2>
      <p>
        Trabalhamos para o app funcionar sempre, mas podem ocorrer falhas ou manutenções. O app guarda uma cópia dos dados no aparelho e sincroniza quando a conexão volta.
        Recomendamos baixar seus dados de vez em quando (menu da conta › Seus dados).
      </p>

      <h2>Limites de responsabilidade</h2>
      <p>
        O {LEGAL.product} é uma ferramenta de organização. Não nos responsabilizamos por resultados em provas, concursos ou no trabalho, nem por perdas causadas por uso
        indevido da conta. Nada aqui limita direitos que a lei garante ao consumidor.
      </p>

      <h2>Encerramento</h2>
      <p>
        Você pode excluir a conta a qualquer momento. Podemos suspender contas que violem estes termos, com aviso, salvo em caso de abuso grave. O tratamento dos seus dados está
        na <Link href="/privacidade">política de privacidade</Link>.
      </p>

      <h2>Lei e foro</h2>
      <p>Valem as leis do Brasil. Fica eleito o foro do seu domicílio, como prevê o Código de Defesa do Consumidor.</p>
    </LegalPage>
  );
}
