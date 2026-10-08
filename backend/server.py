from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated, Any

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator

from typesafe_sdk import Score, Noul, TypeSafeAPIError, TypeSafeError
from jev import get_jev_client

# ---------- DB ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"

app = FastAPI(title="Construa RH")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)
logger = logging.getLogger("rh")
logging.basicConfig(level=logging.INFO)


def _oid(v: Any) -> str:
    return str(v)

PyObjectId = Annotated[str, BeforeValidator(_oid)]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {"sub": user_id, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not creds:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "Usuário não encontrado")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Acesso restrito ao RH/Admin")
    return user


# ---------- Models ----------
class LoginReq(BaseModel):
    email: str
    password: str


class Department(BaseModel):
    name: str
    description: Optional[str] = ""


class Position(BaseModel):
    title: str
    department_id: Optional[str] = None
    salary_min: float = 0
    salary_max: float = 0


class Employee(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    cpf: Optional[str] = ""
    department_id: Optional[str] = None
    position_id: Optional[str] = None
    salary: float = 0
    admission_date: Optional[str] = None
    status: str = "ativo"
    avatar: Optional[str] = ""
    vacation_balance: int = 30


class AttendanceReq(BaseModel):
    employee_id: str
    type: str


class VacationReq(BaseModel):
    employee_id: str
    start_date: str
    end_date: str
    days: int
    type: str = "ferias"
    reason: Optional[str] = ""


class VacationDecision(BaseModel):
    status: str
    decision_note: Optional[str] = ""


class Job(BaseModel):
    title: str
    department_id: Optional[str] = None
    description: str
    requirements: str
    location: Optional[str] = "Remoto"
    status: str = "aberta"


class Candidate(BaseModel):
    job_id: str
    name: str
    email: str
    phone: Optional[str] = ""
    resume_text: str


class PayslipReq(BaseModel):
    employee_id: str
    competencia: str  # YYYY-MM
    bonus: float = 0
    benefits: float = 0
    other_discounts: float = 0


class PayslipAllReq(BaseModel):
    competencia: str


class EvalCycle(BaseModel):
    name: str
    period: str
    description: Optional[str] = ""
    status: str = "ativo"  # ativo, encerrado


class Evaluation(BaseModel):
    cycle_id: str
    employee_id: str
    performance: int = 3   # 1-5
    potential: int = 3     # 1-5
    entrega: int = 3
    qualidade: int = 3
    colaboracao: int = 3
    comments: Optional[str] = ""


# ---------- Auth ----------
@api.post("/auth/login")
async def login(body: LoginReq):
    user = await db.users.find_one({"email": body.email.lower().strip()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "E-mail ou senha inválidos")
    token = create_token(str(user["_id"]), user["role"])
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Departments ----------
@api.get("/departments")
async def list_departments(user: dict = Depends(get_current_user)):
    docs = await db.departments.find().to_list(500)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@api.post("/departments")
async def create_department(body: Department, user: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc["created_at"] = now_iso()
    r = await db.departments.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return doc


@api.put("/departments/{dep_id}")
async def update_department(dep_id: str, body: Department, user: dict = Depends(require_admin)):
    await db.departments.update_one({"_id": ObjectId(dep_id)}, {"$set": body.model_dump()})
    return {"ok": True}


@api.delete("/departments/{dep_id}")
async def delete_department(dep_id: str, user: dict = Depends(require_admin)):
    await db.departments.delete_one({"_id": ObjectId(dep_id)})
    return {"ok": True}


# ---------- Positions ----------
@api.get("/positions")
async def list_positions(user: dict = Depends(get_current_user)):
    docs = await db.positions.find().to_list(500)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@api.post("/positions")
async def create_position(body: Position, user: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc["created_at"] = now_iso()
    r = await db.positions.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return doc


@api.put("/positions/{pid}")
async def update_position(pid: str, body: Position, user: dict = Depends(require_admin)):
    await db.positions.update_one({"_id": ObjectId(pid)}, {"$set": body.model_dump()})
    return {"ok": True}


@api.delete("/positions/{pid}")
async def delete_position(pid: str, user: dict = Depends(require_admin)):
    await db.positions.delete_one({"_id": ObjectId(pid)})
    return {"ok": True}


# ---------- Employees ----------
@api.get("/employees")
async def list_employees(user: dict = Depends(get_current_user)):
    docs = await db.employees.find().sort("name", 1).to_list(1000)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@api.get("/employees/{emp_id}")
async def get_employee(emp_id: str, user: dict = Depends(get_current_user)):
    d = await db.employees.find_one({"_id": ObjectId(emp_id)})
    if not d:
        raise HTTPException(404, "Colaborador não encontrado")
    d["_id"] = str(d["_id"])
    return d


@api.post("/employees")
async def create_employee(body: Employee, user: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc["created_at"] = now_iso()
    r = await db.employees.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return doc


@api.put("/employees/{emp_id}")
async def update_employee(emp_id: str, body: Employee, user: dict = Depends(require_admin)):
    await db.employees.update_one({"_id": ObjectId(emp_id)}, {"$set": body.model_dump()})
    return {"ok": True}


@api.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, user: dict = Depends(require_admin)):
    await db.employees.delete_one({"_id": ObjectId(emp_id)})
    return {"ok": True}


# ---------- Attendance ----------
@api.get("/attendance")
async def list_attendance(employee_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if user.get("role") != "admin":
        employee_id = user.get("employee_id")
    if employee_id:
        q["employee_id"] = employee_id
    docs = await db.attendance.find(q).sort("timestamp", -1).to_list(1000)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@api.post("/attendance")
async def punch(body: AttendanceReq, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["timestamp"] = now_iso()
    r = await db.attendance.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return doc


# ---------- Vacations ----------
@api.get("/vacations")
async def list_vacations(employee_id: Optional[str] = None, status: Optional[str] = None,
                         user: dict = Depends(get_current_user)):
    q = {}
    if user.get("role") != "admin":
        employee_id = user.get("employee_id")
    if employee_id:
        q["employee_id"] = employee_id
    if status:
        q["status"] = status
    docs = await db.vacations.find(q).sort("created_at", -1).to_list(1000)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@api.post("/vacations")
async def request_vacation(body: VacationReq, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["status"] = "pendente"
    doc["created_at"] = now_iso()
    doc["decision_note"] = ""
    r = await db.vacations.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return doc


@api.put("/vacations/{vid}")
async def decide_vacation(vid: str, body: VacationDecision, user: dict = Depends(require_admin)):
    vac = await db.vacations.find_one({"_id": ObjectId(vid)})
    if not vac:
        raise HTTPException(404, "Solicitação não encontrada")
    await db.vacations.update_one({"_id": ObjectId(vid)},
                                  {"$set": {"status": body.status, "decision_note": body.decision_note}})
    if body.status == "aprovado" and vac["status"] != "aprovado" and vac.get("type") == "ferias":
        await db.employees.update_one({"_id": ObjectId(vac["employee_id"])},
                                      {"$inc": {"vacation_balance": -vac.get("days", 0)}})
    return {"ok": True}


# ---------- Jobs ----------
@api.get("/jobs")
async def list_jobs(user: dict = Depends(get_current_user)):
    docs = await db.jobs.find().sort("created_at", -1).to_list(500)
    for d in docs:
        d["_id"] = str(d["_id"])
        d["candidate_count"] = await db.candidates.count_documents({"job_id": d["_id"]})
    return docs


@api.post("/jobs")
async def create_job(body: Job, user: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc["created_at"] = now_iso()
    r = await db.jobs.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return doc


@api.put("/jobs/{jid}")
async def update_job(jid: str, body: Job, user: dict = Depends(require_admin)):
    await db.jobs.update_one({"_id": ObjectId(jid)}, {"$set": body.model_dump()})
    return {"ok": True}


@api.delete("/jobs/{jid}")
async def delete_job(jid: str, user: dict = Depends(require_admin)):
    await db.jobs.delete_one({"_id": ObjectId(jid)})
    await db.candidates.delete_many({"job_id": jid})
    return {"ok": True}


# ---------- Candidates + AI screening ----------
async def screen_resume(job: dict, candidate: Candidate) -> dict:
    state = {
        "vaga_titulo": job["title"],
        "vaga_descricao": job.get("description", ""),
        "vaga_requisitos": job.get("requirements", ""),
        "candidato_nome": candidate.name,
        "curriculo": candidate.resume_text,
    }
    levels = ["muito baixo", "baixo", "médio", "alto", "excelente"]
    questions = {
        "aderencia_geral": Score(instructions="Qual a aderência geral do currículo do candidato aos requisitos da vaga?", criteria=levels),
        "habilidades": Score(instructions="O quanto as habilidades técnicas do candidato atendem aos requisitos?", criteria=levels),
        "experiencia": Score(instructions="O quanto a experiência profissional do candidato é compatível com a vaga?", criteria=levels),
        "recomendar": Noul(instructions="Este candidato deve ser chamado para entrevista?"),
    }
    try:
        resp = await get_jev_client().system_one(model="jev-latest", state=state, questions=questions)
        geral = resp.scores["aderencia_geral"]
        hab = resp.scores["habilidades"]
        exp = resp.scores["experiencia"]
        rec = resp.nouls["recomendar"].noul

        def pct(s):
            return round((s.score / (len(levels) - 1)) * 100)

        score = pct(geral)
        hab_pct, exp_pct = pct(hab), pct(exp)
        rec_pct = round(rec * 100)
        geral_label = levels[max(geral.probabilities, key=geral.probabilities.get)]
        just = (
            f"A triagem por IA identificou aderência geral {geral_label} ({score}%) desta candidatura à vaga de {job['title']}. "
            f"Compatibilidade de habilidades técnicas: {hab_pct}%. Compatibilidade de experiência: {exp_pct}%. "
        )
        if rec >= 0.6:
            just += f"Recomendação: AVANÇAR para entrevista (confiança {rec_pct}%)."
        elif rec >= 0.4:
            just += f"Recomendação: avaliar com atenção — perfil intermediário (confiança {rec_pct}%)."
        else:
            just += f"Recomendação: não priorizar no momento (confiança de avanço {rec_pct}%)."
        return {"ai_score": score, "ai_skills": hab_pct, "ai_experience": exp_pct,
                "ai_recommend": rec_pct, "ai_justification": just, "ai_classified": True}
    except (TypeSafeAPIError, TypeSafeError) as exc:
        logger.warning("Jev screening failed: %s", exc)
        return {"ai_score": 0, "ai_skills": 0, "ai_experience": 0, "ai_recommend": 0,
                "ai_justification": "Triagem automática indisponível no momento. Tente reprocessar.",
                "ai_classified": False}


@api.get("/jobs/{jid}/candidates")
async def list_candidates(jid: str, user: dict = Depends(get_current_user)):
    docs = await db.candidates.find({"job_id": jid}).sort("ai_score", -1).to_list(500)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@api.post("/candidates")
async def add_candidate(body: Candidate, user: dict = Depends(require_admin)):
    job = await db.jobs.find_one({"_id": ObjectId(body.job_id)})
    if not job:
        raise HTTPException(404, "Vaga não encontrada")
    ai = await screen_resume(job, body)
    doc = body.model_dump()
    doc.update(ai)
    doc["created_at"] = now_iso()
    r = await db.candidates.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return doc


@api.post("/candidates/{cid}/rescreen")
async def rescreen(cid: str, user: dict = Depends(require_admin)):
    cand = await db.candidates.find_one({"_id": ObjectId(cid)})
    if not cand:
        raise HTTPException(404, "Candidato não encontrado")
    job = await db.jobs.find_one({"_id": ObjectId(cand["job_id"])})
    ai = await screen_resume(job, Candidate(**{k: cand[k] for k in ["job_id", "name", "email", "phone", "resume_text"]}))
    await db.candidates.update_one({"_id": ObjectId(cid)}, {"$set": ai})
    cand.update(ai)
    cand["_id"] = str(cand["_id"])
    return cand


# ---------- Dashboard ----------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    total_emp = await db.employees.count_documents({})
    active = await db.employees.count_documents({"status": "ativo"})
    afastados = await db.employees.count_documents({"status": "afastado"})
    open_jobs = await db.jobs.count_documents({"status": "aberta"})
    pending_vac = await db.vacations.count_documents({"status": "pendente"})
    total_cand = await db.candidates.count_documents({})
    deps = await db.departments.find().to_list(500)
    by_dep = []
    for d in deps:
        c = await db.employees.count_documents({"department_id": str(d["_id"])})
        by_dep.append({"name": d["name"], "count": c})
    emps = await db.employees.find({"status": {"$ne": "desligado"}}).to_list(1000)
    payroll = sum(e.get("salary", 0) for e in emps)
    return {
        "total_employees": total_emp, "active": active, "afastados": afastados,
        "open_jobs": open_jobs, "pending_vacations": pending_vac,
        "total_candidates": total_cand, "monthly_payroll": payroll,
        "headcount_by_department": by_dep,
    }


# ---------- Payroll / Holerites ----------
def calc_inss(base):
    brackets = [(1518.00, 0.075), (2793.88, 0.09), (4190.83, 0.12), (8157.41, 0.14)]
    prev = 0.0
    inss = 0.0
    for limit, rate in brackets:
        if base > prev:
            inss += (min(base, limit) - prev) * rate
            prev = limit
        else:
            break
    return round(inss, 2)


def calc_irrf(base_after_inss):
    table = [
        (2428.80, 0.0, 0.0),
        (2826.65, 0.075, 182.16),
        (3751.05, 0.15, 394.16),
        (4664.68, 0.225, 675.49),
        (float("inf"), 0.275, 908.73),
    ]
    for limit, rate, ded in table:
        if base_after_inss <= limit:
            return round(max(0.0, base_after_inss * rate - ded), 2)
    return 0.0


def build_payslip(emp, competencia, bonus=0.0, benefits=0.0, other_discounts=0.0):
    base = float(emp.get("salary", 0))
    inss = calc_inss(base)
    irrf = calc_irrf(base - inss)
    fgts = round(base * 0.08, 2)
    earnings = [{"label": "Salário base", "value": base}]
    if bonus:
        earnings.append({"label": "Bônus / Comissão", "value": round(bonus, 2)})
    if benefits:
        earnings.append({"label": "Benefícios", "value": round(benefits, 2)})
    deductions = [
        {"label": "INSS", "value": inss},
        {"label": "IRRF", "value": irrf},
    ]
    if other_discounts:
        deductions.append({"label": "Outros descontos", "value": round(other_discounts, 2)})
    gross = round(sum(e["value"] for e in earnings), 2)
    total_ded = round(sum(d["value"] for d in deductions), 2)
    net = round(gross - total_ded, 2)
    return {
        "employee_id": str(emp["_id"]), "employee_name": emp["name"],
        "competencia": competencia, "earnings": earnings, "deductions": deductions,
        "gross": gross, "total_deductions": total_ded, "net": net, "fgts": fgts,
        "created_at": now_iso(),
    }


@api.get("/payslips")
async def list_payslips(employee_id: Optional[str] = None, competencia: Optional[str] = None,
                        user: dict = Depends(get_current_user)):
    q = {}
    if user.get("role") != "admin":
        employee_id = user.get("employee_id")
    if employee_id:
        q["employee_id"] = employee_id
    if competencia:
        q["competencia"] = competencia
    docs = await db.payslips.find(q).sort("competencia", -1).to_list(2000)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@api.post("/payslips/generate")
async def generate_payslip(body: PayslipReq, user: dict = Depends(require_admin)):
    emp = await db.employees.find_one({"_id": ObjectId(body.employee_id)})
    if not emp:
        raise HTTPException(404, "Colaborador não encontrado")
    doc = build_payslip(emp, body.competencia, body.bonus, body.benefits, body.other_discounts)
    await db.payslips.delete_one({"employee_id": body.employee_id, "competencia": body.competencia})
    r = await db.payslips.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return doc


@api.post("/payslips/generate-all")
async def generate_all(body: PayslipAllReq, user: dict = Depends(require_admin)):
    emps = await db.employees.find({"status": {"$ne": "desligado"}}).to_list(1000)
    count = 0
    for emp in emps:
        doc = build_payslip(emp, body.competencia)
        await db.payslips.delete_one({"employee_id": str(emp["_id"]), "competencia": body.competencia})
        await db.payslips.insert_one(doc)
        count += 1
    return {"generated": count, "competencia": body.competencia}


@api.delete("/payslips/{pid}")
async def delete_payslip(pid: str, user: dict = Depends(require_admin)):
    await db.payslips.delete_one({"_id": ObjectId(pid)})
    return {"ok": True}


# ---------- Performance / Avaliação ----------
def nine_box(perf, pot):
    p = "baixo" if perf <= 2 else ("médio" if perf == 3 else "alto")
    t = "baixo" if pot <= 2 else ("médio" if pot == 3 else "alto")
    labels = {
        ("alto", "alto"): "Estrela",
        ("alto", "médio"): "Alto desempenho",
        ("alto", "baixo"): "Especialista",
        ("médio", "alto"): "Forte potencial",
        ("médio", "médio"): "Mantenedor",
        ("médio", "baixo"): "Profissional eficaz",
        ("baixo", "alto"): "Enigma",
        ("baixo", "médio"): "Em desenvolvimento",
        ("baixo", "baixo"): "Risco / atenção",
    }
    return {"perf_level": p, "pot_level": t, "label": labels[(t, p)]}


@api.get("/eval-cycles")
async def list_cycles(user: dict = Depends(get_current_user)):
    docs = await db.eval_cycles.find().sort("created_at", -1).to_list(200)
    for d in docs:
        d["_id"] = str(d["_id"])
        d["eval_count"] = await db.evaluations.count_documents({"cycle_id": d["_id"]})
    return docs


@api.post("/eval-cycles")
async def create_cycle(body: EvalCycle, user: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc["created_at"] = now_iso()
    r = await db.eval_cycles.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return doc


@api.put("/eval-cycles/{cid}")
async def update_cycle(cid: str, body: EvalCycle, user: dict = Depends(require_admin)):
    await db.eval_cycles.update_one({"_id": ObjectId(cid)}, {"$set": body.model_dump()})
    return {"ok": True}


@api.delete("/eval-cycles/{cid}")
async def delete_cycle(cid: str, user: dict = Depends(require_admin)):
    await db.eval_cycles.delete_one({"_id": ObjectId(cid)})
    await db.evaluations.delete_many({"cycle_id": cid})
    return {"ok": True}


@api.get("/evaluations")
async def list_evaluations(cycle_id: Optional[str] = None, employee_id: Optional[str] = None,
                           user: dict = Depends(get_current_user)):
    q = {}
    if user.get("role") != "admin":
        employee_id = user.get("employee_id")
    if cycle_id:
        q["cycle_id"] = cycle_id
    if employee_id:
        q["employee_id"] = employee_id
    docs = await db.evaluations.find(q).sort("created_at", -1).to_list(2000)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs


@api.post("/evaluations")
async def create_evaluation(body: Evaluation, user: dict = Depends(require_admin)):
    emp = await db.employees.find_one({"_id": ObjectId(body.employee_id)})
    doc = body.model_dump()
    doc["employee_name"] = emp["name"] if emp else ""
    doc["overall"] = round((body.entrega + body.qualidade + body.colaboracao) / 3, 2)
    doc["nine_box"] = nine_box(body.performance, body.potential)
    doc["created_at"] = now_iso()
    await db.evaluations.delete_one({"cycle_id": body.cycle_id, "employee_id": body.employee_id})
    r = await db.evaluations.insert_one(doc)
    doc["_id"] = str(r.inserted_id)
    return doc


@api.delete("/evaluations/{eid}")
async def delete_evaluation(eid: str, user: dict = Depends(require_admin)):
    await db.evaluations.delete_one({"_id": ObjectId(eid)})
    return {"ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    from seed import seed_all
    await seed_all(db, hash_password)


@app.on_event("shutdown")
async def shutdown():
    client.close()
