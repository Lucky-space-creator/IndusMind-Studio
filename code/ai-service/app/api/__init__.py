from app.api.chat import router as chat_router
from app.api.diagnosis import router as diagnosis_router
from app.api.graph import router as graph_router
from app.api.rag import router as rag_router

__all__ = ["chat_router", "diagnosis_router", "graph_router", "rag_router"]