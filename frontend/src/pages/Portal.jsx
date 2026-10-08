import { useEffect, useState } from "react";
import { api, brl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Plane, Mail, Phone, Calendar, Building2, Briefcase, CheckCircle2 } from "lucide-react";

const statusStyle = {
  pendente: "bg-amber-50 text-amber-700 border-amber-200",
  aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  recusado: "bg-red-50 text-red-700 border-red-200",
};

export default function Portal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [dep, setDep] = useState("—");
  const [pos, setPos] = useState("—");
  const [vacations, setVacations] = useState([]);

  useEffect(() => {
    const id = user?.employee_id;
    if (!id) return;
    (async () => {
      const [e, deps, positions, v] = await Promise.all([
        api.get(`/employees/${id}`),
        api.get("/departments"),
        api.get("/positions"),
        api.get("/vacations", { params: { employee_id: id } }),
      ]);
      setEmp(e.data);
      setDep(deps.data.find((d) => d._id === e.data.department_id)?.name || "—");
      setPos(positions.data.find((p) => p._id === e.data.position_id)?.title || "—");
      setVacations(v.data);
    })();
  }, [user]);

  if (!user?.employee_id)
    return (
      <div>
        <PageHeader title="Meu Painel" />
        <Card className="p-10 text-center text-muted-foreground">Esta conta não está vinculada a um colaborador.</Card>
      </div>
    );
  if (!emp) return <div className="text-muted-foreground">Carregando painel…</div>;

  return (
    <div>
      <PageHeader title={`Olá, ${emp.name.split(" ")[0]}!`} subtitle="Seu portal de autoatendimento" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="card-anim border-slate-200 p-6 shadow-sm dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-xl font-bold text-white">
              {emp.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>{emp.name}</div>
              <Badge variant="outline" className="mt-1 border-emerald-200 bg-emerald-50 text-emerald-700 capitalize">{emp.status}</Badge>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-3 text-muted-foreground"><Briefcase className="h-4 w-4" /> {pos}</div>
            <div className="flex items-center gap-3 text-muted-foreground"><Building2 className="h-4 w-4" /> {dep}</div>
            <div className="flex items-center gap-3 text-muted-foreground"><Mail className="h-4 w-4" /> {emp.email}</div>
            <div className="flex items-center gap-3 text-muted-foreground"><Phone className="h-4 w-4" /> {emp.phone}</div>
            <div className="flex items-center gap-3 text-muted-foreground"><Calendar className="h-4 w-4" /> Admissão: {emp.admission_date}</div>
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="card-anim border-slate-200 p-6 shadow-sm dark:border-slate-800">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saldo de Férias</div>
              <div className="mt-2 text-3xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>{emp.vacation_balance} <span className="text-base font-medium text-muted-foreground">dias</span></div>
              <Progress value={(emp.vacation_balance / 30) * 100} className="mt-3 h-1.5" />
            </Card>
            <Card className="card-anim border-slate-200 p-6 shadow-sm dark:border-slate-800">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remuneração</div>
              <div className="mt-2 text-3xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>{brl(emp.salary)}</div>
              <div className="mt-3 text-xs text-muted-foreground">Salário mensal bruto</div>
            </Card>
          </div>

          <Card className="card-anim border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="font-semibold">Ações rápidas</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigate("/ponto")} data-testid="portal-ponto" className="bg-blue-600 hover:bg-blue-700"><Clock className="mr-2 h-4 w-4" /> Bater Ponto</Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/ferias")} data-testid="portal-ferias"><Plane className="mr-2 h-4 w-4" /> Pedir Férias</Button>
              </div>
            </div>
            <div className="text-sm font-semibold text-muted-foreground">Minhas solicitações</div>
            <div className="mt-3 space-y-2">
              {vacations.map((v) => (
                <div key={v._id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{v.type}</span>
                    <span className="font-mono text-xs text-muted-foreground">{v.start_date} → {v.end_date}</span>
                  </div>
                  <Badge variant="outline" className={`${statusStyle[v.status]} capitalize`}>{v.status}</Badge>
                </div>
              ))}
              {vacations.length === 0 && <div className="py-4 text-center text-sm text-muted-foreground">Nenhuma solicitação ainda</div>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
