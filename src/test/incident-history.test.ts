import { describe, expect, it } from "vitest";
import { filterIncidents, type Incident } from "@/lib/incident-history";

const rows: Incident[] = [
  { id: "1", type: "tab_hidden", occurred_at: "2026-10-20T08:00:00Z", exams: { title: "Matematika", code: "MAT123" }, attempts: { id: "a1", exam_id: "e1", status: "submitted", deadline_at: null, students: { full_name: "Siswa A", username: "siswa.a", class_name: "X" } } },
  { id: "2", type: "page_exit", occurred_at: "2026-10-20T08:01:00Z", exams: { title: "Matematika", code: "MAT123" }, attempts: { id: "a2", exam_id: "e2", status: "suspended", deadline_at: null, students: { full_name: "Siswa B", username: "siswa.b", class_name: "XI" } } },
];
describe("incident review", () => {
  it("retains the timestamp and violation type after submission", () => {
    expect(filterIncidents(rows, "", "all", "submitted")).toEqual([rows[0]]);
    expect(filterIncidents(rows, "", "all", "submitted")[0]?.occurred_at).toBe("2026-10-20T08:00:00Z");
    expect(filterIncidents(rows, "", "all", "submitted")[0]?.type).toBe("tab_hidden");
  });
  it("filters by violation type and student or exam", () => {
    expect(filterIncidents(rows, "MAT123", "page_exit", "all")).toEqual([rows[1]]);
    expect(filterIncidents(rows, "siswa.a", "all", "all")).toEqual([rows[0]]);
  });
});