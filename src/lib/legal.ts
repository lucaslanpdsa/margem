// Dados do responsável e do produto, num lugar só (página de vendas, privacidade, termos).
// Preencha `contactEmail` antes de cobrar: a LGPD exige um canal de contato para o titular dos dados.

export const LEGAL = {
  product: "Margem",
  /** Controlador dos dados (LGPD). Trocar pela empresa quando houver CNPJ. */
  owner: "Lucas, desenvolvedor responsável pelo Margem",
  contactEmail: "",
  updatedAt: "19 de outubro de 2026",
  city: "Brasil",
};

export const PRICES = {
  monthly: { amount: 9.9, label: "R$ 9,90", per: "por mês" },
  yearly: { amount: 79, label: "R$ 79", per: "por ano", note: "equivale a R$ 6,58 por mês" },
  trialDays: 14,
};

/** Marca no navegador de que a pessoa já entrou (a página inicial manda direto para o app). */
export const SIGNED_IN_KEY = "margem.entrou";

export const contactText = () => (LEGAL.contactEmail ? LEGAL.contactEmail : "o e-mail de contato (em breve nesta página)");
