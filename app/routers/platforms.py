from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..database import get_db

router = APIRouter(prefix="/api/platforms", tags=["platforms"])

class PlatformCreate(BaseModel):
    name: str

@router.get("")
def list_platforms():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM platforms ORDER BY name").fetchall()
        return [dict(r) for r in rows]

@router.post("", status_code=201)
def create_platform(data: PlatformCreate):
    with get_db() as conn:
        try:
            cur = conn.execute("INSERT INTO platforms (name) VALUES (?)", (data.name.strip(),))
            return dict(conn.execute("SELECT * FROM platforms WHERE id = ?", (cur.lastrowid,)).fetchone())
        except Exception:
            raise HTTPException(409, "Plateforme déjà existante")

@router.put("/{platform_id}")
def update_platform(platform_id: int, data: PlatformCreate):
    with get_db() as conn:
        if not conn.execute("SELECT id FROM platforms WHERE id = ?", (platform_id,)).fetchone():
            raise HTTPException(404, "Plateforme introuvable")
        conn.execute("UPDATE platforms SET name = ? WHERE id = ?", (data.name.strip(), platform_id))
        return dict(conn.execute("SELECT * FROM platforms WHERE id = ?", (platform_id,)).fetchone())

@router.delete("/{platform_id}", status_code=204)
def delete_platform(platform_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM platforms WHERE id = ?", (platform_id,))
