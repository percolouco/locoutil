from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..database import get_db

router = APIRouter(prefix="/api/rentals", tags=["rentals"])

class RentalCreate(BaseModel):
    tool_id: int
    client_id: int
    platform_id: Optional[int] = None
    start_date: str
    end_date: str
    price: float
    deposit_collected: bool = False
    return_notes: str = ""
    status: str = "confirmed"

class RentalUpdate(BaseModel):
    platform_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    price: Optional[float] = None
    deposit_collected: Optional[bool] = None
    deposit_returned: Optional[bool] = None
    status: Optional[str] = None
    return_notes: Optional[str] = None

def rental_full(conn, row):
    r = dict(row)
    tool = conn.execute("SELECT id, name, daily_price, weekend_price, deposit FROM tools WHERE id = ?", (r["tool_id"],)).fetchone()
    client = conn.execute("SELECT id, name, phone, email FROM clients WHERE id = ?", (r["client_id"],)).fetchone()
    platform = conn.execute("SELECT id, name FROM platforms WHERE id = ?", (r["platform_id"],)).fetchone() if r.get("platform_id") else None
    r["tool"] = dict(tool) if tool else None
    r["client"] = dict(client) if client else None
    r["platform"] = dict(platform) if platform else None
    return r

@router.get("")
def list_rentals(status: Optional[str] = None, tool_id: Optional[int] = None, month: Optional[str] = None):
    with get_db() as conn:
        q = "SELECT * FROM rentals WHERE 1=1"
        params = []
        if status:
            q += " AND status = ?"; params.append(status)
        if tool_id:
            q += " AND tool_id = ?"; params.append(tool_id)
        if month:
            q += " AND (start_date LIKE ? OR end_date LIKE ?)"; params += [f"{month}%", f"{month}%"]
        q += " ORDER BY start_date DESC"
        rows = conn.execute(q, params).fetchall()
        return [rental_full(conn, r) for r in rows]

@router.get("/calendar")
def calendar_rentals(year: int, month: int):
    with get_db() as conn:
        month_str = f"{year}-{month:02d}"
        rows = conn.execute("""
            SELECT r.*, t.name as tool_name, c.name as client_name, p.name as platform_name
            FROM rentals r
            JOIN tools t ON t.id = r.tool_id
            JOIN clients c ON c.id = r.client_id
            LEFT JOIN platforms p ON p.id = r.platform_id
            WHERE r.status != 'cancelled'
              AND r.start_date <= ? AND r.end_date >= ?
            ORDER BY r.start_date
        """, (f"{year}-{month:02d}-31", f"{year}-{month:02d}-01")).fetchall()
        return [dict(r) for r in rows]

@router.get("/{rental_id}")
def get_rental(rental_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM rentals WHERE id = ?", (rental_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Location introuvable")
        return rental_full(conn, row)

@router.post("", status_code=201)
def create_rental(data: RentalCreate):
    with get_db() as conn:
        if not conn.execute("SELECT id FROM tools WHERE id = ?", (data.tool_id,)).fetchone():
            raise HTTPException(404, "Outil introuvable")
        if not conn.execute("SELECT id FROM clients WHERE id = ?", (data.client_id,)).fetchone():
            raise HTTPException(404, "Client introuvable")
        cur = conn.execute(
            "INSERT INTO rentals (tool_id, client_id, platform_id, start_date, end_date, price, deposit_collected, status, return_notes) VALUES (?,?,?,?,?,?,?,?,?)",
            (data.tool_id, data.client_id, data.platform_id, data.start_date, data.end_date, data.price, 1 if data.deposit_collected else 0, data.status, data.return_notes)
        )
        return rental_full(conn, conn.execute("SELECT * FROM rentals WHERE id = ?", (cur.lastrowid,)).fetchone())

@router.put("/{rental_id}")
def update_rental(rental_id: int, data: RentalUpdate):
    with get_db() as conn:
        if not conn.execute("SELECT id FROM rentals WHERE id = ?", (rental_id,)).fetchone():
            raise HTTPException(404, "Location introuvable")
        fields, values = [], []
        d = data.model_dump(exclude_none=True)
        for field, val in d.items():
            if field in ("deposit_collected", "deposit_returned"):
                fields.append(f"{field} = ?"); values.append(1 if val else 0)
            else:
                fields.append(f"{field} = ?"); values.append(val)
        if fields:
            values.append(rental_id)
            conn.execute(f"UPDATE rentals SET {', '.join(fields)} WHERE id = ?", values)
        return rental_full(conn, conn.execute("SELECT * FROM rentals WHERE id = ?", (rental_id,)).fetchone())

@router.delete("/{rental_id}", status_code=204)
def delete_rental(rental_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM rentals WHERE id = ?", (rental_id,))
