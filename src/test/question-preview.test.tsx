import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionPreview } from "@/components/QuestionPreview";

const path = "12345678-1234-1234-1234-123456789012/media";

describe("QuestionPreview", () => {
  it("renders prompt, YouTube embed, and per-option media like the student view", () => {
    render(
      <QuestionPreview
        q={{
          type: "pg",
          subject: "Matematika",
          prompt: "Perhatikan media berikut",
          media: { kind: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
          options: ["", "", ""],
          option_media: [
            { kind: "image", path: `${path}.png` },
            { kind: "audio", path: `${path}.mp3` },
            { kind: "video", path: `${path}.mp4` },
          ],
          points: 5,
        }}
      />,
    );

    expect(screen.getByText("Perhatikan media berikut")).toBeTruthy();
    expect(screen.getByText("Matematika")).toBeTruthy();
    expect(screen.getByText("5 poin")).toBeTruthy();
    const iframe = screen.getByTitle("Media pertanyaan");
    expect(iframe.getAttribute("src")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(iframe.getAttribute("sandbox")).toContain("allow-scripts");
    // Option media show a loading state while signed URLs are fetched.
    expect(screen.getAllByText("Memuat media…")).toHaveLength(3);
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
  });

  it("marks text-free questions and renders benar/salah choices", () => {
    render(
      <QuestionPreview
        q={{ type: "bs", prompt: "", media: { kind: "image", path: `${path}.png` }, points: 1 }}
      />,
    );
    expect(screen.getByText(/Tanpa teks pertanyaan/)).toBeTruthy();
    expect(screen.getByText("Benar")).toBeTruthy();
    expect(screen.getByText("Salah")).toBeTruthy();
  });
});
