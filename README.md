# QuickTask — Feedback Demo Product

A separate task-management demo app with a persistent feedback collection API. It is designed to be connected to Product Manager AI for feedback analysis and product-improvement workflows.

## Requirements
- Python 3.10+
- pip

## Run locally (Mac)

```bash
cd quicktask-feedback-demo
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Open http://127.0.0.1:8000

API documentation: http://127.0.0.1:8000/docs

## Feedback API

- `POST /api/feedback` — submit feedback
- `GET /api/feedback` — list feedback (supports `limit` and `offset`)
- `GET /api/feedback/{id}` — retrieve one feedback item
- `GET /api/feedback/stats` — total, average rating and category counts
- `GET /api/health` — health check

Example POST body:

```json
{
  "name": "Alex",
  "email": "alex@example.com",
  "category": "Feature Request",
  "title": "Add dark mode",
  "description": "Please add a dark theme so the app is easier to use at night.",
  "rating": 4
}
```

The SQLite database (`quicktask.db`) is created automatically in this folder. Tasks and submitted feedback persist across refreshes and restarts.

## Task API
- `GET /api/tasks`
- `POST /api/tasks` with `{"title":"Prepare demo"}`
- `PATCH /api/tasks/{id}` with `{"completed":true}`
- `DELETE /api/tasks/{id}`

## Notes
The app includes a few starter tasks. It does not include fabricated feedback submissions; feedback history starts empty and contains actual submissions.
