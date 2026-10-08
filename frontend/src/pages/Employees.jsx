import { useEffect, useState } from "react";
import { api, apiError, brl } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

const statusStyle = {
  ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  afastado: "bg-amber-50 text-amber-700 border-amber-200",
  desligado: "bg-red-50 text-red-700 border-red-200",
};

const empty = {
  name: "", email: "", phone: "", cpf: "", department_id: "", position_id: "",
  salary: 0, admission_date: "", status: "ativo", vacation_balance: 30,
};

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [deps, setDeps] = useState([]);
  const [positions, setPositions] = useState([]);
  const [search, setSearch] = useState("");
  const [filterDep, setFilterDep] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    const [e, d, p] = await Promise.all([
      api.get("/employees"), api.get("/departments"), api.get("/positions"),
    ]);
    setEmployees(e.data); setDeps(d.data); setPositions(p.data);
  };
  useEffect(() => { load(); }, []);

  const depName = (id) => deps.find((d) => d._id === id)?.name || "—";
  const posName = (id) => positions.find((p) => p._id === id)?.title || "—";

  const filtered = employees.filter((e) => {
    const m = e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase());
    const dm = filterDep === "all" || e.department_id === filterDep;
    const sm = filterStatus === "all" || e.status === filterStatus;
    return m && dm && sm;
  });

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (e) => {
    setForm({ ...empty, ...e, department_id: e.department_id || "", position_id: e.position_id || "" });
    setEditId(e._id); setOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.email) return toast.error("Nome e e-mail são obrigatórios");
    const payload = { ...form, salary: Number(form.salary), vacation_balance: Number(form.vacation_balance) };
    try {
      if (editId) await api.put(`/employees/${editId}`, payload);
      else await api.post("/employees", payload);
      toast.success(editId ? "Colaborador atualizado" : "Colaborador cadastrado");
      setOpen(false); load();
    } catch (err) { toast.error(apiError(err)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Remover este colaborador?")) return;
    await api.delete(`/employees/${id}`);
    toast.success("Removido"); load();
  };

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        subtitle={`${employees.length} pessoas cadastradas`}
        action={
          <Button onClick={openNew} data-testid="new-employee-btn" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" /> Novo Colaborador
          </Button>
        }
      />

      <Card className="border-slate-200 p-4 shadow-sm dark:border-slate-800">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="employee-search"
              placeholder="Buscar por nome ou e-mail…" className="pl-9" />
          </div>
          <Select value={filterDep} onValueChange={setFilterDep}>
            <SelectTrigger className="w-[200px]" data-testid="filter-department"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os departamentos</SelectItem>
              {deps.map((d) => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="afastado">Afastado</SelectItem>
              <SelectItem value="desligado">Desligado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Salário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e._id} data-testid={`employee-row-${e._id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold text-white">
                        {e.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{depName(e.department_id)}</TableCell>
                  <TableCell>{posName(e.position_id)}</TableCell>
                  <TableCell className="font-mono text-sm">{brl(e.salary)}</TableCell>
                  <TableCell><Badge variant="outline" className={statusStyle[e.status]}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(e)} data-testid={`edit-employee-${e._id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(e._id)} data-testid={`delete-employee-${e._id}`}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nenhum colaborador encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome completo</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="emp-name" /></div>
            <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="emp-email" /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="emp-phone" /></div>
            <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
            <div><Label>Admissão</Label><Input type="date" value={form.admission_date || ""} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} /></div>
            <div>
              <Label>Departamento</Label>
              <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                <SelectTrigger data-testid="emp-department"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{deps.map((d) => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cargo</Label>
              <Select value={form.position_id} onValueChange={(v) => setForm({ ...form, position_id: v })}>
                <SelectTrigger data-testid="emp-position"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{positions.map((p) => <SelectItem key={p._id} value={p._id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Salário (R$)</Label><Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} data-testid="emp-salary" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="emp-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="desligado">Desligado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} data-testid="save-employee" className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
