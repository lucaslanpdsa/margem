"use client";

import { useEffect } from "react";
import { SIGNED_IN_KEY } from "@/lib/legal";

/**
 * Quem já entrou no app vai direto para ele (inclusive quem instalou o app quando ele ficava em "/").
 * Mantém a aba do endereço (#tarefas). "?site" mostra a página de vendas mesmo assim.
 */
export function RedirectIfSignedIn() {
  useEffect(() => {
    try {
      if (window.location.search.includes("site")) return;
      if (localStorage.getItem(SIGNED_IN_KEY)) window.location.replace(`/app${window.location.hash}`);
    } catch {
      /* sem armazenamento: fica na página de vendas */
    }
  }, []);
  return null;
}
