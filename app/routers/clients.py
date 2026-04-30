import os, uuid, shutil
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from ..database import get_db

router = APIRouter(prefix="/api/clients", tags=["clients"])
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/uploads")

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

def client_full(conn, row):
    c = dict(row)
    docs = conn.execute("SELECT * FROM client_documents WHERE client_id = ? ORDER BY id", (c["id"],)).fetchall()
    c["documents"] = [dict(d) for d in docs]
    rentals = conn.execute("""
        SELECT r.*, t.name as tool_name FROM rentals r
        JOIN tools t ON t.id = r.tool_id
        WHERE r.client_id = ? ORDER BY r.start_date DESC
    """, (c["id"],)).fetchall()
    c["rentals"] = [dict(r) for r in rentals]
    return c

@router.get("")
def list_clients():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM clients ORDER BY name").fetchall()
        result = []
        for r in rows:
            c = dict(r)
            c["rental_count"] = conn.execute("SELECT COUNT(*) FROM rentals WHERE client_id = ?", (r["id"],)).fetchone()[0]
            result.append(c)
        return result

@router.get("/{client_id}")
def get_client(client_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Client introuvable")
        return client_full(conn, row)

@router.post("", status_code=201)
def create_client(
    name: str = Form(...),
    phone: str = Form(""),
    email: str = Form(""),
    address: str = Form(""),
    notes: str = Form("")
):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO clients (name, phone, email, address, notes) VALUES (?,?,?,?,?)",
            (name.strip(), phone.strip(), email.strip(), address.strip(), notes.strip())
        )
        row = conn.execute("SELECT * FROM clients WHERE id = ?", (cur.lastrowid,)).fetchone()
        return client_full(conn, row)

@router.put("/{client_id}")
def update_client(client_id: int, data: ClientUpdate):
    with get_db() as conn:
        if not conn.execute("SELECT id FROM clients WHERE id = ?", (client_id,)).fetchone():
            raise HTTPException(404, "Client introuvable")
        fields, values = [], []
        for field, val in data.model_dump(exclude_none=True).items():
            fields.append(f"{field} = ?")
            values.append(val.strip() if isinstance(val, str) else val)
        if fields:
            values.append(client_id)
            conn.execute(f"UPDATE clients SET {', '.join(fields)} WHERE id = ?", values)
        return client_full(conn, conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone())

@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int):
    with get_db() as conn:
        docs = conn.execute("SELECT filename FROM client_documents WHERE client_id = ?", (client_id,)).fetchall()
        for doc in docs:
            path = os.path.join(UPLOAD_DIR, "clients", doc["filename"])
            if os.path.exists(path):
                os.remove(path)
        conn.execute("DELETE FROM clients WHERE id = ?", (client_id,))

@router.post("/{client_id}/documents", status_code=201)
async def add_document(client_id: int, file: UploadFile = File(...), label: str = Form("Document")):
    with get_db() as conn:
        if not conn.execute("SELECT id FROM clients WHERE id = ?", (client_id,)).fetchone():
            raise HTTPException(404, "Client introuvable")
        ext = os.path.splitext(file.filename)[1].lower()
        fname = f"{uuid.uuid4().hex}{ext}"
        path = os.path.join(UPLOAD_DIR, "clients", fname)
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        cur = conn.execute("INSERT INTO client_documents (client_id, filename, label) VALUES (?,?,?)", (client_id, fname, label.strip()))
        return dict(conn.execute("SELECT * FROM client_documents WHERE id = ?", (cur.lastrowid,)).fetchone())

@router.delete("/{client_id}/documents/{doc_id}", status_code=204)
def delete_document(client_id: int, doc_id: int):
    with get_db() as conn:
        doc = conn.execute("SELECT * FROM client_documents WHERE id = ? AND client_id = ?", (doc_id, client_id)).fetchone()
        if not doc:
            raise HTTPException(404, "Document introuvable")
        path = os.path.join(UPLOAD_DIR, "clients", doc["filename"])
        if os.path.exists(path):
            os.remove(path)
        conn.execute("DELETE FROM client_documents WHERE id = ?", (doc_id,))
