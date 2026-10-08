import { useEffect, useState } from "react";
import { api, apiError, brl } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Building2, Trash2, Briefcase } from "lucide-react";

export default function Organization() {
  const [deps, setDeps] = useState([]);
  const [positions, setPositions] = useState([]);
  const [depOpen, setDepOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [dep, setDep] = useState({ name: "", description: "" });
  const [pos, setPos] = useState({ title: "", department_id: "", salary_min: 0, salary_max: 0 });

  const load = async () => {
    const [d, p] = await Promise.all([api.get("/departments"), api.get("/positions")]);
    setDeps(d.data); setPositions(p.data);
  };
  useEffect(() => { load(); }, []);

  const depName = (id) => deps.find((d) => d._id === id)?.name || "—";

  const saveDep = async () => {
    if (!dep.name) return toast.error("Informe o nome");
    try { await api.post("/departments", dep); toast.success("Departamento criado"); setDepOpen(false); setDep({ name: "", description: "" }); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const savePos = async () => {
    if (!pos.title) return toast.error("Informe o cargo");
    try { await api.post("/positions", { ...pos, salary_min: Number(pos.salary_min), salary_max: Number(pos.salary_max) }); toast.success("Cargo criado"); setPosOpen(false); setPos({ title: "", department_id: "", salary_min: 0, salary_max: 0 }); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const delDep = async (id) => { if (!window.confirm("Remover departamento?")) return; await api.delete(`/departments/${id}`); toast.success("Removido"); load(); };
  const delPos = async (id) => { if (!window.confirm("Remover cargo?")) return; await api.delete(`/positions/${id}`); toast.success("Removido"); load(); };

  return (
    <div>
      <PageHeader title="Departamentos & Cargos" subtitle="Estrutura organizacional da empresa" />
      <Tabs defaultValue="deps">
        <TabsList>
          <TabsTrigger value="deps" data-testid="tab-departments">Departamentos</TabsTrigger>
          <TabsTrigger value="pos" data-testid="tab-positions">Cargos</TabsTrigger>
        </TabsList>

        <TabsContent value="deps" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setDepOpen(true)} data-testid="new-department-btn" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Novo Departamento</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deps.map((d) => (
              <Card key={d._id} data-testid={`dep-card-${d._id}`} className="card-anim border-slate-200 p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Building2 className="h-5 w-5" /></div>
                  <Button variant="ghost" size="icon" onClick={() => delDep(d._id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
                <div className="mt-3 font-semibold">{d.name}</div>
                <div className="text-sm text-muted-foreground">{d.description}</div>
                <div className="mt-3 text-xs text-muted-foreground">{positions.filter((p) => p.department_id === d._id).length} cargos</div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pos" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setPosOpen(true)} data-testid="new-position-btn" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Novo Cargo</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {positions.map((p) => (
              <Card key={p._id} data-testid={`pos-card-${p._id}`} className="card-anim border-slate-200 p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Briefcase className="h-5 w-5" /></div>
                  <Button variant="ghost" size="icon" onClick={() => delPos(p._id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
                <div className="mt-3 font-semibold">{p.title}</div>
                <div className="text-sm text-muted-foreground">{depName(p.department_id)}</div>
                <div className="mt-3 font-mono text-xs text-muted-foreground">{brl(p.salary_min)} – {brl(p.salary_max)}</div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={depOpen} onOpenChange={setDepOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Departamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={dep.name} onChange={(e) => setDep({ ...dep, name: e.target.value })} data-testid="dep-name" /></div>
            <div><Label>Descrição</Label><Textarea value={dep.description} onChange={(e) => setDep({ ...dep, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDepOpen(false)}>Cancelar</Button><Button onClick={saveDep} data-testid="save-department" className="bg-blue-600 hover:bg-blue-700">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={posOpen} onOpenChange={setPosOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cargo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título do cargo</Label><Input value={pos.title} onChange={(e) => setPos({ ...pos, title: e.target.value })} data-testid="pos-title" /></div>
            <div>
              <Label>Departamento</Label>
              <Select value={pos.department_id} onValueChange={(v) => setPos({ ...pos, department_id: v })}>
                <SelectTrigger data-testid="pos-department"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{deps.map((d) => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Salário mín.</Label><Input type="number" value={pos.salary_min} onChange={(e) => setPos({ ...pos, salary_min: e.target.value })} /></div>
              <div><Label>Salário máx.</Label><Input type="number" value={pos.salary_max} onChange={(e) => setPos({ ...pos, salary_max: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPosOpen(false)}>Cancelar</Button><Button onClick={savePos} data-testid="save-position" className="bg-blue-600 hover:bg-blue-700">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
