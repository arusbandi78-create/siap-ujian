import { describe, expect, it } from "vitest";
import { compactOptions, mediaSchema, youtubeId, validateMediaFile } from "@/lib/question-media";
describe("question multimedia", () => {
  it("accepts image audio video and YouTube for text-free answer options", () => {
    const path = "12345678-1234-1234-1234-123456789012/example";
    const media = [mediaSchema.parse({ kind: "image", path: `${path}.png` }), mediaSchema.parse({ kind: "audio", path: `${path}.mp3` }), mediaSchema.parse({ kind: "video", path: `${path}.mp4` }), mediaSchema.parse({ kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" })];
    const result = compactOptions(["", "", "", ""], media, 2);
    expect(result.options).toEqual(["", "", "", ""]);
    expect(result.option_media.map((m) => m?.kind)).toEqual(["image", "audio", "video", "youtube"]);
    expect(result.answer).toBe(2);
  });
  it("preserves original answer index when blank options are removed", () => {
    expect(compactOptions(["A", "", "C"], [], 2).answer).toBe(1);
    expect(() => compactOptions(["A", "", "C"], [], 1)).toThrow();
  });
  it("normalizes only trusted YouTube links and rejects external or script URLs", () => {
    expect(youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    const media = mediaSchema.parse({ kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ?t=4" });
    expect(media.kind === "youtube" ? media.url : null).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    for (const url of ["javascript:alert(1)", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "https://evil.test/dQw4w9WgXcQ"]) expect(youtubeId(url)).toBeNull();
  });
  it("validates file type and size", () => {
    expect(validateMediaFile({ name: "a.mp3", type: "audio/mpeg", size: 100 }).kind).toBe("audio");
    expect(() => validateMediaFile({ name: "a.svg", type: "image/svg+xml", size: 100 })).toThrow();
    expect(() => validateMediaFile({ name: "a.png", type: "text/html", size: 100 })).toThrow();
    expect(() => validateMediaFile({ name: "a.mp4", type: "video/mp4", size: 51 * 1024 * 1024 })).toThrow();
  });
});