"""Construa RH backend tests (pytest). Uses external REACT_APP_BACKEND_URL."""
import os
import time
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "rh@construa.com", "password": "rh123456"}
EMP = {"email": "colaborador@construa.com", "password": "colab123"}


# ------- Fixtures -------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def emp_token():
    r = requests.post(f"{API}/auth/login", json=EMP, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def emp_h(emp_token):
    return {"Authorization": f"Bearer {emp_token}"}


# ------- Auth -------
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN["email"]

    def test_employee_login(self):
        r = requests.post(f"{API}/auth/login", json=EMP, timeout=30)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "employee"

    def test_bad_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": "x@y.com", "password": "bad"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_token(self):
        assert requests.get(f"{API}/auth/me", timeout=30).status_code in (401, 403)

    def test_me_with_token(self, admin_h):
        r = requests.get(f"{API}/auth/me", headers=admin_h, timeout=30)
        assert r.status_code == 200 and r.json()["role"] == "admin"


# ------- Dashboard -------
class TestDashboard:
    def test_kpis(self, admin_h):
        r = requests.get(f"{API}/dashboard", headers=admin_h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_employees", "active", "afastados", "open_jobs",
                  "pending_vacations", "monthly_payroll", "headcount_by_department"]:
            assert k in d
        assert d["total_employees"] >= 8
        assert isinstance(d["headcount_by_department"], list)
        assert d["monthly_payroll"] > 0


# ------- Departments & Positions -------
class TestOrganization:
    def test_list_departments(self, admin_h):
        r = requests.get(f"{API}/departments", headers=admin_h, timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_create_department(self, admin_h):
        r = requests.post(f"{API}/departments", headers=admin_h,
                          json={"name": "TEST_Dep", "description": "temp"}, timeout=30)
        assert r.status_code == 200
        did = r.json()["_id"]
        # cleanup
        requests.delete(f"{API}/departments/{did}", headers=admin_h, timeout=30)

    def test_list_positions(self, admin_h):
        r = requests.get(f"{API}/positions", headers=admin_h, timeout=30)
        assert r.status_code == 200 and len(r.json()) >= 6

    def test_create_position(self, admin_h):
        deps = requests.get(f"{API}/departments", headers=admin_h, timeout=30).json()
        r = requests.post(f"{API}/positions", headers=admin_h,
                          json={"title": "TEST_Pos", "department_id": deps[0]["_id"],
                                "salary_min": 1000, "salary_max": 2000}, timeout=30)
        assert r.status_code == 200
        requests.delete(f"{API}/positions/{r.json()['_id']}", headers=admin_h, timeout=30)


# ------- Employees -------
class TestEmployees:
    def test_list(self, admin_h):
        r = requests.get(f"{API}/employees", headers=admin_h, timeout=30)
        assert r.status_code == 200 and len(r.json()) >= 8

    def test_crud(self, admin_h):
        deps = requests.get(f"{API}/departments", headers=admin_h, timeout=30).json()
        payload = {"name": "TEST_User", "email": "test_user@construa.com",
                   "department_id": deps[0]["_id"], "salary": 5000, "status": "ativo"}
        r = requests.post(f"{API}/employees", headers=admin_h, json=payload, timeout=30)
        assert r.status_code == 200
        eid = r.json()["_id"]
        # verify persistence
        g = requests.get(f"{API}/employees/{eid}", headers=admin_h, timeout=30)
        assert g.status_code == 200 and g.json()["name"] == "TEST_User"
        # update
        payload["name"] = "TEST_User_Updated"
        u = requests.put(f"{API}/employees/{eid}", headers=admin_h, json=payload, timeout=30)
        assert u.status_code == 200
        g2 = requests.get(f"{API}/employees/{eid}", headers=admin_h, timeout=30)
        assert g2.json()["name"] == "TEST_User_Updated"
        # delete
        d = requests.delete(f"{API}/employees/{eid}", headers=admin_h, timeout=30)
        assert d.status_code == 200
        assert requests.get(f"{API}/employees/{eid}", headers=admin_h, timeout=30).status_code == 404


# ------- Role enforcement -------
class TestRole:
    def test_employee_cannot_create_employee(self, emp_h):
        r = requests.post(f"{API}/employees", headers=emp_h,
                          json={"name": "x", "email": "x@x.com"}, timeout=30)
        assert r.status_code == 403

    def test_employee_cannot_create_department(self, emp_h):
        r = requests.post(f"{API}/departments", headers=emp_h,
                          json={"name": "x"}, timeout=30)
        assert r.status_code == 403

    def test_employee_can_read(self, emp_h):
        assert requests.get(f"{API}/employees", headers=emp_h, timeout=30).status_code == 200


# ------- Attendance -------
class TestAttendance:
    def test_punch(self, admin_h):
        emps = requests.get(f"{API}/employees", headers=admin_h, timeout=30).json()
        eid = emps[0]["_id"]
        r1 = requests.post(f"{API}/attendance", headers=admin_h,
                           json={"employee_id": eid, "type": "entrada"}, timeout=30)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/attendance", headers=admin_h,
                           json={"employee_id": eid, "type": "saida"}, timeout=30)
        assert r2.status_code == 200
        lst = requests.get(f"{API}/attendance?employee_id={eid}", headers=admin_h, timeout=30)
        assert lst.status_code == 200 and len(lst.json()) >= 2


# ------- Vacations -------
class TestVacations:
    def test_list_all(self, admin_h):
        r = requests.get(f"{API}/vacations", headers=admin_h, timeout=30)
        assert r.status_code == 200 and len(r.json()) >= 3

    def test_employee_can_create_request(self, emp_h, emp_token):
        me = requests.get(f"{API}/auth/me", headers=emp_h, timeout=30).json()
        eid = me.get("employee_id")
        assert eid, "employee user should have employee_id"
        payload = {"employee_id": eid, "start_date": "2026-12-01",
                   "end_date": "2026-12-05", "days": 5, "type": "ferias", "reason": "teste"}
        r = requests.post(f"{API}/vacations", headers=emp_h, json=payload, timeout=30)
        assert r.status_code == 200 and r.json()["status"] == "pendente"

    def test_admin_approve(self, admin_h):
        pend = requests.get(f"{API}/vacations?status=pendente", headers=admin_h, timeout=30).json()
        assert pend, "need pending vacation"
        vid = pend[0]["_id"]
        r = requests.put(f"{API}/vacations/{vid}", headers=admin_h,
                         json={"status": "aprovado", "decision_note": "ok"}, timeout=30)
        assert r.status_code == 200


# ------- Recruitment / AI -------
class TestRecruitment:
    def test_list_jobs(self, admin_h):
        r = requests.get(f"{API}/jobs", headers=admin_h, timeout=30)
        assert r.status_code == 200 and len(r.json()) >= 2

    def test_create_job(self, admin_h):
        deps = requests.get(f"{API}/departments", headers=admin_h, timeout=30).json()
        r = requests.post(f"{API}/jobs", headers=admin_h, json={
            "title": "TEST_Vaga", "department_id": deps[0]["_id"],
            "description": "Teste", "requirements": "Python",
            "location": "Remoto", "status": "aberta"}, timeout=30)
        assert r.status_code == 200
        requests.delete(f"{API}/jobs/{r.json()['_id']}", headers=admin_h, timeout=30)

    def test_candidate_ai_screening(self, admin_h):
        jobs = requests.get(f"{API}/jobs", headers=admin_h, timeout=30).json()
        # pick tech job
        job = next((j for j in jobs if "Software" in j["title"]), jobs[0])
        resume = ("Engenheiro de software com 5 anos de experiência em Python e FastAPI. "
                  "Trabalhou com MongoDB, Docker, AWS. Inglês avançado. Formado em "
                  "Ciência da Computação. Líder técnico em projetos de APIs em nuvem.")
        payload = {"job_id": job["_id"], "name": "TEST_Candidato Pleno",
                   "email": "test_cand@x.com", "phone": "11999", "resume_text": resume}
        r = requests.post(f"{API}/candidates", headers=admin_h, json=payload, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["ai_score", "ai_skills", "ai_experience", "ai_justification", "ai_classified"]:
            assert k in d
        print(f"\nAI result: score={d['ai_score']} skills={d['ai_skills']} exp={d['ai_experience']} classified={d['ai_classified']}")
        print(f"Justification: {d['ai_justification']}")
        # if Jev worked, score/justification should be meaningful
        if d["ai_classified"]:
            assert 0 <= d["ai_score"] <= 100
            assert len(d["ai_justification"]) > 20
            assert any(w in d["ai_justification"].lower() for w in ["aderência", "candidat", "vaga", "recomend"])
        cid = d["_id"]

        # candidate list ranked by score
        lst = requests.get(f"{API}/jobs/{job['_id']}/candidates", headers=admin_h, timeout=30).json()
        assert any(c["_id"] == cid for c in lst)
        scores = [c.get("ai_score", 0) for c in lst]
        assert scores == sorted(scores, reverse=True), "candidates not ranked by ai_score desc"

        # rescreen
        rs = requests.post(f"{API}/candidates/{cid}/rescreen", headers=admin_h, timeout=120)
        assert rs.status_code == 200
        assert "ai_score" in rs.json()

    def test_employee_cannot_add_candidate(self, emp_h):
        jobs_h = {"Authorization": emp_h["Authorization"]}
        jobs = requests.get(f"{API}/jobs", headers=jobs_h, timeout=30).json()
        r = requests.post(f"{API}/candidates", headers=emp_h, json={
            "job_id": jobs[0]["_id"], "name": "x", "email": "x@x.com", "resume_text": "x"
        }, timeout=30)
        assert r.status_code == 403


# ------- Phase 2: Payroll / Holerites -------
COMPETENCIA = "2026-06"

class TestPayroll:
    def test_generate_all(self, admin_h):
        r = requests.post(f"{API}/payslips/generate-all", headers=admin_h,
                          json={"competencia": COMPETENCIA}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["competencia"] == COMPETENCIA
        assert d["generated"] >= 8

    def test_list_filter(self, admin_h):
        r = requests.get(f"{API}/payslips?competencia={COMPETENCIA}", headers=admin_h, timeout=30)
        assert r.status_code == 200
        lst = r.json()
        assert len(lst) >= 8
        for p in lst:
            assert p["competencia"] == COMPETENCIA
            assert p["gross"] > 0
            assert p["net"] <= p["gross"]
            assert p["fgts"] == round(p["earnings"][0]["value"] * 0.08, 2)
            labels = [d["label"] for d in p["deductions"]]
            assert "INSS" in labels and "IRRF" in labels

    def test_inss_irrf_values(self, admin_h):
        # Verify specific calculation on highest-salary employee
        emps = requests.get(f"{API}/employees", headers=admin_h, timeout=30).json()
        emp = max(emps, key=lambda e: e.get("salary", 0))
        base = emp["salary"]
        # Compute expected INSS progressively
        def exp_inss(b):
            brackets = [(1518.00,0.075),(2793.88,0.09),(4190.83,0.12),(8157.41,0.14)]
            prev,i=0.0,0.0
            for lim,rate in brackets:
                if b>prev:
                    i+=(min(b,lim)-prev)*rate; prev=lim
                else: break
            return round(i,2)
        expected_inss = exp_inss(base)
        pay = requests.get(f"{API}/payslips?employee_id={emp['_id']}&competencia={COMPETENCIA}",
                           headers=admin_h, timeout=30).json()
        assert pay, "payslip missing after generate-all"
        inss = next(d["value"] for d in pay[0]["deductions"] if d["label"] == "INSS")
        assert abs(inss - expected_inss) < 0.05

    def test_generate_single_with_bonus(self, admin_h):
        emps = requests.get(f"{API}/employees", headers=admin_h, timeout=30).json()
        eid = emps[0]["_id"]
        r = requests.post(f"{API}/payslips/generate", headers=admin_h,
                          json={"employee_id": eid, "competencia": "2026-07",
                                "bonus": 500, "benefits": 200, "other_discounts": 100}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        labels_e = [e["label"] for e in d["earnings"]]
        labels_d = [x["label"] for x in d["deductions"]]
        assert "Bônus / Comissão" in labels_e
        assert "Benefícios" in labels_e
        assert "Outros descontos" in labels_d
        # idempotency: generate again
        r2 = requests.post(f"{API}/payslips/generate", headers=admin_h,
                           json={"employee_id": eid, "competencia": "2026-07",
                                 "bonus": 500, "benefits": 200, "other_discounts": 100}, timeout=30)
        assert r2.status_code == 200
        lst = requests.get(f"{API}/payslips?employee_id={eid}&competencia=2026-07",
                           headers=admin_h, timeout=30).json()
        assert len(lst) == 1, "generate should be idempotent per employee+competencia"
        # delete
        pid = lst[0]["_id"]
        rd = requests.delete(f"{API}/payslips/{pid}", headers=admin_h, timeout=30)
        assert rd.status_code == 200

    def test_employee_cannot_generate(self, emp_h):
        r = requests.post(f"{API}/payslips/generate", headers=emp_h,
                          json={"employee_id": "x", "competencia": COMPETENCIA}, timeout=30)
        assert r.status_code == 403

    def test_employee_sees_only_own(self, emp_h, emp_token):
        me = requests.get(f"{API}/auth/me", headers=emp_h, timeout=30).json()
        eid = me.get("employee_id")
        assert eid
        r = requests.get(f"{API}/payslips?employee_id={eid}", headers=emp_h, timeout=30)
        assert r.status_code == 200
        lst = r.json()
        assert len(lst) >= 1
        for p in lst:
            assert p["employee_id"] == eid


# ------- Phase 2: Performance / Nine Box -------
class TestPerformance:
    def test_seeded_cycle(self, admin_h):
        r = requests.get(f"{API}/eval-cycles", headers=admin_h, timeout=30)
        assert r.status_code == 200
        cycles = r.json()
        assert len(cycles) >= 1
        assert any("360" in c["name"] or "Avalia" in c["name"] for c in cycles)

    def test_create_cycle_and_eval(self, admin_h):
        r = requests.post(f"{API}/eval-cycles", headers=admin_h,
                          json={"name": "TEST_Ciclo", "period": "2026-S1",
                                "description": "teste", "status": "ativo"}, timeout=30)
        assert r.status_code == 200
        cid = r.json()["_id"]
        try:
            emps = requests.get(f"{API}/employees", headers=admin_h, timeout=30).json()
            eid = emps[0]["_id"]
            payload = {"cycle_id": cid, "employee_id": eid,
                       "performance": 5, "potential": 5,
                       "entrega": 4, "qualidade": 5, "colaboracao": 3,
                       "comments": "ótimo"}
            r = requests.post(f"{API}/evaluations", headers=admin_h, json=payload, timeout=30)
            assert r.status_code == 200
            d = r.json()
            assert d["overall"] == round((4+5+3)/3, 2)
            assert d["nine_box"]["label"] == "Estrela"
            assert d["employee_name"] == emps[0]["name"]

            # Low perf+pot -> Risco
            r2 = requests.post(f"{API}/evaluations", headers=admin_h, json={
                "cycle_id": cid, "employee_id": emps[1]["_id"],
                "performance": 1, "potential": 1,
                "entrega": 1, "qualidade": 2, "colaboracao": 2}, timeout=30)
            assert r2.json()["nine_box"]["label"] == "Risco / atenção"

            # filter list by cycle
            lst = requests.get(f"{API}/evaluations?cycle_id={cid}", headers=admin_h, timeout=30).json()
            assert len(lst) == 2
            for e in lst:
                assert e["cycle_id"] == cid

            # idempotency: same employee+cycle replaces
            r3 = requests.post(f"{API}/evaluations", headers=admin_h, json=payload, timeout=30)
            assert r3.status_code == 200
            lst2 = requests.get(f"{API}/evaluations?cycle_id={cid}", headers=admin_h, timeout=30).json()
            assert len(lst2) == 2

            # delete eval
            eid_eval = r3.json()["_id"]
            rd = requests.delete(f"{API}/evaluations/{eid_eval}", headers=admin_h, timeout=30)
            assert rd.status_code == 200
        finally:
            requests.delete(f"{API}/eval-cycles/{cid}", headers=admin_h, timeout=30)

    def test_employee_cannot_evaluate(self, emp_h, admin_h):
        cycles = requests.get(f"{API}/eval-cycles", headers=admin_h, timeout=30).json()
        emps = requests.get(f"{API}/employees", headers=admin_h, timeout=30).json()
        r = requests.post(f"{API}/evaluations", headers=emp_h, json={
            "cycle_id": cycles[0]["_id"], "employee_id": emps[0]["_id"]}, timeout=30)
        assert r.status_code == 403

    def test_employee_cannot_create_cycle(self, emp_h):
        r = requests.post(f"{API}/eval-cycles", headers=emp_h,
                          json={"name": "x", "period": "x"}, timeout=30)
        assert r.status_code == 403



# ------- Phase 3: Goals / Metas & OKRs -------
class TestGoals:
    def _get_cycle(self, admin_h):
        cycles = requests.get(f"{API}/eval-cycles", headers=admin_h, timeout=30).json()
        return cycles[0]["_id"]

    def _get_emp_employee_id(self, emp_h):
        me = requests.get(f"{API}/auth/me", headers=emp_h, timeout=30).json()
        return me.get("employee_id")

    def test_admin_create_goal_and_list(self, admin_h, emp_h):
        cid = self._get_cycle(admin_h)
        own_eid = self._get_emp_employee_id(emp_h)
        assert own_eid
        payload = {"cycle_id": cid, "employee_id": own_eid,
                   "title": "TEST_Meta_Carlos", "description": "teste",
                   "progress": 20}
        r = requests.post(f"{API}/goals", headers=admin_h, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["title"] == "TEST_Meta_Carlos"
        assert g["progress"] == 20
        assert g["status"] == "em_andamento"
        assert g.get("employee_name")
        gid = g["_id"]

        # list filtered by cycle
        lst = requests.get(f"{API}/goals?cycle_id={cid}", headers=admin_h, timeout=30).json()
        assert any(x["_id"] == gid for x in lst)

        # employee GET scoped to own employee_id (no param)
        emp_lst = requests.get(f"{API}/goals", headers=emp_h, timeout=30).json()
        assert all(x["employee_id"] == own_eid for x in emp_lst)
        assert any(x["_id"] == gid for x in emp_lst)

        # employee updates own progress
        upd = requests.put(f"{API}/goals/{gid}", headers=emp_h,
                           json={"progress": 50}, timeout=30)
        assert upd.status_code == 200
        assert upd.json()["progress"] == 50
        assert upd.json()["status"] == "em_andamento"

        # auto-concluida at 100
        upd2 = requests.put(f"{API}/goals/{gid}", headers=admin_h,
                            json={"progress": 100}, timeout=30)
        assert upd2.status_code == 200
        assert upd2.json()["progress"] == 100
        assert upd2.json()["status"] == "concluida"

        # clamp above 100
        upd3 = requests.put(f"{API}/goals/{gid}", headers=admin_h,
                            json={"progress": 150}, timeout=30)
        assert upd3.json()["progress"] == 100

        # delete
        rd = requests.delete(f"{API}/goals/{gid}", headers=admin_h, timeout=30)
        assert rd.status_code == 200

    def test_employee_cannot_create_goal(self, emp_h, admin_h):
        cid = self._get_cycle(admin_h)
        own_eid = self._get_emp_employee_id(emp_h)
        r = requests.post(f"{API}/goals", headers=emp_h,
                          json={"cycle_id": cid, "employee_id": own_eid,
                                "title": "x", "progress": 0}, timeout=30)
        assert r.status_code == 403

    def test_employee_cannot_update_others_goal(self, admin_h, emp_h):
        cid = self._get_cycle(admin_h)
        # pick an employee that is not Carlos
        emps = requests.get(f"{API}/employees", headers=admin_h, timeout=30).json()
        own_eid = self._get_emp_employee_id(emp_h)
        other = next(e for e in emps if e["_id"] != own_eid)
        r = requests.post(f"{API}/goals", headers=admin_h, json={
            "cycle_id": cid, "employee_id": other["_id"],
            "title": "TEST_OtherGoal", "progress": 10}, timeout=30)
        assert r.status_code == 200
        gid = r.json()["_id"]
        try:
            # employee tries to update someone else's goal -> 403
            upd = requests.put(f"{API}/goals/{gid}", headers=emp_h,
                               json={"progress": 90}, timeout=30)
            assert upd.status_code == 403
        finally:
            requests.delete(f"{API}/goals/{gid}", headers=admin_h, timeout=30)

    def test_update_nonexistent_goal(self, admin_h):
        fake = "507f1f77bcf86cd799439011"
        r = requests.put(f"{API}/goals/{fake}", headers=admin_h,
                         json={"progress": 10}, timeout=30)
        assert r.status_code == 404


# ------- Phase 3: Payslip Email (disabled - RESEND_API_KEY empty) -------
class TestPayslipEmail:
    def test_email_returns_not_configured(self, admin_h):
        # pick any payslip (TestPayroll generated 2026-06 for all)
        lst = requests.get(f"{API}/payslips?competencia=2026-06", headers=admin_h, timeout=30).json()
        if not lst:
            # generate on the fly
            requests.post(f"{API}/payslips/generate-all", headers=admin_h,
                          json={"competencia": "2026-06"}, timeout=60)
            lst = requests.get(f"{API}/payslips?competencia=2026-06", headers=admin_h, timeout=30).json()
        assert lst, "need at least one payslip"
        pid = lst[0]["_id"]
        r = requests.post(f"{API}/payslips/{pid}/email", headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sent"] is False
        assert d["configured"] is False
        assert "RESEND_API_KEY" in d["message"] or "configurado" in d["message"].lower()

    def test_email_employee_forbidden(self, emp_h, admin_h):
        lst = requests.get(f"{API}/payslips?competencia=2026-06", headers=admin_h, timeout=30).json()
        if lst:
            r = requests.post(f"{API}/payslips/{lst[0]['_id']}/email", headers=emp_h, timeout=30)
            assert r.status_code == 403

    def test_email_payslip_not_found(self, admin_h):
        fake = "507f1f77bcf86cd799439011"
        r = requests.post(f"{API}/payslips/{fake}/email", headers=admin_h, timeout=30)
        assert r.status_code == 404


# ------- Phase 3: AI Summary (LLM via EMERGENT_LLM_KEY) -------
class TestAISummary:
    def test_ai_summary_generation(self, admin_h):
        # Create job + candidate for the summary
        deps = requests.get(f"{API}/departments", headers=admin_h, timeout=30).json()
        j = requests.post(f"{API}/jobs", headers=admin_h, json={
            "title": "TEST_Dev Python", "department_id": deps[0]["_id"],
            "description": "Desenvolvedor backend Python com FastAPI e MongoDB",
            "requirements": "Python, FastAPI, MongoDB, Docker, 3+ anos",
            "location": "Remoto", "status": "aberta"}, timeout=30).json()
        jid = j["_id"]
        try:
            resume = ("Desenvolvedor backend com 5 anos de experiência em Python, FastAPI e MongoDB. "
                      "Experiência com Docker, AWS e microsserviços. Inglês avançado.")
            c = requests.post(f"{API}/candidates", headers=admin_h, json={
                "job_id": jid, "name": "TEST_IA_Cand", "email": "iacand@x.com",
                "phone": "11", "resume_text": resume}, timeout=120).json()
            cid = c["_id"]

            # Call AI summary (slow - LLM)
            r = requests.post(f"{API}/candidates/{cid}/ai-summary",
                              headers=admin_h, timeout=120)
            assert r.status_code == 200, r.text
            d = r.json()
            assert "ai_summary" in d
            s = d["ai_summary"]
            assert isinstance(s.get("pontos_fortes"), list) and len(s["pontos_fortes"]) >= 1
            assert isinstance(s.get("lacunas"), list)
            assert isinstance(s.get("recomendacao"), str) and len(s["recomendacao"]) > 0
            print(f"\nAI Summary: fortes={len(s['pontos_fortes'])} lacunas={len(s['lacunas'])} rec={s['recomendacao'][:80]}")

            # persisted on candidate
            lst = requests.get(f"{API}/jobs/{jid}/candidates", headers=admin_h, timeout=30).json()
            cand = next(x for x in lst if x["_id"] == cid)
            assert "ai_summary" in cand
        finally:
            requests.delete(f"{API}/jobs/{jid}", headers=admin_h, timeout=30)

    def test_ai_summary_employee_forbidden(self, emp_h, admin_h):
        # need any candidate id - just use fake id since 403 must trigger before lookup
        fake = "507f1f77bcf86cd799439011"
        r = requests.post(f"{API}/candidates/{fake}/ai-summary", headers=emp_h, timeout=30)
        assert r.status_code == 403

    def test_ai_summary_not_found(self, admin_h):
        fake = "507f1f77bcf86cd799439011"
        r = requests.post(f"{API}/candidates/{fake}/ai-summary", headers=admin_h, timeout=30)
        assert r.status_code == 404
