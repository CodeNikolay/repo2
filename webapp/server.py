import uuid

import math
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from core.forest_grid import ForestGrid

app = FastAPI()
sessions: dict[str, ForestGrid] = {}

class CreateSessionRequest(BaseModel):
    size: int = 80
    p: float = 0.01
    f: float = 0.001
    seed: int | None = None

class UpdateRequest(BaseModel):
    p: float
    f: float

@app.post("/api/session")
def create_session(req: CreateSessionRequest):
    sid = str(uuid.uuid4())
    sessions[sid] = ForestGrid(req.size, req.p, req.f, req.seed)
    fg = sessions[sid]
    return {
        "session_id": sid,
        "grid": fg.grid.flatten().tolist(), # change to more efficient solution (bytes)
        "size": fg.size,
        "density": float((fg.grid == 1).mean())
    }

@app.post("/api/session/{sid}/step")
def step(sid: str):
    fg = sessions.get(sid)
    if fg is None:
        raise HTTPException(404, "session not found")
    fg.step()
    return {
        "grid": fg.grid.flatten().tolist(), # change to more efficient solution (bytes)
        "density": float((fg.grid == 1).mean())
    }

@app.post("/api/session/{sid}/update")
def update_parameters(sid: str, req: UpdateRequest):
    fg = sessions.get(sid)
    if fg is None:
        raise HTTPException(404, "session not found")
    fg.set_parameters(req.p, req.f)
    sessions[sid] = fg
    return {"ok": True}

# optional
@app.delete("/api/session/{sid}")
def delete_session(sid: str):
    sessions.pop(sid, None)
    return {"ok": True}

app.mount("/", StaticFiles(directory="webapp/static", html=True), name="static")