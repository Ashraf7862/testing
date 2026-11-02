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
        conn.commit()
    return {
        "id": feedback_id,
        "name": payload.name,
        "email": payload.email,
        "category": payload.category,
        "title": payload.title,
        "description": payload.description,
        "rating": payload.rating,
        "created_at": created_at
    }

# The rest of the file (task routes) is assumed to exist unchanged.