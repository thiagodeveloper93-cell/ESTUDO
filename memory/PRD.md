# Construa RH — PRD

## Problem Statement
Build a Human Resources (RH) management web platform in Portuguese (pt-BR) with an admin area for the HR team and a self-service portal for employees. Includes AI-powered resume screening.

## Architecture
- Backend: FastAPI + MongoDB (motor). JWT Bearer auth (bcrypt). `/app/backend/server.py`, seed in `seed.py`, Jev client in `jev.py`.
- Frontend: Vite + React 19 + Tailwind v4 + shadcn/ui. Auth context stores token in localStorage (`rh_token`). Pages under `/app/frontend/src/pages`.
- AI: Jev typesafe SDK (model `jev-latest`) via Emergent universal key (EMERGENT_LLM_KEY) for resume screening — scores aderência/habilidades/experiência + recomendação, composes pt-BR justification.

## Personas
- Admin/RH: full access (dashboard, employees, org, attendance, vacations approval, recruitment).
- Colaborador: own portal, clock-in/out, request vacations.

## Core Requirements (static)
Role-based login, HR dashboard KPIs, Employees CRUD + filters, Departments & Positions, Attendance, Vacations request/approval, AI Recruitment (jobs + candidates ranked by AI), Employee portal.

## Implemented (2026-10-08)
- JWT auth with admin/employee roles + seeded demo accounts.
- Dashboard with 6 KPIs + headcount-by-department chart.
- Employees CRUD with search + department/status filters.
- Departments & Positions management.
- Attendance punch (entrada/saida) + espelho de ponto.
- Vacations request + approve/reject flow with balance decrement.
- Recruitment: jobs CRUD + candidate AI screening (Jev) with score, skills, experience, justification, ranking, rescreen.
- Employee self-service portal.
- Realistic Brazilian seed data. Tested: 23/23 backend + all frontend flows pass.

## Implemented — Fase 2 (2026-10-08)
- Folha & Holerites: geração individual e em massa por competência, cálculo de INSS/IRRF progressivos + FGTS, holerite em modal com impressão/PDF, exclusão. Idempotente por colaborador+competência.
- Avaliação de Desempenho: ciclos de avaliação, notas (entrega/qualidade/colaboração + desempenho/potencial), nota geral e matriz Nine Box com rótulos.
- Portal do colaborador: página "Meus Holerites".
- Segurança: endpoints de listagem (payslips, evaluations, attendance, vacations) escopados por employee_id para usuários com papel employee.
- Testado: 33/33 backend + todos os fluxos de frontend da Fase 2 aprovados.

## Backlog (future)
- P2: Dark mode toggle, pagination on lists, Cmd+K universal search.
- P2: Brute-force protection + explicit CORS origins for prod; migrate @app.on_event to lifespan.
- P3: Resumo por IA dos pontos fortes/lacunas de cada currículo.

## Jun 2026
- Usuário orientado a exportar o código (Save to Github / editor Code). Sem mudanças no código.
