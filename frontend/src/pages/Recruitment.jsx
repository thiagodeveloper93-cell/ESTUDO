import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Sparkles, Briefcase, MapPin, RefreshCw, Users, Trash2 } from "lucide-react";

function scoreColor(s) {
  if (s >= 70) return "#059669";
  if (s >= 45) return "#D97706";
  return "#DC2626";
}

export default function Recruitment() {
  const [jobs, setJobs] = useState([]);
  const [deps, setDeps] = useState([]);
  const [active, setActive] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [jobOpen, setJobOpen] = useState(false);
  const [candOpen, setCandOpen] = useState(false);
  const [screening, setScreening] = useState(false);
  const [job, setJob] = useState({ title: "", department_id: "", description: "", requirements: "", location: "Remoto", status: "aberta" });
  const [cand, setCand] = useState({ name: "", email: "", phone: "", resume_text: "" });

  const load = async () => {
    const [j, d] = await Promise.all([api.get("/jobs"), api.get("/departments")]);
    setJobs(j.data); setDeps(d.data);
    if (!active && j.data[0]) selectJob(j.data[0]);
  };
  useEffect(() => { load(); }, []);

  const selectJob = async (j) => {
    setActive(j);
    const c = await api.get(`/jobs/${j._id}/candidates`);
    setCandidates(c.data);
  };

  const saveJob = async () => {
    if (!job.title || !job.description) return toast.error("Título e descrição são obrigatórios");
    try { const r = await api.post("/jobs", job); toast.success("Vaga criada"); setJobOpen(false); setJob({ title: "", department_id: "", description: "", requirements: "", location: "Remoto", status: "aberta" }); await load(); selectJob(r.data); }
    catch (e) { toast.error(apiError(e)); }
  };

  const saveCand = async () => {
    if (!cand.name || !cand.resume_text) return toast.error("Nome e currículo são obrigatórios");
    setScreening(true);
    try {
      await api.post("/candidates", { ...cand, job_id: active._id });
      toast.success("Currículo triado pela IA!");
      setCandOpen(false); setCand({ name: "", email: "", phone: "", resume_text: "" });
      selectJob(active); load();
    } catch (e) { toast.error(apiError(e)); }
    finally { setScreening(false); }
  };

  const rescreen = async (id) => {
    toast.info("Reprocessando triagem…");
    await api.post(`/candidates/${id}/rescreen`);
    selectJob(active);
  };

  const delJob = async (id) => {
    if (!window.confirm("Remover vaga e candidatos?")) return;
    await api.delete(`/jobs/${id}`); toast.success("Removida");
    setActive(null); setCandidates([]); load();
  };

  return (
    <div>
      <PageHeader
        title="Recrutamento com IA"
        subtitle="Cadastre vagas e deixe a IA pontuar a aderência dos currículos"
        action={<Button onClick={() => setJobOpen(true)} data-testid="new-job-btn" className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Nova Vaga</Button>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          {jobs.map((j) => (
            <Card key={j._id} onClick={() => selectJob(j)} data-testid={`job-card-${j._id}`}
              className={`card-anim cursor-pointer border p-4 shadow-sm transition-all hover:shadow-md ${active?._id === j._id ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 dark:border-slate-800"}`}>
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Briefcase className="h-4 w-4" /></div>
                <Badge variant="outline" className={j.status === "aberta" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{j.status}</Badge>
              </div>
              <div className="mt-2 font-semibold">{j.title}</div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {j.location}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {j.candidate_count} candidatos</span>
              </div>
            </Card>
          ))}
          {jobs.length === 0 && <Card className="p-8 text-center text-muted-foreground">Nenhuma vaga cadastrada</Card>}
        </div>

        <div className="lg:col-span-2">
          {active ? (
            <Card className="border-slate-200 p-6 shadow-sm dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{active.title}</h2>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">{active.description}</p>
                  <p className="mt-2 text-xs"><span className="font-semibold">Requisitos:</span> {active.requirements}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setCandOpen(true)} data-testid="add-candidate-btn" className="bg-violet-600 hover:bg-violet-700"><Sparkles className="mr-2 h-4 w-4" /> Enviar Currículo</Button>
                  <Button size="sm" variant="ghost" onClick={() => delJob(active._id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-violet-600" /> Ranking por IA
                <span className="text-xs font-normal text-muted-foreground">(ordenado por aderência)</span>
              </div>
              <div className="mt-3 space-y-3">
                {candidates.map((c, i) => (
                  <div key={c._id} data-testid={`candidate-${c._id}`} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold dark:bg-slate-800">#{i + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-heading)", color: scoreColor(c.ai_score) }}>{c.ai_score}%</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">aderência</div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => rescreen(c._id)} data-testid={`rescreen-${c._id}`}><RefreshCw className="h-4 w-4" /></Button>
                    </div>
                    <Progress value={c.ai_score} className="mt-3 h-1.5" />
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      <span>Habilidades: <b>{c.ai_skills}%</b></span>
                      <span>Experiência: <b>{c.ai_experience}%</b></span>
                      {c.ai_classified === false && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">IA indisponível</Badge>}
                    </div>
                    <div className="mt-2 rounded-lg bg-violet-50/60 p-3 text-xs text-slate-700 dark:bg-violet-950/20 dark:text-slate-300">
                      <Sparkles className="mr-1 inline h-3 w-3 text-violet-500" /> {c.ai_justification}
                    </div>
                  </div>
                ))}
                {candidates.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Nenhum candidato ainda. Envie um currículo para a triagem por IA.</div>}
              </div>
            </Card>
          ) : (
            <Card className="p-10 text-center text-muted-foreground">Selecione uma vaga</Card>
          )}
        </div>
      </div>

      <Dialog open={jobOpen} onOpenChange={setJobOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova Vaga</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} data-testid="job-title" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Departamento</Label>
                <Select value={job.department_id} onValueChange={(v) => setJob({ ...job, department_id: v })}>
                  <SelectTrigger data-testid="job-department"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{deps.map((d) => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Local</Label><Input value={job.location} onChange={(e) => setJob({ ...job, location: e.target.value })} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={job.description} onChange={(e) => setJob({ ...job, description: e.target.value })} data-testid="job-description" /></div>
            <div><Label>Requisitos</Label><Textarea value={job.requirements} onChange={(e) => setJob({ ...job, requirements: e.target.value })} data-testid="job-requirements" placeholder="Ex: Python, FastAPI, 3+ anos…" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setJobOpen(false)}>Cancelar</Button><Button onClick={saveJob} data-testid="save-job" className="bg-blue-600 hover:bg-blue-700">Criar Vaga</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={candOpen} onOpenChange={setCandOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /> Enviar Currículo para Triagem IA</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={cand.name} onChange={(e) => setCand({ ...cand, name: e.target.value })} data-testid="cand-name" /></div>
              <div><Label>E-mail</Label><Input value={cand.email} onChange={(e) => setCand({ ...cand, email: e.target.value })} data-testid="cand-email" /></div>
            </div>
            <div><Label>Currículo (cole o texto)</Label><Textarea rows={7} value={cand.resume_text} onChange={(e) => setCand({ ...cand, resume_text: e.target.value })} data-testid="cand-resume" placeholder="Experiências, habilidades, formação…" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCandOpen(false)}>Cancelar</Button>
            <Button onClick={saveCand} disabled={screening} data-testid="save-candidate" className="bg-violet-600 hover:bg-violet-700">
              {screening ? "Analisando com IA…" : <><Sparkles className="mr-2 h-4 w-4" /> Triar com IA</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
