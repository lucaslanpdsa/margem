"use client";

import dynamic from "next/dynamic";

// O app inteiro roda no navegador (Firebase + agenda), então não renderiza no servidor.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => <div className="grid min-h-screen place-items-center text-muted">Carregando…</div>,
});

export default function Page() {
  return <App />;
}
