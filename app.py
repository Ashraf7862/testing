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
        conn.execute('''
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
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        ''')
        count = conn.execute('SELECT COUNT(*) FROM tasks').fetchone()[0]
        if count == 0:
            now = datetime.now(timezone.utc).isoformat()
            samples = [
                ('Complete project documentation', 1),
                ('Design dashboard interface', 0),
                ('Review team feedback', 0),
                ('Prepare weekly report', 0),
            ]
            for title, completed in samples:
                conn.execute(
                    'INSERT INTO tasks (id,title,completed,created_at) VALUES (?,?,?,?)',
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
    return {"id": feedback_id, "message": "Feedback submitted successfully"}

@app.get("/api/feedback")
def list_feedback(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    with db() as conn:
        total = conn.execute('SELECT COUNT(*) FROM feedback').fetchone()[0]
        rows = conn.execute(
            'SELECT * FROM feedback ORDER BY created_at DESC LIMIT ? OFFSET ?',
            (limit, offset)
        ).fetchall()
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset
    }

@app.get("/api/feedback/{feedback_id}")
def get_feedback(feedback_id: str):
    with db() as conn:
        row = conn.execute('SELECT * FROM feedback WHERE id = ?', (feedback_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return dict(row)

@app.get("/api/feedback/stats")
def feedback_stats():
    with db() as conn:
        total = conn.execute('SELECT COUNT(*) FROM feedback').fetchone()[0]
        avg = conn.execute('SELECT AVG(rating) FROM feedback').fetchone()[0] or 0
        categories = conn.execute(
            'SELECT category, COUNT(*) as count FROM feedback GROUP BY category'
        ).fetchall()
    return {
        "total": total,
        "average_rating": round(avg, 1),
        "categories": {row['category']: row['count'] for row in categories}
    }

@app.get("/api/tasks")
def list_tasks():
    with db() as conn:
        rows = conn.execute('SELECT * FROM tasks ORDER BY created_at DESC').fetchall()
        tasks = [dict(r) for r in rows]
        total = len(tasks)
        completed = sum(1 for t in tasks if t['completed'])
        pending = total - completed
    return {
        "items": tasks,
        "total": total,
        "completed": completed,
        "pending": pending
    }

@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskIn):
    task_id = "TASK-" + uuid.uuid4().hex[:8].upper()
    created_at = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        conn.execute(
            'INSERT INTO tasks (id,title,completed,created_at) VALUES (?,?,?,?)',
            (task_id, payload.title, 0, created_at)
        )
    return {"id": task_id, "title": payload.title, "completed": False, "created_at": created_at}

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: str, payload: TaskUpdate):
    with db() as conn:
        row = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        conn.execute(
            'UPDATE tasks SET completed = ? WHERE id = ?',
            (1 if payload.completed else 0, task_id)
        )
    return {"id": task_id, "completed": payload.completed}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    with db() as conn:
        row = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        conn.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
    return {"message": "Task deleted"}

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.get("/")
def serve_frontend():
    return FileResponse(BASE_DIR / "static" / "index.html")
