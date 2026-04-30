import os, uuid, shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from ..database import get_db

router = APIRouter(prefix="/api/tools", tags=["tools"])
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/uploads")

class ToolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    daily_price: Optional[float] = None
    weekend_price: Optional[float] = None
    deposit: Optional[float] = None
    notes: Optional[str] = None

def tool_with_images(conn, row):
    t = dict(row)
    imgs = conn.execute("SELECT * FROM tool_images WHERE tool_id = ? ORDER BY is_main DESC, id", (t["id"],)).fetchall()
    t["images"] = [dict(i) for i in imgs]
    t["main_image"] = next((i["filename"] for i in t["images"] if i["is_main"]), (t["images"][0]["filename"] if t["images"] else None))
    return t

@router.get("")
def list_tools():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM tools ORDER BY name").fetchall()
        return [tool_with_images(conn, r) for r in rows]

@router.get("/{tool_id}")
def get_tool(tool_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM tools WHERE id = ?", (tool_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Outil introuvable")
        return tool_with_images(conn, row)

@router.post("", status_code=201)
async def create_tool(
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form(""),
    daily_price: float = Form(0),
    weekend_price: float = Form(0),
    deposit: float = Form(0),
    notes: str = Form(""),
    images: list[UploadFile] = File(default=[])
):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO tools (name, description, category, daily_price, weekend_price, deposit, notes) VALUES (?,?,?,?,?,?,?)",
            (name.strip(), description.strip(), category.strip(), daily_price, weekend_price, deposit, notes.strip())
        )
        tool_id = cur.lastrowid
        for i, img in enumerate(images):
            if img.filename:
                ext = os.path.splitext(img.filename)[1].lower()
                fname = f"{uuid.uuid4().hex}{ext}"
                path = os.path.join(UPLOAD_DIR, "tools", fname)
                with open(path, "wb") as f:
                    shutil.copyfileobj(img.file, f)
                conn.execute("INSERT INTO tool_images (tool_id, filename, is_main) VALUES (?,?,?)", (tool_id, fname, 1 if i == 0 else 0))
        row = conn.execute("SELECT * FROM tools WHERE id = ?", (tool_id,)).fetchone()
        return tool_with_images(conn, row)

@router.put("/{tool_id}")
def update_tool(tool_id: int, data: ToolUpdate):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM tools WHERE id = ?", (tool_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Outil introuvable")
        fields, values = [], []
        for field, val in data.model_dump(exclude_none=True).items():
            fields.append(f"{field} = ?")
            values.append(val.strip() if isinstance(val, str) else val)
        if fields:
            values.append(tool_id)
            conn.execute(f"UPDATE tools SET {', '.join(fields)} WHERE id = ?", values)
        return tool_with_images(conn, conn.execute("SELECT * FROM tools WHERE id = ?", (tool_id,)).fetchone())

@router.delete("/{tool_id}", status_code=204)
def delete_tool(tool_id: int):
    with get_db() as conn:
        imgs = conn.execute("SELECT filename FROM tool_images WHERE tool_id = ?", (tool_id,)).fetchall()
        for img in imgs:
            path = os.path.join(UPLOAD_DIR, "tools", img["filename"])
            if os.path.exists(path):
                os.remove(path)
        conn.execute("DELETE FROM tools WHERE id = ?", (tool_id,))

@router.post("/{tool_id}/images", status_code=201)
async def add_image(tool_id: int, image: UploadFile = File(...), is_main: bool = Form(False)):
    with get_db() as conn:
        if not conn.execute("SELECT id FROM tools WHERE id = ?", (tool_id,)).fetchone():
            raise HTTPException(404, "Outil introuvable")
        ext = os.path.splitext(image.filename)[1].lower()
        fname = f"{uuid.uuid4().hex}{ext}"
        path = os.path.join(UPLOAD_DIR, "tools", fname)
        with open(path, "wb") as f:
            shutil.copyfileobj(image.file, f)
        if is_main:
            conn.execute("UPDATE tool_images SET is_main = 0 WHERE tool_id = ?", (tool_id,))
        conn.execute("INSERT INTO tool_images (tool_id, filename, is_main) VALUES (?,?,?)", (tool_id, fname, 1 if is_main else 0))
        return {"filename": fname}

@router.delete("/{tool_id}/images/{image_id}", status_code=204)
def delete_image(tool_id: int, image_id: int):
    with get_db() as conn:
        img = conn.execute("SELECT * FROM tool_images WHERE id = ? AND tool_id = ?", (image_id, tool_id)).fetchone()
        if not img:
            raise HTTPException(404, "Image introuvable")
        path = os.path.join(UPLOAD_DIR, "tools", img["filename"])
        if os.path.exists(path):
            os.remove(path)
        conn.execute("DELETE FROM tool_images WHERE id = ?", (image_id,))
        if img["is_main"]:
            first = conn.execute("SELECT id FROM tool_images WHERE tool_id = ? LIMIT 1", (tool_id,)).fetchone()
            if first:
                conn.execute("UPDATE tool_images SET is_main = 1 WHERE id = ?", (first["id"],))

@router.post("/{tool_id}/images/{image_id}/main", status_code=204)
def set_main_image(tool_id: int, image_id: int):
    with get_db() as conn:
        conn.execute("UPDATE tool_images SET is_main = 0 WHERE tool_id = ?", (tool_id,))
        conn.execute("UPDATE tool_images SET is_main = 1 WHERE id = ? AND tool_id = ?", (image_id, tool_id))
