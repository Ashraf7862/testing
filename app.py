from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import sqlite3
import uuid
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "quicktask.db"

app = FastAPI(title="QuickTask Feedback API", version="1.0.0")

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                name TEXT,
                email TEXT,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                rating INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
        if count == 0:
            now = datetime.now(timezone.utc).isoformat()
            samples = [
                ("Complete project documentation", 1),
                ("Design dashboard interface", 0),
                ("Review team feedback", 0),
                ("Prepare weekly report", 0),
            ]
            for title, completed in samples:
                conn.execute(
                    "INSERT INTO tasks (id,title,completed,created_at) VALUES (?,?,?,?)",
                    (str(uuid.uuid4()), title, completed, now)
                )

init_db()

class FeedbackIn(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    email: Optional[str] = Field(default=None, max_length=120)
    category: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=3000)
    rating: int = Field(ge=1, le=5)

class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)

class TaskUpdate(BaseModel):
    completed: bool

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "QuickTask Feedback API"}

@app.post("/api/feedback", status_code=201)
def create_feedback(payload: FeedbackIn):
    feedback_id = "FB-" + uuid.uuid4().hex[:8].upper()
    created_at = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        conn.execute(
            """INSERT INTO feedback
            (id,name,email,category,title,description,rating,created_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            (feedback_id, payload.name, payload.email, payload.category,
             payload.title, payload.description, payload.rating, created_at)
        )
    return {"id": feedback_id, **payload.model_dump(), "created_at": created_at}

@app.get("/api/feedback")
def list_feedback(limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM feedback ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset)
        ).fetchall()
    return {"items": [dict(row) for row in rows], "limit": limit, "offset": offset}

@app.get("/api/feedback/stats")
def feedback_stats():
    with db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM feedback").fetchone()[0]
        avg = conn.execute("SELECT AVG(rating) FROM feedback").fetchone()[0]
        categories = conn.execute(
            "SELECT category, COUNT(*) AS count FROM feedback GROUP BY category"
        ).fetchall()
    return {
        "total": total,
        "average_rating": round(avg, 2) if avg is not None else None,
        "by_category": [dict(row) for row in categories]
    }

@app.get("/api/feedback/{feedback_id}")
def get_feedback(feedback_id: str):
    with db() as conn:
        row = conn.execute("SELECT * FROM feedback WHERE id=?", (feedback_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return dict(row)

@app.get("/api/tasks")
def list_tasks():
    with db() as conn:
        rows = conn.execute("SELECT * FROM tasks ORDER BY created_at DESC").fetchall()
    items = [dict(row) for row in rows]
    return {
        "items": items,
        "total": len(items),
        "completed": sum(item["completed"] for item in items),
        "pending": sum(1 - item["completed"] for item in items)
    }

@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskIn):
    task_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        conn.execute(
            "INSERT INTO tasks (id,title,completed,created_at) VALUES (?,?,0,?)",
            (task_id, payload.title.strip(), created_at)
        )
    return {"id": task_id, "title": payload.title.strip(), "completed": 0, "created_at": created_at}

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: str, payload: TaskUpdate):
    with db() as conn:
        cur = conn.execute("UPDATE tasks SET completed=? WHERE id=?", (int(payload.completed), task_id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        row = conn.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    return dict(row)

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    with db() as conn:
        cur = conn.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"deleted": True, "id": task_id}

@app.get("/")
def home():
    return FileResponse(BASE_DIR / "static" / "index.html")

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
