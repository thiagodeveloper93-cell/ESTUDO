import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  LayoutDashboard, Users, Building2, Clock, Plane, Briefcase,
  UserCircle, LogOut, Menu, X, Sparkles, Receipt, Target, Sun, Moon, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const adminNav = [
  { to: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/colaboradores", label: "Colaboradores", icon: Users },
  { to: "/organizacao", label: "Departamentos & Cargos", icon: Building2 },
  { to: "/ponto", label: "Ponto & Frequência", icon: Clock },
  { to: "/ferias", label: "Férias & Ausências", icon: Plane },
  { to: "/recrutamento", label: "Recrutamento IA", icon: Briefcase, ai: true },
  { to: "/folha", label: "Folha & Holerites", icon: Receipt },
  { to: "/desempenho", label: "Avaliação de Desempenho", icon: Target },
  { to: "/assistente", label: "Assistente RH", icon: MessageSquare, ai: true },
];
const empNav = [
  { to: "/portal", label: "Meu Painel", icon: UserCircle },
  { to: "/ponto", label: "Bater Ponto", icon: Clock },
  { to: "/ferias", label: "Minhas Férias", icon: Plane },
  { to: "/meus-holerites", label: "Meus Holerites", icon: Receipt },
  { to: "/assistente", label: "Assistente RH", icon: MessageSquare, ai: true },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const nav = isAdmin ? adminNav : empNav;
  const navigate = useNavigate();

  const SidebarInner = () => (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>CR</div>
        <div>
          <div className="text-sm font-bold leading-tight" style={{ fontFamily: "var(--font-heading)" }}>Construa RH</div>
          <div className="text-[11px] text-slate-400">Gestão de Pessoas</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            data-testid={`nav-${item.to.replace("/", "")}`}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            <span>{item.label}</span>
            {item.ai && <Sparkles className="ml-auto h-3.5 w-3.5 text-violet-400" />}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold">
            {user?.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{user?.name}</div>
            <div className="text-[11px] text-slate-400">{isAdmin ? "RH / Admin" : "Colaborador"}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          data-testid="logout-btn"
          className="w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="fixed h-screen w-64">
          <SidebarInner />
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64">
            <SidebarInner />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md md:px-8 dark:border-slate-800/80 dark:bg-slate-900/80">
          <button className="md:hidden" onClick={() => setOpen(!open)} data-testid="menu-toggle">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="text-sm text-muted-foreground">
            Bem-vindo(a), <span className="font-semibold text-foreground">{user?.name?.split(" ")[0]}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={toggle} data-testid="theme-toggle" aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => navigate("/portal")} data-testid="switch-portal-btn" className="hidden sm:flex">
                <UserCircle className="mr-2 h-4 w-4" /> Ver como Colaborador
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
