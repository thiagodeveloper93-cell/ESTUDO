import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { LogIn, LogOut, Clock } from "lucide-react";

export default function Attendance() {
  const { user, isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState("");

  const myEmp = user?.employee_id;
  const activeId = isAdmin ? selected : myEmp;

  const load = async () => {
    if (isAdmin) {
      const e = await api.get("/employees");
      setEmployees(e.data);
      if (!selected && e.data[0]) setSelected(e.data[0]._id);
    }
  };
  useEffect(() => { load(); }, []);

  const loadRecords = async (id) => {
    if (!id) return;
    const r = await api.get("/attendance", { params: { employee_id: id } });
    setRecords(r.data);
  };
  useEffect(() => { loadRecords(activeId); }, [activeId]);

  const punch = async (type) => {
    if (!activeId) return toast.error("Selecione um colaborador");
    await api.post("/attendance", { employee_id: activeId, type });
    toast.success(type === "entrada" ? "Entrada registrada!" : "Saída registrada!");
    loadRecords(activeId);
  };

  const fmt = (iso) => new Date(iso).toLocaleString("pt-BR");

  return (
    <div>
      <PageHeader title="Ponto & Frequência" subtitle="Registre entradas e saídas e consulte o espelho de ponto" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="card-anim border-slate-200 p-6 shadow-sm dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Clock className="h-4 w-4" /> Bater Ponto</div>
          {isAdmin && (
            <div className="mt-4">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger data-testid="attendance-employee-select"><SelectValue placeholder="Colaborador" /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="mt-4 text-center text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button onClick={() => punch("entrada")} data-testid="punch-in-btn" className="bg-emerald-600 hover:bg-emerald-700"><LogIn className="mr-2 h-4 w-4" /> Entrada</Button>
            <Button onClick={() => punch("saida")} data-testid="punch-out-btn" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"><LogOut className="mr-2 h-4 w-4" /> Saída</Button>
          </div>
        </Card>

        <Card className="card-anim border-slate-200 p-4 shadow-sm lg:col-span-2 dark:border-slate-800">
          <div className="mb-3 px-2 text-sm font-semibold">Espelho de Ponto</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Data/Hora</TableHead><TableHead>Tipo</TableHead></TableRow></TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r._id} data-testid={`attendance-row-${r._id}`}>
                    <TableCell className="font-mono text-sm">{fmt(r.timestamp)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.type === "entrada" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}>
                        {r.type}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {records.length === 0 && <TableRow><TableCell colSpan={2} className="py-10 text-center text-muted-foreground">Nenhuma marcação ainda</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
