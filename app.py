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
        conn.commit()  # Commit the changes

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
        conn.commit()
        return {"id": feedback_id, "created_at": created_at}

@app.get("/api/tasks")
def list_tasks():
    with db() as conn:
        tasks = conn.execute('SELECT * FROM tasks ORDER BY created_at DESC').fetchall()
        total = conn.execute('SELECT COUNT(*) FROM tasks').fetchone()[0]
        completed = conn.execute('SELECT COUNT(*) FROM tasks WHERE completed = 1').fetchone()[0]
        pending = total - completed
        return {
            "items": [dict(t) for t in tasks],
            "total": total,
            "completed": completed,
            "pending": pending
        }

@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskIn):
    task_id = "TK-" + uuid.uuid4().hex[:8].upper()
    created_at = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        conn.execute(
            'INSERT INTO tasks (id,title,completed,created_at) VALUES (?,?,?,?)',
            (task_id, payload.title, 0, created_at)
        )
        conn.commit()
        return {"id": task_id, "title": payload.title, "completed": False, "created_at": created_at}

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: str, payload: TaskUpdate):
    with db() as conn:
        task = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        conn.execute(
            'UPDATE tasks SET completed = ? WHERE id = ?',
            (1 if payload.completed else 0, task_id)
        )
        conn.commit()
        return {"id": task_id, "completed": payload.completed}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    with db() as conn:
        task = conn.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        conn.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
        conn.commit()
        return {"deleted": task_id}

@app.get("/api/feedback")
def list_feedback(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    with db() as conn:
        items = conn.execute(
            'SELECT * FROM feedback ORDER BY created_at DESC LIMIT ? OFFSET ?',
            (limit, offset)
        ).fetchall()
        total = conn.execute('SELECT COUNT(*) FROM feedback').fetchone()[0]
        return {"items": [dict(i) for i in items], "total": total}

@app.get("/api/feedback/{feedback_id}")
def get_feedback(feedback_id: str):
    with db() as conn:
        fb = conn.execute('SELECT * FROM feedback WHERE id = ?', (feedback_id,)).fetchone()
        if not fb:
            raise HTTPException(status_code=404, detail="Feedback not found")
        return dict(fb)

@app.get("/api/feedback/stats")
def feedback_stats():
    with db() as conn:
        total = conn.execute('SELECT COUNT(*) FROM feedback').fetchone()[0]
        avg = conn.execute('SELECT AVG(rating) FROM feedback').fetchone()[0] or 0
        categories = conn.execute('SELECT category, COUNT(*) as count FROM feedback GROUP BY category').fetchall()
        return {
            "total": total,
            "average_rating": round(avg, 2),
            "categories": {c['category']: c['count'] for c in categories}
        }

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

@app.get("/")
def read_root():
    return FileResponse(BASE_DIR / "static" / "index.html")
