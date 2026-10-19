import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

/** Cabeçalho e rodapé das páginas públicas (vendas, privacidade, termos). Renderizadas no servidor. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="h-7 w-7" />
        <span className="text-[17px] font-semibold tracking-tight">{LEGAL.product}</span>
      </Link>
      <Link href="/app" className="rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:bg-sunken">
        Entrar
      </Link>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-muted sm:px-6">
        <span>© 2026 {LEGAL.product}</span>
        <Link href="/privacidade" className="hover:text-ink">
          Privacidade
        </Link>
        <Link href="/termos" className="hover:text-ink">
          Termos de uso
        </Link>
        {LEGAL.contactEmail && (
          <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-ink">
            {LEGAL.contactEmail}
          </a>
        )}
      </div>
    </footer>
  );
}

/** Página de texto (privacidade, termos): largura de leitura e títulos consistentes. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-16 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Atualizado em {LEGAL.updatedAt}.</p>
        <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
