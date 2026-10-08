import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Target, Trash2, Star, Sparkles, Flag } from "lucide-react";

const scale = [1, 2, 3, 4, 5];

function Rating({ label, value, onChange, testid }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex gap-1" data-testid={testid}>
        {scale.map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition-all ${value >= n ? "border-blue-500 bg-blue-500 text-white" : "border-slate-200 text-muted-foreground hover:border-blue-300"}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

const boxGrid = [
  ["baixo", "alto"], ["médio", "alto"], ["alto", "alto"],
  ["baixo", "médio"], ["médio", "médio"], ["alto", "médio"],
  ["baixo", "baixo"], ["médio", "baixo"], ["alto", "baixo"],
];
const boxColor = { alto: "bg-emerald-50 border-emerald-200", médio: "bg-amber-50 border-amber-200", baixo: "bg-red-50 border-red-200" };

export default function Performance() {
  const [cycles, setCycles] = useState([]);
  const [active, setActive] = useState(null);
  const [evals, setEvals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [cycle, setCycle] = useState({ name: "", period: "", description: "" });
  const [form, setForm] = useState({ employee_id: "", performance: 3, potential: 3, entrega: 3, qualidade: 3, colaboracao: 3, comments: "" });
  const [goals, setGoals] = useState([]);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goal, setGoal] = useState({ employee_id: "", title: "", description: "", progress: 0 });

  const load = async () => {
    const [c, e] = await Promise.all([api.get("/eval-cycles"), api.get("/employees")]);
    setCycles(c.data); setEmployees(e.data);
    if (!active && c.data[0]) selectCycle(c.data[0]);
  };
  useEffect(() => { load(); }, []);

  const selectCycle = async (c) => {
    setActive(c);
    const [r, g] = await Promise.all([
      api.get("/evaluations", { params: { cycle_id: c._id } }),
      api.get("/goals", { params: { cycle_id: c._id } }),
    ]);
    setEvals(r.data); setGoals(g.data);
  };

  const saveCycle = async () => {
    if (!cycle.name) return toast.error("Informe o nome do ciclo");
    try { const r = await api.post("/eval-cycles", cycle); toast.success("Ciclo criado"); setCycleOpen(false); setCycle({ name: "", period: "", description: "" }); await load(); selectCycle(r.data); }
    catch (e) { toast.error(apiError(e)); }
  };

  const saveEval = async () => {
    if (!form.employee_id) return toast.error("Selecione o colaborador");
    try {
      await api.post("/evaluations", { ...form, cycle_id: active._id });
      toast.success("Avaliação registrada"); setEvalOpen(false);
      setForm({ employee_id: "", performance: 3, potential: 3, entrega: 3, qualidade: 3, colaboracao: 3, comments: "" });
      selectCycle(active); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const delCycle = async (id) => { if (!window.confirm("Excluir ciclo e avaliações?")) return; await api.delete(`/eval-cycles/${id}`); toast.success("Excluído"); setActive(null); setEvals([]); load(); };
  const delEval = async (id) => { await api.delete(`/evaluations/${id}`); toast.success("Removida"); selectCycle(active); };

  const saveGoal = async () => {
    if (!goal.employee_id || !goal.title) return toast.error("Informe o colaborador e o título da meta");
    try {
      await api.post("/goals", { ...goal, cycle_id: active._id, progress: Number(goal.progress) });
      toast.success("Meta criada"); setGoalOpen(false);
      setGoal({ employee_id: "", title: "", description: "", progress: 0 });
      selectCycle(active);
    } catch (e) { toast.error(apiError(e)); }
  };
  const bumpGoal = async (g, delta) => {
    const progress = Math.max(0, Math.min(100, g.progress + delta));
    await api.put(`/goals/${g._id}`, { progress });
    selectCycle(active);
  };
  const delGoal = async (id) => { await api.delete(`/goals/${id}`); toast.success("Meta removida"); selectCycle(active); };

  const cellEvals = (perf, pot) => evals.filter((e) => e.nine_box?.perf_level === perf && e.nine_box?.pot_level === pot);

  return (
    <div>
      <PageHeader
        title="Avaliação de Desempenho"
        subtitle="Ciclos de avaliação, notas e matriz Nine Box"
        action={<Button onClick={() => setCycleOpen(true)} data-testid="new-cycle-btn" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Novo Ciclo</Button>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-3">
          {cycles.map((c) => (
            <Card key={c._id} onClick={() => selectCycle(c)} data-testid={`cycle-card-${c._id}`}
              className={`card-anim cursor-pointer border p-4 shadow-sm transition-all hover:shadow-md ${active?._id === c._id ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 dark:border-slate-800"}`}>
              <div className="flex items-start justify-between">
                <Target className="h-5 w-5 text-blue-600" />
                <Badge variant="outline" className={c.status === "ativo" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{c.status}</Badge>
              </div>
              <div className="mt-2 font-semibold">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.period} · {c.eval_count} avaliações</div>
            </Card>
          ))}
          {cycles.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum ciclo ainda</Card>}
        </div>

        <div className="lg:col-span-3">
          {active ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{active.name}</h2><p className="text-sm text-muted-foreground">{active.description}</p></div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setEvalOpen(true)} data-testid="new-eval-btn" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Avaliar colaborador</Button>
                  <Button size="sm" variant="ghost" onClick={() => delCycle(active._id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              </div>

              <Card className="border-slate-200 p-5 shadow-sm dark:border-slate-800">
                <div className="mb-3 text-sm font-semibold">Matriz Nine Box <span className="text-xs font-normal text-muted-foreground">(Potencial × Desempenho)</span></div>
                <div className="grid grid-cols-3 gap-2">
                  {boxGrid.map(([perf, pot], i) => {
                    const items = cellEvals(perf, pot);
                    return (
                      <div key={i} className={`min-h-[90px] rounded-lg border p-2 ${boxColor[pot === "alto" && perf === "alto" ? "alto" : (perf === "baixo" || pot === "baixo" ? "baixo" : "médio")]}`}>
                        <div className="text-[10px] font-semibold uppercase text-slate-500">P:{pot[0]} / D:{perf[0]}</div>
                        {items.map((e) => (
                          <div key={e._id} className="mt-1 truncate rounded bg-white/70 px-1.5 py-0.5 text-xs font-medium">{e.employee_name}</div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="mt-4 space-y-3">
                {evals.map((e) => (
                  <Card key={e._id} data-testid={`eval-${e._id}`} className="flex flex-wrap items-center gap-4 border-slate-200 p-4 shadow-sm dark:border-slate-800">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold text-white">{e.employee_name.slice(0, 2).toUpperCase()}</div>
                    <div className="min-w-[160px]"><div className="font-semibold">{e.employee_name}</div><div className="text-xs text-muted-foreground">{e.nine_box?.label}</div></div>
                    <div className="flex items-center gap-1 text-sm"><Star className="h-4 w-4 text-amber-500" /> <b>{e.overall}</b>/5</div>
                    <div className="flex gap-3 text-xs text-muted-foreground"><span>Entrega {e.entrega}</span><span>Qualidade {e.qualidade}</span><span>Colaboração {e.colaboracao}</span></div>
                    {e.comments && <div className="max-w-xs text-xs text-muted-foreground">{e.comments}</div>}
                    <Button size="icon" variant="ghost" onClick={() => delEval(e._id)} className="ml-auto"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </Card>
                ))}
                {evals.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma avaliação neste ciclo</Card>}
              </div>

              <div className="mt-6 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold"><Flag className="h-4 w-4 text-blue-600" /> Metas & OKRs do ciclo</div>
                <Button size="sm" variant="outline" onClick={() => setGoalOpen(true)} data-testid="new-goal-btn"><Plus className="mr-2 h-4 w-4" /> Nova Meta</Button>
              </div>
              <div className="space-y-3">
                {goals.map((g) => (
                  <Card key={g._id} data-testid={`goal-${g._id}`} className="border-slate-200 p-4 shadow-sm dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-[160px] flex-1">
                        <div className="font-semibold">{g.title}</div>
                        <div className="text-xs text-muted-foreground">{g.employee_name} {g.description ? `· ${g.description}` : ""}</div>
                      </div>
                      <Badge variant="outline" className={g.status === "concluida" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                        {g.status === "concluida" ? "Concluída" : "Em andamento"}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="ghost" onClick={() => bumpGoal(g, -10)} data-testid={`goal-minus-${g._id}`} className="h-7 w-7">−</Button>
                        <span className="w-10 text-center text-sm font-bold">{g.progress}%</span>
                        <Button size="icon" variant="ghost" onClick={() => bumpGoal(g, 10)} data-testid={`goal-plus-${g._id}`} className="h-7 w-7">+</Button>
                        <Button size="icon" variant="ghost" onClick={() => delGoal(g._id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </div>
                    <Progress value={g.progress} className="mt-3 h-1.5" />
                  </Card>
                ))}
                {goals.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma meta definida para este ciclo</Card>}
              </div>
            </>
          ) : (
            <Card className="p-10 text-center text-muted-foreground">Selecione ou crie um ciclo</Card>
          )}
        </div>
      </div>

      <Dialog open={cycleOpen} onOpenChange={setCycleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Ciclo de Avaliação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={cycle.name} onChange={(e) => setCycle({ ...cycle, name: e.target.value })} data-testid="cycle-name" placeholder="Ex: Avaliação 360° — 1º Semestre" /></div>
            <div><Label>Período</Label><Input value={cycle.period} onChange={(e) => setCycle({ ...cycle, period: e.target.value })} placeholder="Ex: 2026 S1" /></div>
            <div><Label>Descrição</Label><Textarea value={cycle.description} onChange={(e) => setCycle({ ...cycle, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCycleOpen(false)}>Cancelar</Button><Button onClick={saveCycle} data-testid="save-cycle" className="bg-blue-600 hover:bg-blue-700">Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={evalOpen} onOpenChange={setEvalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Avaliar Colaborador</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger data-testid="eval-employee"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Rating label="Desempenho" value={form.performance} onChange={(n) => setForm({ ...form, performance: n })} testid="rating-performance" />
              <Rating label="Potencial" value={form.potential} onChange={(n) => setForm({ ...form, potential: n })} testid="rating-potential" />
              <Rating label="Entrega" value={form.entrega} onChange={(n) => setForm({ ...form, entrega: n })} testid="rating-entrega" />
              <Rating label="Qualidade" value={form.qualidade} onChange={(n) => setForm({ ...form, qualidade: n })} testid="rating-qualidade" />
              <Rating label="Colaboração" value={form.colaboracao} onChange={(n) => setForm({ ...form, colaboracao: n })} testid="rating-colaboracao" />
            </div>
            <div><Label>Comentários</Label><Textarea value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEvalOpen(false)}>Cancelar</Button><Button onClick={saveEval} data-testid="save-eval" className="bg-blue-600 hover:bg-blue-700">Salvar avaliação</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Meta / OKR</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador</Label>
              <Select value={goal.employee_id} onValueChange={(v) => setGoal({ ...goal, employee_id: v })}>
                <SelectTrigger data-testid="goal-employee"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Título da meta</Label><Input value={goal.title} onChange={(e) => setGoal({ ...goal, title: e.target.value })} data-testid="goal-title" placeholder="Ex: Aumentar NPS para 70" /></div>
            <div><Label>Descrição</Label><Textarea value={goal.description} onChange={(e) => setGoal({ ...goal, description: e.target.value })} /></div>
            <div><Label>Progresso inicial (%)</Label><Input type="number" min={0} max={100} value={goal.progress} onChange={(e) => setGoal({ ...goal, progress: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setGoalOpen(false)}>Cancelar</Button><Button onClick={saveGoal} data-testid="save-goal" className="bg-blue-600 hover:bg-blue-700">Criar meta</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
