import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { batches, readAllRows, selectExamQuestions } from "@/lib/exam-rules";
import { useExamGuard } from "@/hooks/use-exam-guard";

describe("Exam rules", () => {
  const bank = Array.from({ length: 2500 }, (_, i) => `q${i}`);
  it("does not truncate the uploaded question bank", async () => {
    const rows = await readAllRows(async (from, to) => ({ data: bank.slice(from, to + 1), error: null }));
    expect(rows).toEqual(bank);
    expect(batches(bank).flat()).toEqual(bank);
  });
  it("limits each student to the teacher's requested number", () => {
    expect(selectExamQuestions(bank, 25, true, "student-a")).toHaveLength(25);
    expect(new Set(selectExamQuestions(bank, 25, true, "student-a")).size).toBe(25);
  });
  it("selects independently per student and retains the selection on resume", () => {
    const a = selectExamQuestions(bank, 25, true, "student-a");
    expect(a).toEqual(selectExamQuestions(bank, 25, true, "student-a"));
    expect(a).not.toEqual(selectExamQuestions(bank, 25, true, "student-b"));
  });
  it("permits the same question set for students when randomization is off", () => {
    expect(selectExamQuestions(bank, 25, false, "a")).toEqual(selectExamQuestions(bank, 25, false, "b"));
  });
  it("requires an explicit count and sufficient selected questions", () => {
    expect(() => selectExamQuestions(bank, null, true, "a")).toThrow();
    expect(() => selectExamQuestions(["q1"], 2, true, "a")).toThrow();
  });
  it("detects forced page exit", () => {
    const onExit = vi.fn();
    const hook = renderHook(() => useExamGuard(true, onExit, true));
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(onExit).toHaveBeenCalledWith("page_exit");
    hook.unmount();
  });
  it("detects switching away from the exam", async () => {
    const onExit = vi.fn();
    const hook = renderHook(() => useExamGuard(true, onExit, true));
    await act(async () => { window.dispatchEvent(new Event("blur")); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(onExit).toHaveBeenCalledWith("window_blur");
    hook.unmount();
  });
  it("permits focusing assigned YouTube media but still detects losing window focus", async () => {
    const frame = document.createElement("iframe");
    frame.dataset['examMedia'] = "youtube";
    document.body.append(frame);
    frame.focus();
    const focus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const onExit = vi.fn();
    const hook = renderHook(() => useExamGuard(true, onExit, false));
    await act(async () => { window.dispatchEvent(new Event("blur")); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(onExit).not.toHaveBeenCalled();
    focus.mockReturnValue(false);
    await act(async () => { window.dispatchEvent(new Event("blur")); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(onExit).toHaveBeenCalledWith("window_blur");
    hook.unmount(); frame.remove(); focus.mockRestore();
  });
});