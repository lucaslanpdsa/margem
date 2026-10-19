import { describe, expect, it, vi } from "vitest";
import { onSaveError, saved } from "./db";

describe("gravação", () => {
  it("falha ao salvar avisa e não quebra a tela", async () => {
    const seen: unknown[] = [];
    const off = onSaveError((e) => seen.push(e));
    await expect(saved(Promise.reject(new Error("sem permissão")))).resolves.toBeUndefined();
    expect(seen).toHaveLength(1);
    off();
  });

  it("sem resposta do servidor (sem internet), libera a tela em 1,2s", async () => {
    vi.useFakeTimers();
    let done = false;
    saved(new Promise(() => {})).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1199);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});
