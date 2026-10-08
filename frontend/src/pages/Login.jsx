import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success("Login realizado com sucesso!");
      navigate(u.role === "admin" ? "/dashboard" : "/portal");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const quick = (em, pw) => { setEmail(em); setPassword(pw); };

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-bold text-blue-700" style={{ fontFamily: "var(--font-heading)" }}>CR</div>
          <span className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>Construa RH</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Gestão de pessoas,<br />com inteligência.
          </h1>
          <p className="mt-4 max-w-md text-blue-100/80">
            Controle colaboradores, ponto, férias e recrutamento com triagem de currículos por IA — tudo em um só lugar.
          </p>
          <div className="mt-8 flex gap-6 text-sm text-blue-100/90">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-300" /> Triagem por IA</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Acesso por perfil</div>
          </div>
        </div>
        <div className="text-xs text-blue-200/60">© 2026 Construa RH</div>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-[480px]">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Entrar na plataforma</h2>
          <p className="mt-1 text-sm text-slate-400">Acesse com suas credenciais</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-300">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                data-testid="login-email" placeholder="voce@construa.com"
                className="mt-1.5 border-slate-700 bg-slate-800 text-white placeholder:text-slate-500" />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-300">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                data-testid="login-password" placeholder="••••••••"
                className="mt-1.5 border-slate-700 bg-slate-800 text-white placeholder:text-slate-500" />
            </div>
            <Button type="submit" disabled={loading} data-testid="login-submit"
              className="w-full bg-blue-600 transition-transform hover:bg-blue-700 active:scale-[0.98]">
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 space-y-2 rounded-xl border border-slate-800 bg-slate-800/50 p-4 text-xs">
            <div className="font-semibold text-slate-300">Contas de demonstração</div>
            <button onClick={() => quick("rh@construa.com", "rh123456")} data-testid="demo-rh"
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-slate-700/50">
              <span className="text-slate-400">RH / Admin</span>
              <span className="font-mono text-blue-300">rh@construa.com</span>
            </button>
            <button onClick={() => quick("colaborador@construa.com", "colab123")} data-testid="demo-colab"
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-slate-700/50">
              <span className="text-slate-400">Colaborador</span>
              <span className="font-mono text-blue-300">colaborador@construa.com</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
