import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Check, X, Plane } from "lucide-react";

const statusStyle = {
  pendente: "bg-amber-50 text-amber-700 border-amber-200",
  aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  recusado: "bg-red-50 text-red-700 border-red-200",
};

export default function Vacations() {
  const { user, isAdmin } = useAuth();
  const [vacations, setVacations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", start_date: "", end_date: "", type: "ferias", reason: "" });

  const empName = (id) => employees.find((e) => e._id === id)?.name || "Colaborador";

  const load = async () => {
    const params = isAdmin ? {} : { employee_id: user?.employee_id };
    const [v, e] = await Promise.all([api.get("/vacations", { params }), api.get("/employees").catch(() => ({ data: [] }))]);
    setVacations(v.data); setEmployees(e.data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ employee_id: isAdmin ? "" : user?.employee_id || "", start_date: "", end_date: "", type: "ferias", reason: "" });
    setOpen(true);
  };

  const dayDiff = (a, b) => {
    if (!a || !b) return 0;
    return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
  };

  const save = async () => {
    if (!form.employee_id || !form.start_date || !form.end_date) return toast.error("Preencha todos os campos");
    try {
      await api.post("/vacations", { ...form, days: dayDiff(form.start_date, form.end_date) });
      toast.success("Solicitação enviada!");
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const decide = async (id, status) => {
    try { await api.put(`/vacations/${id}`, { status, decision_note: "" }); toast.success(status === "aprovado" ? "Aprovado!" : "Recusado"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHeader
        title="Férias & Ausências"
        subtitle={isAdmin ? "Aprove ou recuse solicitações da equipe" : "Solicite férias, folgas e acompanhe o saldo"}
        action={<Button onClick={openNew} data-testid="new-vacation-btn" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Nova Solicitação</Button>}
      />

      <div className="space-y-3">
        {vacations.map((v) => (
          <Card key={v._id} data-testid={`vacation-card-${v._id}`} className="card-anim flex flex-wrap items-center gap-4 border-slate-200 p-5 shadow-sm dark:border-slate-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Plane className="h-5 w-5" /></div>
            <div className="min-w-[180px]">
              <div className="font-semibold">{isAdmin ? empName(v.employee_id) : "Minha solicitação"}</div>
              <div className="text-xs text-muted-foreground capitalize">{v.type}</div>
            </div>
            <div className="text-sm">
              <div className="font-mono">{v.start_date} → {v.end_date}</div>
              <div className="text-xs text-muted-foreground">{v.days} dia(s)</div>
            </div>
            {v.reason && <div className="max-w-xs text-sm text-muted-foreground">{v.reason}</div>}
            <Badge variant="outline" className={`${statusStyle[v.status]} ml-auto capitalize`}>{v.status}</Badge>
            {isAdmin && v.status === "pendente" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide(v._id, "aprovado")} data-testid={`approve-${v._id}`} className="bg-emerald-600 hover:bg-emerald-700"><Check className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => decide(v._id, "recusado")} data-testid={`reject-${v._id}`} className="border-red-200 text-red-600 hover:bg-red-50"><X className="h-4 w-4" /></Button>
              </div>
            )}
          </Card>
        ))}
        {vacations.length === 0 && <Card className="p-10 text-center text-muted-foreground">Nenhuma solicitação registrada</Card>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Solicitação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {isAdmin && (
              <div>
                <Label>Colaborador</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger data-testid="vac-employee"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger data-testid="vac-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ferias">Férias</SelectItem>
                  <SelectItem value="folga">Folga</SelectItem>
                  <SelectItem value="atestado">Atestado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} data-testid="vac-start" /></div>
              <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} data-testid="vac-end" /></div>
            </div>
            <div><Label>Motivo (opcional)</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} data-testid="save-vacation" className="bg-blue-600 hover:bg-blue-700">Enviar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
