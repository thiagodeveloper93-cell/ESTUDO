import { useEffect, useState } from "react";
import { api, brl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PayslipView } from "@/pages/Payroll";
import { Receipt, Download } from "lucide-react";

function monthLabel(c) {
  if (!c) return "";
  const [y, m] = c.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[Number(m) - 1]}/${y}`;
}

export default function MyPayslips() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [view, setView] = useState(null);

  useEffect(() => {
    if (!user?.employee_id) return;
    api.get("/payslips", { params: { employee_id: user.employee_id } }).then((r) => setPayslips(r.data));
  }, [user]);

  return (
    <div>
      <PageHeader title="Meus Holerites" subtitle="Consulte e baixe seus demonstrativos de pagamento" />
      {!user?.employee_id ? (
        <Card className="p-10 text-center text-muted-foreground">Conta não vinculada a um colaborador.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {payslips.map((p) => (
            <Card key={p._id} data-testid={`my-payslip-${p._id}`} className="card-anim border-slate-200 p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Receipt className="h-5 w-5" /></div>
                <div className="text-right"><div className="text-xs text-muted-foreground">Líquido</div><div className="font-mono font-bold text-emerald-600">{brl(p.net)}</div></div>
              </div>
              <div className="mt-3 font-semibold">{monthLabel(p.competencia)}</div>
              <div className="text-xs text-muted-foreground">Proventos {brl(p.gross)} · Descontos {brl(p.total_deductions)}</div>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setView(p)} data-testid={`open-payslip-${p._id}`}><Download className="mr-2 h-4 w-4" /> Ver holerite</Button>
            </Card>
          ))}
          {payslips.length === 0 && <Card className="col-span-full p-10 text-center text-muted-foreground">Nenhum holerite disponível ainda.</Card>}
        </div>
      )}
      <PayslipView payslip={view} onClose={() => setView(null)} />
    </div>
  );
}
