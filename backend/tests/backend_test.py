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
