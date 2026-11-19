import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareExamAlarm, playExamAlarm, releaseExamAlarm, stopExamAlarm } from "@/lib/exam-alarm";

afterEach(() => { releaseExamAlarm(); vi.unstubAllGlobals(); });

function mockAudio() {
  const oscillator = { frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null, type: "" };
  const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  const createOscillator = vi.fn(() => oscillator);
  vi.stubGlobal("AudioContext", class {
    state = "running"; currentTime = 10; destination = {};
    resume = vi.fn(async () => {}); close = vi.fn(async () => {});
    createOscillator = createOscillator;
    createGain = () => gain;
  });
  return { oscillator, createOscillator, gain };
}

describe("violation siren", () => {
  it("automatically increases the alarm signal over three seconds", () => {
    const { gain } = mockAudio();
    prepareExamAlarm(); playExamAlarm();
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.06, 10.08);
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.3, 13);
  });
  it("plays the alternating police siren and stops after six seconds", () => {
    const { oscillator } = mockAudio();
    prepareExamAlarm(); playExamAlarm();
    expect(oscillator.start).toHaveBeenCalledWith(10);
    expect(oscillator.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(1400, 10.5);
    expect(oscillator.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(650, 11);
    expect(oscillator.stop).toHaveBeenCalledWith(16);
  });
  it("does not stack duplicate alarms and allows immediate silencing", () => {
    const { oscillator, createOscillator } = mockAudio();
    prepareExamAlarm(); playExamAlarm(); playExamAlarm();
    expect(createOscillator).toHaveBeenCalledTimes(1);
    stopExamAlarm();
    expect(oscillator.stop).toHaveBeenLastCalledWith();
  });
  it("does not interrupt enforcement when audio is unavailable", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => { prepareExamAlarm(); playExamAlarm(); }).not.toThrow();
  });
});