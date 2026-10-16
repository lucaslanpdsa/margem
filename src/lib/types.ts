// Modelo de dados do Margem.
// Tudo fica em users/{uid}/... no Firestore. Datas de dia usam a chave local "yyyy-MM-dd".

export type RepeatKind =
  | "once" // uma vez, num dia (sem dia = hoje, de versões antigas)
  | "weekdays"; // repete em dias fixos da semana

export interface Task {
  id: string;
  title: string;
  repeat: RepeatKind;
  /** Estimativa por dia/ocorrência, em minutos (para "once" e "weekdays"). */
  estimateMin: number;
  /** "once": dia planejado. Sem valor = hoje. */
  date?: string;
  /** Como termina: marcando como feita (padrão) ou cumprindo o tempo (ex: trabalhar 6h). */
  doneBy?: "check" | "time";
  /** Horários na agenda, ex: [{ start: "08:00", end: "11:00" }, { start: "14:00", end: "18:00" }]. */
  slots?: TimeSlot[] | null;
  /** (Antigo) horário de início único; a duração vinha da estimativa. Lido como um slot. */
  time?: string | null;
  /** "weekdays": 0 = domingo ... 6 = sábado. */
  weekdays?: number[];
  /** "once": concluída em (ISO). */
  completedAt?: string | null;
  /** "weekdays": dias concluídos { "2026-10-16": true }. */
  completions?: Record<string, boolean>;
  /** "weekdays": dias pulados { "2026-10-16": true }. Saem da conta do dia, sem contar como feitos. */
  skipped?: Record<string, boolean>;
  archived?: boolean;
  createdAt: string;
}

export interface TimeSlot {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

/** Pedaço de tempo reservado na agenda para uma tarefa. */
export interface Block {
  id: string;
  taskId: string;
  date: string; // dia do início
  start: string; // ISO
  end: string; // ISO
  /** Gerado a partir dos horários da tarefa (não existe no banco). */
  virtual?: boolean;
  /** Qual horário da tarefa gerou este bloco. */
  slot?: number;
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
  /** Pomodoro (tempo fixo, com pausa) ou cronômetro (livre). Ausente = pomodoro. */
  mode?: "pomodoro" | "stopwatch";
  /** Tarefa ligada; "" = sem tarefa. */
  taskId: string;
  phase: "focus" | "break";
  startedAt: string; // ISO
  /** Duração da fase no pomodoro; 0 no cronômetro. */
  durationMin: number;
  /** Fase pronta, esperando a pessoa tocar em começar (início automático desligado). */
  waiting?: boolean;
}

/** Horário de um dia, "HH:mm". */
export interface DayWindow {
  start: string;
  end: string;
}

/** Pausa fixa dentro do dia (ex: almoço), vale para todos os dias com horário. */
export interface BreakTime {
  label: string;
  start: string;
  end: string;
}

export interface Settings {
  /** Horário por dia da semana (0 = domingo); null = dia sem tarefas. */
  windows: (DayWindow | null)[];
  /** Pausas fixas, como almoço. */
  breaks: BreakTime[];
  /** Exceções para dias específicos { "2026-10-18": { start, end } | null }. */
  windowOverrides: Record<string, DayWindow | null>;
  focusMin: number;
  breakMin: number;
  activeTimer?: ActiveTimer | null;
  /** Ao acabar o foco, a pausa começa sozinha. */
  autoStartBreaks?: boolean;
  /** Ao acabar a pausa, o próximo foco começa sozinho. */
  autoStartFocus?: boolean;
  /** Sessão sem tarefa esperando a pessoa dizer em que trabalhou. */
  pendingAssign?: string | null;
  /** Já passou pela configuração inicial. */
  onboarded?: boolean;
  /** Já definiu o horário do dia (configuração nova, por horário). */
  scheduleSet?: boolean;
}

const WORKDAY: DayWindow = { start: "08:00", end: "18:00" };

export const DEFAULT_SETTINGS: Settings = {
  windows: [null, WORKDAY, WORKDAY, WORKDAY, WORKDAY, WORKDAY, null],
  breaks: [{ label: "Almoço", start: "12:00", end: "13:00" }],
  windowOverrides: {},
  focusMin: 25,
  breakMin: 5,
  activeTimer: null,
};
