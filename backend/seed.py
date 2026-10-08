from datetime import datetime, timezone


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def seed_all(db, hash_password):
    if await db.departments.count_documents({}) > 0:
        # ensure users exist
        await _seed_users(db, hash_password)
        if await db.eval_cycles.count_documents({}) == 0:
            await db.eval_cycles.insert_one({
                "name": "Avaliação 360° — 1º Semestre", "period": "2026 S1",
                "description": "Ciclo semestral de avaliação de desempenho e potencial.",
                "status": "ativo", "created_at": now_iso(),
            })
        return

    deps = [
        {"name": "Tecnologia", "description": "Desenvolvimento de produtos e infraestrutura"},
        {"name": "Recursos Humanos", "description": "Gestão de pessoas e cultura"},
        {"name": "Financeiro", "description": "Controladoria e contas"},
        {"name": "Vendas", "description": "Comercial e novos negócios"},
        {"name": "Operações", "description": "Logística e processos"},
    ]
    dep_ids = {}
    for d in deps:
        d["created_at"] = now_iso()
        r = await db.departments.insert_one(d)
        dep_ids[d["name"]] = str(r.inserted_id)

    positions = [
        {"title": "Desenvolvedor(a) Backend", "dep": "Tecnologia", "min": 7000, "max": 14000},
        {"title": "Desenvolvedor(a) Frontend", "dep": "Tecnologia", "min": 6500, "max": 13000},
        {"title": "Analista de RH", "dep": "Recursos Humanos", "min": 4500, "max": 8000},
        {"title": "Analista Financeiro", "dep": "Financeiro", "min": 5000, "max": 9000},
        {"title": "Executivo(a) de Vendas", "dep": "Vendas", "min": 4000, "max": 12000},
        {"title": "Coordenador(a) de Operações", "dep": "Operações", "min": 6000, "max": 11000},
    ]
    pos_ids = {}
    for p in positions:
        doc = {"title": p["title"], "department_id": dep_ids[p["dep"]],
               "salary_min": p["min"], "salary_max": p["max"], "created_at": now_iso()}
        r = await db.positions.insert_one(doc)
        pos_ids[p["title"]] = str(r.inserted_id)

    avatars = [
        "https://images.unsplash.com/photo-1573496130141-209d200cebd8?crop=entropy&cs=srgb&fm=jpg&q=85&w=200",
    ]
    employees = [
        ("Mariana Souza", "mariana.souza@construa.com", "Recursos Humanos", "Analista de RH", 7200, "ativo"),
        ("Carlos Eduardo Silva", "carlos.silva@construa.com", "Tecnologia", "Desenvolvedor(a) Backend", 12500, "ativo"),
        ("Ana Beatriz Lima", "ana.lima@construa.com", "Tecnologia", "Desenvolvedor(a) Frontend", 11000, "ativo"),
        ("Rafael Oliveira", "rafael.oliveira@construa.com", "Vendas", "Executivo(a) de Vendas", 8500, "ativo"),
        ("Juliana Costa", "juliana.costa@construa.com", "Financeiro", "Analista Financeiro", 7800, "afastado"),
        ("Pedro Henrique Alves", "pedro.alves@construa.com", "Operações", "Coordenador(a) de Operações", 9500, "ativo"),
        ("Fernanda Rodrigues", "fernanda.rodrigues@construa.com", "Vendas", "Executivo(a) de Vendas", 7000, "ativo"),
        ("Lucas Martins", "lucas.martins@construa.com", "Tecnologia", "Desenvolvedor(a) Backend", 13000, "ativo"),
    ]
    emp_ids = {}
    for i, (name, email, dep, pos, sal, status) in enumerate(employees):
        doc = {
            "name": name, "email": email, "phone": f"(11) 9{8000+i:04d}-{1000+i:04d}",
            "cpf": f"{100+i}.{200+i}.{300+i}-0{i}", "department_id": dep_ids[dep],
            "position_id": pos_ids[pos], "salary": sal,
            "admission_date": f"202{2 if i % 2 else 3}-0{(i % 9)+1}-15",
            "status": status, "avatar": avatars[0] if name == "Mariana Souza" else "",
            "vacation_balance": 30 - (i * 2), "created_at": now_iso(),
        }
        r = await db.employees.insert_one(doc)
        emp_ids[email] = str(r.inserted_id)

    # link employee ids to users
    await _seed_users(db, hash_password, mariana_id=emp_ids.get("mariana.souza@construa.com"),
                      carlos_id=emp_ids.get("carlos.silva@construa.com"))

    # vacations
    vacs = [
        (emp_ids["carlos.silva@construa.com"], "2026-07-10", "2026-07-20", 10, "ferias", "pendente", "Férias de meio de ano"),
        (emp_ids["ana.lima@construa.com"], "2026-08-01", "2026-08-15", 15, "ferias", "pendente", "Viagem em família"),
        (emp_ids["rafael.oliveira@construa.com"], "2026-06-05", "2026-06-05", 1, "folga", "aprovado", "Folga pessoal"),
    ]
    for e, s, en, d, t, st, reason in vacs:
        await db.vacations.insert_one({"employee_id": e, "start_date": s, "end_date": en,
                                       "days": d, "type": t, "status": st, "reason": reason,
                                       "decision_note": "", "created_at": now_iso()})

    # jobs
    jobs = [
        {"title": "Engenheiro(a) de Software Pleno", "dep": "Tecnologia",
         "description": "Desenvolver e manter APIs e serviços em nuvem para nossa plataforma.",
         "requirements": "Python, FastAPI, MongoDB, Docker, 3+ anos de experiência, inglês técnico.",
         "location": "Híbrido - São Paulo", "status": "aberta"},
        {"title": "Analista de Marketing Digital", "dep": "Vendas",
         "description": "Planejar campanhas de aquisição e gerir mídias pagas.",
         "requirements": "Google Ads, Meta Ads, SEO, análise de métricas, 2+ anos.",
         "location": "Remoto", "status": "aberta"},
    ]
    for j in jobs:
        doc = {"title": j["title"], "department_id": dep_ids[j["dep"]], "description": j["description"],
               "requirements": j["requirements"], "location": j["location"], "status": j["status"],
               "created_at": now_iso()}
        await db.jobs.insert_one(doc)

    # eval cycle
    await db.eval_cycles.insert_one({
        "name": "Avaliação 360° — 1º Semestre", "period": "2026 S1",
        "description": "Ciclo semestral de avaliação de desempenho e potencial.",
        "status": "ativo", "created_at": now_iso(),
    })


async def _seed_users(db, hash_password, mariana_id=None, carlos_id=None):
    users = [
        {"email": "rh@construa.com", "name": "Mariana Souza (RH)", "role": "admin",
         "password": "rh123456", "employee_id": mariana_id},
        {"email": "colaborador@construa.com", "name": "Carlos Eduardo Silva", "role": "employee",
         "password": "colab123", "employee_id": carlos_id},
    ]
    for u in users:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            if u.get("employee_id") and not existing.get("employee_id"):
                await db.users.update_one({"_id": existing["_id"]}, {"$set": {"employee_id": u["employee_id"]}})
            continue
        await db.users.insert_one({
            "email": u["email"], "name": u["name"], "role": u["role"],
            "password_hash": hash_password(u["password"]),
            "employee_id": u.get("employee_id"), "created_at": now_iso(),
        })
