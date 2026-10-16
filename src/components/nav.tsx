"use client";

import { createContext, useContext } from "react";

/** Navegação entre abas a partir de qualquer tela (ex: "Focar nela" abre o Foco com a tarefa escolhida). */
export const NavCtx = createContext<{ goFocus: (taskId?: string) => void }>({ goFocus: () => {} });
export const useNav = () => useContext(NavCtx);
