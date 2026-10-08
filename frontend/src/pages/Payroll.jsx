import { useEffect, useState } from "react";
import { api, apiError, brl } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Download, Trash2, Sparkles, Users } from "lucide-react";

function monthLabel(c) {
  if (!c) return "";
  const [y, m] = c.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[Number(m) - 1]}/${y}`;
}

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function Payroll() {
  const [employees, setEmployees] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [competencia, setCompetencia] = useState(thisMonth());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", bonus: 0, benefits: 0, other_discounts: 0 });
  const [view, setView] = useState(null);

  const load = async () => {
    const [e, p] = await Promise.all([api.get("/employees"), api.get("/payslips")]);
    setEmployees(e.data); setPayslips(p.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = payslips.filter((p) => p.competencia === competencia);
  const totalNet = filtered.reduce((s, p) => s + p.net, 0);

  const generateAll = async () => {
    try { const r = await api.post("/payslips/generate-all", { competencia }); toast.success(`${r.data.generated} holerites gerados`); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const generateOne = async () => {
    if (!form.employee_id) return toast.error("Selecione um colaborador");
    try {
      await api.post("/payslips/generate", {
        employee_id: form.employee_id, competencia,
        bonus: Number(form.bonus), benefits: Number(form.benefits), other_discounts: Number(form.other_discounts),
      });
      toast.success("Holerite gerado"); setOpen(false); setForm({ employee_id: "", bonus: 0, benefits: 0, other_discounts: 0 }); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const remove = async (id) => { if (!window.confirm("Excluir holerite?")) return; await api.delete(`/payslips/${id}`); toast.success("Excluído"); load(); };

  return (
    <div>
      <PageHeader
        title="Folha & Holerites"
        subtitle="Gere e consulte holerites por competência"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(true)} data-testid="gen-one-btn"><FileText className="mr-2 h-4 w-4" /> Holerite individual</Button>
            <Button onClick={generateAll} data-testid="gen-all-btn" className="bg-blue-600 hover:bg-blue-700"><Users className="mr-2 h-4 w-4" /> Gerar para todos</Button>
          </div>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-4 border-slate-200 p-4 shadow-sm dark:border-slate-800">
        <div>
          <Label className="text-xs">Competência</Label>
          <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} data-testid="competencia-input" className="w-[180px]" />
        </div>
        <div className="ml-auto flex gap-6">
          <div><div className="text-xs text-muted-foreground">Holerites</div><div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-heading)" }}>{filtered.length}</div></div>
          <div><div className="text-xs text-muted-foreground">Líquido total</div><div className="text-xl font-extrabold text-blue-600" style={{ fontFamily: "var(--font-heading)" }}>{brl(totalNet)}</div></div>
        </div>
      </Card>

      <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-800">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Competência</TableHead><TableHead>Proventos</TableHead><TableHead>Descontos</TableHead><TableHead>Líquido</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p._id} data-testid={`payslip-row-${p._id}`}>
                  <TableCell className="font-semibold">{p.employee_name}</TableCell>
                  <TableCell>{monthLabel(p.competencia)}</TableCell>
                  <TableCell className="font-mono text-sm">{brl(p.gross)}</TableCell>
                  <TableCell className="font-mono text-sm text-red-600">- {brl(p.total_deductions)}</TableCell>
                  <TableCell className="font-mono text-sm font-bold text-emerald-600">{brl(p.net)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setView(p)} data-testid={`view-payslip-${p._id}`}><Download className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p._id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum holerite nesta competência. Clique em "Gerar para todos".</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Holerite individual — {monthLabel(competencia)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger data-testid="payslip-employee"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Bônus</Label><Input type="number" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} /></div>
              <div><Label>Benefícios</Label><Input type="number" value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} /></div>
              <div><Label>Outros desc.</Label><Input type="number" value={form.other_discounts} onChange={(e) => setForm({ ...form, other_discounts: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={generateOne} data-testid="save-payslip" className="bg-blue-600 hover:bg-blue-700">Gerar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <PayslipView payslip={view} onClose={() => setView(null)} />
    </div>
  );
}

export function PayslipView({ payslip, onClose }) {
  if (!payslip) return null;
  const print = () => window.print();
  return (
    <Dialog open={!!payslip} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Holerite</DialogTitle></DialogHeader>
        <div id="holerite" className="rounded-xl border border-slate-200 p-5 text-sm dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div>
              <div className="font-bold" style={{ fontFamily: "var(--font-heading)" }}>Construa RH</div>
              <div className="text-xs text-muted-foreground">Demonstrativo de Pagamento</div>
            </div>
            <div className="text-right text-xs"><div className="font-semibold">{monthLabel(payslip.competencia)}</div></div>
          </div>
          <div className="mb-3 font-semibold">{payslip.employee_name}</div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Proventos</div>
            {payslip.earnings.map((e, i) => (
              <div key={i} className="flex justify-between"><span className="text-muted-foreground">{e.label}</span><span className="font-mono">{brl(e.value)}</span></div>
            ))}
            <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-red-600">Descontos</div>
            {payslip.deductions.map((d, i) => (
              <div key={i} className="flex justify-between"><span className="text-muted-foreground">{d.label}</span><span className="font-mono text-red-600">- {brl(d.value)}</span></div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t pt-3"><span className="text-muted-foreground">FGTS (depósito)</span><span className="font-mono">{brl(payslip.fgts)}</span></div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
            <span className="font-semibold">Líquido a receber</span>
            <span className="font-mono text-lg font-extrabold text-blue-600">{brl(payslip.net)}</span>
          </div>
        </div>
        <DialogFooter><Button onClick={print} data-testid="print-payslip" className="bg-blue-600 hover:bg-blue-700"><Download className="mr-2 h-4 w-4" /> Imprimir / PDF</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
