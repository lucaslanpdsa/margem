import { CalendarCheck, Check, Flame, Gauge, Play, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PRICES } from "@/lib/legal";
import { RedirectIfSignedIn } from "./_site/RedirectIfSignedIn";
import { SiteFooter, SiteHeader } from "./_site/SiteChrome";

// Página de vendas: renderizada no servidor (aparece no Google e abre rápido). O app fica em /app.
export const metadata: Metadata = {
  title: "Margem: saiba todo dia quanto tempo sobra para estudar",
  description:
    "Para quem trabalha e estuda: o Margem soma trabalho, estudo e o resto do dia, mostra se dá tempo hoje e ajuda a cumprir a meta da semana.",
};

const FEATURES = [
  {
    icon: Gauge,
    title: "Dá tempo hoje?",
    text: "Seu horário, suas tarefas e o que você já fez numa barra só. A qualquer hora: sobram 1h40 ou faltam 40min.",
  },
  {
    icon: CalendarCheck,
    title: "Meta da semana",
    text: "Estudo de 1h30 de segunda a sexta vira 7h30 na semana. Você vê quanto fez, quanto falta e quando ficou para trás.",
  },
  {
    icon: Play,
    title: "Recupere quando sobrar",
    text: "Sobrou tempo hoje e o estudo está atrasado? O app sugere quanto dá para recuperar e começa o pomodoro com um toque.",
  },
  {
    icon: Flame,
    title: "Constância",
    text: "Dias seguidos cumprindo o plano e as últimas semanas lado a lado. Para ver que está funcionando (ou não).",
  },
];

const STEPS = [
  { title: "Diga seu horário", text: "De que horas a que horas você tem no dia, com almoço e pausas." },
  { title: "Monte a rotina", text: "Trabalho, estudo, academia: quanto tempo cada um leva e em que dias." },
  { title: "Registre com um toque", text: "▶ na tarefa, pomodoro ou adicionar depois. O número é sempre o que você fez de verdade." },
];

const FAQ = [
  { q: "Substitui meu app de concurso ou cursinho?", a: "Não. Ele cuida do tempo; o plano de matérias e as questões continuam onde estão. O Margem mostra se o estudo cabe no seu dia e na sua semana." },
  { q: "E se meu horário de trabalho muda todo dia?", a: "Foi feito para isso. Nada é contado sozinho: só o que você registra. Dá para mudar o horário de um dia específico." },
  { q: "Preciso de cartão para testar?", a: `Não. Você usa o Pro por ${PRICES.trialDays} dias sem cartão. Depois, continua no grátis ou assina.` },
  { q: "Funciona no celular?", a: "Sim. Abra no navegador e adicione à tela inicial: vira um app, funciona sem internet e sincroniza quando a conexão volta." },
  { q: "Posso cancelar quando quiser?", a: "Sim, no próprio app, sem multa. Você continua com o Pro até o fim do período pago." },
];

export default function SalesPage() {
  return (
    <div className="min-h-screen bg-bg">
      <RedirectIfSignedIn />
      <SiteHeader />

      <main>
        {/* Promessa */}
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div>
            <p className="text-sm font-semibold text-accent">Para quem trabalha e estuda</p>
            <h1 className="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">Saiba todo dia quanto tempo sobra para estudar.</h1>
            <p className="mt-5 text-lg text-muted">
              O Margem soma o trabalho, o estudo e o resto do dia e responde: <b className="font-semibold text-ink">dá tempo hoje?</b> E te ajuda a fechar a meta da semana mesmo
              quando o trabalho aperta.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/app" className="inline-flex h-12 items-center rounded-xl bg-brand px-6 text-base font-semibold text-brand-ink hover:bg-brand/90">
                Começar grátis
              </Link>
              <span className="text-sm text-muted">{PRICES.trialDays} dias do Pro grátis · sem cartão</span>
            </div>
          </div>
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[28px] border border-line bg-surface shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/dia.png" alt="Tela do dia: dá tempo, sobram 40 minutos, com sugestão para recuperar o estudo" className="block w-full" />
          </div>
        </section>

        {/* O que faz */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Apps de estudo organizam matérias. O Margem organiza o seu tempo.</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-todo/10 text-todo">
                    <f.icon size={20} />
                  </span>
                  <div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="mt-1 text-muted">{f.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="order-2 mx-auto w-full max-w-sm overflow-hidden rounded-[28px] border border-line bg-surface shadow-xl lg:order-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/semana.png" alt="Constância: dias seguidos, a semana dia a dia e as últimas semanas" className="block w-full" />
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Comece em 2 minutos</h2>
            <ol className="mt-8 space-y-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="tabular grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-ink">{i + 1}</span>
                  <div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-1 text-muted">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-8 inline-flex items-center gap-2 text-sm text-muted">
              <Smartphone size={16} /> No celular e no computador, com ou sem internet.
            </p>
          </div>
        </section>

        {/* Preços */}
        <section id="precos" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Preço de um lanche por mês</h2>
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
              <PriceCard
                name="Grátis"
                price="R$ 0"
                per="para sempre"
                items={["Dá tempo hoje? com a barra do dia", "Tarefas que repetem e de uma vez", "Cronômetro e pomodoro", "Registros e histórico da tarefa"]}
              />
              <PriceCard
                highlight
                name="Pro"
                price={PRICES.monthly.label}
                per={`${PRICES.monthly.per} · ou ${PRICES.yearly.label} ${PRICES.yearly.per}`}
                items={["Tudo do grátis", "Meta da semana e atraso", "Encaixe: recupere quando sobrar tempo", "Constância: dias seguidos e últimas semanas"]}
              />
            </div>
            <p className="mt-6 text-center text-sm text-muted">
              {PRICES.trialDays} dias do Pro grátis ao criar a conta. Pagamento pelo Mercado Pago. Cancele quando quiser.
            </p>
          </div>
        </section>

        {/* Dúvidas */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dúvidas</h2>
          <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-medium marker:hidden">{f.q}</summary>
                <p className="mt-2 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/app" className="inline-flex h-12 items-center rounded-xl bg-brand px-6 text-base font-semibold text-brand-ink hover:bg-brand/90">
              Começar grátis
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function PriceCard({ name, price, per, items, highlight }: { name: string; price: string; per: string; items: string[]; highlight?: boolean }) {
  return (
    <div className={highlight ? "rounded-2xl border-2 border-brand bg-surface p-6" : "rounded-2xl border border-line bg-bg p-6"}>
      <p className="font-semibold">{name}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{price}</p>
      <p className="text-sm text-muted">{per}</p>
      <ul className="mt-5 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <Check size={16} className="mt-0.5 shrink-0 text-done" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
