import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, BookOpen, ClipboardList, Users, ShieldAlert, Upload, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/guru")({
  head: () => ({ meta: [{ title: "Panel Guru — SiapUjian" }, { name: "robots", content: "noindex" }] }),
  component: GuruLayout,
});

const nav = [
  { to: "/guru", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/guru/soal", label: "Bank Soal", icon: BookOpen },
  { to: "/guru/upload", label: "Upload Soal", icon: Upload },
  { to: "/guru/ujian", label: "Ujian", icon: ClipboardList },
  { to: "/guru/siswa", label: "Siswa", icon: Users },
  { to: "/guru/audit", label: "Riwayat Insiden", icon: ShieldAlert },
] as const;

function GuruLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/guru"><Brand /></Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: "exact" in n }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              >
                <n.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{n.label}</span>
              </Link>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4" /><span className="hidden md:inline">Keluar</span></Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6"><Outlet /></main>
    </div>
  );
}
