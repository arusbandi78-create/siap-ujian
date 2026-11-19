export type Incident = {
  id: string; type: string; occurred_at: string;
  exams: { title: string; code: string } | null;
  attempts: { status: string; students: { full_name: string; username: string; class_name: string } | null } | null;
};

export function filterIncidents(rows: Incident[], search: string, type: string, status: string) {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    const student = row.attempts?.students;
    const text = [student?.full_name, student?.username, student?.class_name, row.exams?.title, row.exams?.code].join(" ").toLowerCase();
    return text.includes(query) && (type === "all" || row.type === type) && (status === "all" || row.attempts?.status === status);
  });
}