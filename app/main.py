from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from datetime import datetime, date
import os

from .database import init_db, get_db
from .routers import tools, clients, rentals, platforms

app = FastAPI(title="LocOutil")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/uploads")

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

app.include_router(tools.router)
app.include_router(clients.router)
app.include_router(rentals.router)
app.include_router(platforms.router)

@app.on_event("startup")
def startup():
    os.makedirs(os.path.join(UPLOAD_DIR, "tools"), exist_ok=True)
    os.makedirs(os.path.join(UPLOAD_DIR, "clients"), exist_ok=True)
    init_db()

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/dashboard")
def dashboard():
    today = date.today().isoformat()
    month = today[:7]
    with get_db() as conn:
        active = conn.execute("SELECT COUNT(*) FROM rentals WHERE status IN ('confirmed','ongoing') AND end_date >= ?", (today,)).fetchone()[0]
        revenue_month = conn.execute("SELECT COALESCE(SUM(price),0) FROM rentals WHERE status != 'cancelled' AND start_date LIKE ?", (f"{month}%",)).fetchone()[0]
        revenue_total = conn.execute("SELECT COALESCE(SUM(price),0) FROM rentals WHERE status != 'cancelled'").fetchone()[0]
        returning_soon = conn.execute("""
            SELECT r.*, t.name as tool_name, c.name as client_name
            FROM rentals r JOIN tools t ON t.id=r.tool_id JOIN clients c ON c.id=r.client_id
            WHERE r.status IN ('confirmed','ongoing') AND r.end_date >= ? AND r.end_date <= date(?, '+7 days')
            ORDER BY r.end_date
        """, (today, today)).fetchall()
        tools_count = conn.execute("SELECT COUNT(*) FROM tools").fetchone()[0]
        clients_count = conn.execute("SELECT COUNT(*) FROM clients").fetchone()[0]
        pending_deposit = conn.execute("SELECT COUNT(*) FROM rentals WHERE status != 'cancelled' AND deposit_collected=1 AND deposit_returned=0 AND end_date < ?", (today,)).fetchone()[0]
    return {
        "active_rentals": active,
        "revenue_month": revenue_month,
        "revenue_total": revenue_total,
        "returning_soon": [dict(r) for r in returning_soon],
        "tools_count": tools_count,
        "clients_count": clients_count,
        "pending_deposit_return": pending_deposit,
        "current_month": month
    }
