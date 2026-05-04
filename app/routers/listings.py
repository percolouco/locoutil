from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..database import get_db

router = APIRouter(prefix="/api/listings", tags=["listings"])

class ListingUpsert(BaseModel):
    tool_id: int
    platform_id: int
    is_active: bool = True
    title: str = ""
    description: str = ""
    price: Optional[float] = None
    url: str = ""
    notes: str = ""

class ListingUpdate(BaseModel):
    is_active: Optional[bool] = None
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    url: Optional[str] = None
    notes: Optional[str] = None

def listing_full(conn, row):
    l = dict(row)
    tool = conn.execute("SELECT id, name, daily_price, weekend_price FROM tools WHERE id = ?", (l["tool_id"],)).fetchone()
    platform = conn.execute("SELECT id, name FROM platforms WHERE id = ?", (l["platform_id"],)).fetchone()
    l["tool"] = dict(tool) if tool else None
    l["platform"] = dict(platform) if platform else None
    return l

@router.get("")
def list_listings(tool_id: Optional[int] = None, platform_id: Optional[int] = None):
    with get_db() as conn:
        q = "SELECT * FROM listings WHERE 1=1"
        params = []
        if tool_id:
            q += " AND tool_id = ?"; params.append(tool_id)
        if platform_id:
            q += " AND platform_id = ?"; params.append(platform_id)
        q += " ORDER BY tool_id, platform_id"
        rows = conn.execute(q, params).fetchall()
        return [listing_full(conn, r) for r in rows]

@router.get("/matrix")
def listings_matrix():
    with get_db() as conn:
        tools = conn.execute("SELECT id, name, daily_price, weekend_price FROM tools ORDER BY name").fetchall()
        platforms = conn.execute("SELECT id, name FROM platforms ORDER BY name").fetchall()
        listings = conn.execute("SELECT * FROM listings").fetchall()
        listing_map = {(l["tool_id"], l["platform_id"]): dict(l) for l in listings}
        return {
            "tools": [dict(t) for t in tools],
            "platforms": [dict(p) for p in platforms],
            "listings": {f"{k[0]},{k[1]}": v for k, v in listing_map.items()}
        }

@router.post("", status_code=201)
def create_or_update_listing(data: ListingUpsert):
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM listings WHERE tool_id = ? AND platform_id = ?",
            (data.tool_id, data.platform_id)
        ).fetchone()
        if existing:
            conn.execute("""
                UPDATE listings SET is_active=?, title=?, description=?, price=?, url=?, notes=?,
                updated_at=datetime('now','localtime') WHERE id=?
            """, (1 if data.is_active else 0, data.title, data.description, data.price,
                  data.url, data.notes, existing["id"]))
            row = conn.execute("SELECT * FROM listings WHERE id = ?", (existing["id"],)).fetchone()
        else:
            cur = conn.execute("""
                INSERT INTO listings (tool_id, platform_id, is_active, title, description, price, url, notes)
                VALUES (?,?,?,?,?,?,?,?)
            """, (data.tool_id, data.platform_id, 1 if data.is_active else 0,
                  data.title, data.description, data.price, data.url, data.notes))
            row = conn.execute("SELECT * FROM listings WHERE id = ?", (cur.lastrowid,)).fetchone()
        return listing_full(conn, row)

@router.put("/{listing_id}")
def update_listing(listing_id: int, data: ListingUpdate):
    with get_db() as conn:
        if not conn.execute("SELECT id FROM listings WHERE id = ?", (listing_id,)).fetchone():
            raise HTTPException(404, "Annonce introuvable")
        fields, values = ["updated_at = datetime('now','localtime')"], []
        for field, val in data.model_dump(exclude_none=True).items():
            if field == "is_active":
                fields.append("is_active = ?"); values.append(1 if val else 0)
            else:
                fields.append(f"{field} = ?"); values.append(val)
        values.append(listing_id)
        conn.execute(f"UPDATE listings SET {', '.join(fields)} WHERE id = ?", values)
        return listing_full(conn, conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone())

@router.delete("/{listing_id}", status_code=204)
def delete_listing(listing_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM listings WHERE id = ?", (listing_id,))

@router.post("/{listing_id}/toggle", status_code=200)
def toggle_listing(listing_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Annonce introuvable")
        new_status = 0 if row["is_active"] else 1
        conn.execute("UPDATE listings SET is_active = ?, updated_at = datetime('now','localtime') WHERE id = ?",
                     (new_status, listing_id))
        return listing_full(conn, conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone())
