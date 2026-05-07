from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.module import Module
from services.auth_service import require_user
from services.graph_service import get_module_graph
from models.user import User

router = APIRouter(tags=["knowledge-graph"])


# ---------- Pydantic schemas ----------

class GraphNode(BaseModel):
    id: str
    name: str
    importance: float = 0.5
    mastery: float = 0.0
    group: str = "concept"
    parent_id: Optional[str] = None
    order_index: int = 0
    item_count: int = 0
    progress_pct: float = 0.0
    progress_status: str = "not_started"
    score_pct: float | None = None


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str = "related"


class KnowledgeGraphResponse(BaseModel):
    module_name: str = ""
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    graph_backend: str = "sql"
    document_count: int = 0


# ---------- Endpoints ----------

@router.get("/api/modules/{module_id}/knowledge-graph", response_model=KnowledgeGraphResponse)
def get_knowledge_graph(module_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    """Return nodes + edges JSON for D3 visualization."""
    module = db.query(Module).filter(Module.id == module_id, Module.user_id == user.id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    graph = get_module_graph(db, module_id, user.id)
    return KnowledgeGraphResponse(
        module_name=graph.get("module_name") or module.name,
        nodes=[GraphNode(**node) for node in graph.get("nodes", [])],
        edges=[GraphEdge(**edge) for edge in graph.get("edges", [])],
        graph_backend=graph.get("graph_backend", "sql"),
        document_count=int(graph.get("document_count", 0) or 0),
    )
