// Modelo de dados do Margem.
// Tudo fica em users/{uid}/... no Firestore. Datas de dia usam a chave local "yyyy-MM-dd".

export type Priority = 1 | 2 | 3; // 1 = alta, 2 = média, 3 = baixa

export type RepeatKind =
  | "once" // avulsa: um dia específico (ou sem dia = caixa de entrada)
  | "weekdays" // repete em dias fixos da semana
  | "weeklyGoal"; // meta de X minutos por semana, em qualquer dia

export interface Task {
  id: string;
  title: string;
  category?: string;
  priority: Priority;
  repeat: RepeatKind;
  /** Estimativa por dia/ocorrência, em minutos (para "once" e "weekdays"). */
  estimateMin: number;
  /** "once": dia planejado. Sem valor = caixa de entrada (ainda não planejada). */
  date?: string;
  /** "once": prazo opcional. */
  deadline?: string;
  /** "weekdays": 0 = domingo ... 6 = sábado. */
  weekdays?: number[];
  /** "weeklyGoal": minutos por semana. */
  weeklyGoalMin?: number;
  /** "once": concluída em (ISO). */
  completedAt?: string | null;
  /** "weekdays": dias concluídos { "2026-10-16": true }. */
  completions?: Record<string, boolean>;
  archived?: boolean;
  createdAt: string;
}

/** Pedaço de tempo reservado na agenda para uma tarefa. */
export interface Block {
  id: string;
  taskId: string;
  date: string; // dia do início
  start: string; // ISO
  end: string; // ISO
}

/** Tempo realmente trabalhado (pomodoro ou registro manual). */
export interface Session {
  id: string;
  taskId: string;
  date: string;
  minutes: number;
  kind: "pomodoro" | "manual";
  startedAt: string;
  endedAt: string;
}

export interface ActiveTimer {
  taskId: string;
  phase: "focus" | "break";
  startedAt: string; // ISO
  durationMin: number;
}

export interface Settings {
  /** Minutos disponíveis por dia da semana (0 = domingo). */
  capacityByWeekday: number[];
  /** Exceções para dias específicos { "2026-10-18": 120 }. */
  capacityOverrides: Record<string, number>;
  focusMin: number;
  breakMin: number;
  activeTimer?: ActiveTimer | null;
  /** Já passou pela configuração inicial. */
  onboarded?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  capacityByWeekday: [180, 240, 240, 240, 240, 240, 180],
  capacityOverrides: {},
  focusMin: 25,
  breakMin: 5,
  activeTimer: null,
};
