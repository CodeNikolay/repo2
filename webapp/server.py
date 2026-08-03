import uuid
import numpy as np
import json
import struct

from fastapi import Response
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

def pack_response(meta: dict, grid: np.ndarray) -> bytes:
    meta_bytes = json.dumps(meta).encode("utf-8")
    header = struct.pack("<I", len(meta_bytes))  # 4-byte little-endian length prefix
    return header + meta_bytes + grid.tobytes()

@app.post("/api/session")
def create_session(req: CreateSessionRequest):
    sid = str(uuid.uuid4())
    sessions[sid] = ForestGrid(req.size, req.p, req.f, req.seed)
    fg = sessions[sid]
    meta = {
        "session_id": sid,
        "size": fg.size,
        "density": float((fg.grid == 1).mean()),
        "fire_sizes": fg.fire_sizes
    }
    body = pack_response(meta, fg.grid.astype(np.uint8))
    return Response(content=body, media_type="application/octet-stream")

@app.post("/api/session/{sid}/step")
def step(sid: str):
    fg = sessions.get(sid)
    if fg is None:
        raise HTTPException(404, "session not found")
    fg.step()
    struck_coords = np.argwhere(fg.last_struck).tolist()
    meta = {
        "last_struck": struck_coords,
        "density": float((fg.grid == 1).mean()),
        "fire_sizes": fg.fire_sizes
    }
    body = pack_response(meta, fg.grid.astype(np.uint8))
    return Response(content=body, media_type="application/octet-stream")

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