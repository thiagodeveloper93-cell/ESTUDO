import { useEffect, useState } from "react";
import { api, brl } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import {
  Users, UserCheck, UserMinus, Briefcase, Plane, DollarSign, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from "recharts";

const COLORS = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DB2777"];

function Stat({ icon: Icon, label, value, tint, testid }) {
  return (
    <Card data-testid={testid} className="card-anim border-slate-200 p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${tint}1a`, color: tint }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setD(r.data));
  }, []);

  if (!d) return <div className="text-muted-foreground">Carregando indicadores…</div>;

  return (
    <div>
      <PageHeader title="Visão Geral" subtitle="Indicadores gerais do RH em tempo real" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat testid="kpi-total" icon={Users} label="Colaboradores" value={d.total_employees} tint="#2563EB" />
        <Stat testid="kpi-active" icon={UserCheck} label="Ativos" value={d.active} tint="#059669" />
        <Stat testid="kpi-afastados" icon={UserMinus} label="Afastados" value={d.afastados} tint="#D97706" />
        <Stat testid="kpi-jobs" icon={Briefcase} label="Vagas Abertas" value={d.open_jobs} tint="#7C3AED" />
        <Stat testid="kpi-vac" icon={Plane} label="Férias Pendentes" value={d.pending_vacations} tint="#DB2777" />
        <Stat testid="kpi-payroll" icon={DollarSign} label="Folha Mensal" value={brl(d.monthly_payroll)} tint="#0891B2" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="card-anim border-slate-200 p-6 shadow-sm lg:col-span-2 dark:border-slate-800">
          <h3 className="mb-4 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Headcount por Departamento</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.headcount_by_department} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={26}>
                {d.headcount_by_department.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="card-anim relative overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:to-slate-900">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Recrutamento com IA</h3>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            A triagem inteligente analisa currículos e gera um score de aderência à vaga automaticamente.
          </p>
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
              <span className="text-sm text-muted-foreground">Candidatos triados</span>
              <span className="text-2xl font-extrabold text-violet-600" style={{ fontFamily: "var(--font-heading)" }}>{d.total_candidates}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
              <span className="text-sm text-muted-foreground">Vagas abertas</span>
              <span className="text-2xl font-extrabold text-blue-600" style={{ fontFamily: "var(--font-heading)" }}>{d.open_jobs}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
