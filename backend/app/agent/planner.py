"""Zephyra Lite LangGraph planner orchestration."""

from langgraph.graph import StateGraph, START, END
from sqlalchemy.orm import Session

from app.agent.state import PlannerState
from app.agent.nodes.router import route_intent
from app.agent.nodes.task import handle_task


def build_planner(db: Session):
    """Build and compile the planner graph, capturing the DB session."""
    
    workflow = StateGraph(PlannerState)
    
    # Define nodes
    workflow.add_node("router", route_intent)
    
    async def task_node(state: PlannerState) -> dict:
        return await handle_task(state, db)
        
    async def file_node(state: PlannerState) -> dict:
        from app.agent.nodes.file import handle_file
        return await handle_file(state, db)
        
    async def memory_node(state: PlannerState) -> dict:
        from app.agent.nodes.memory import handle_memory
        return await handle_memory(state)
        
    workflow.add_node("task", task_node)
    workflow.add_node("file", file_node)
    workflow.add_node("memory", memory_node)
    
    # Edges
    workflow.add_edge(START, "router")
    
    def route_after_intent(state: PlannerState) -> str:
        intent = state.get("intent", "CHAT")
        if intent == "TASK":
            return "task"
        elif intent == "FILE":
            return "file"
        elif intent == "MEMORY":
            return "memory"
        return END

    workflow.add_conditional_edges(
        "router",
        route_after_intent,
        {
            "task": "task",
            "file": "file",
            "memory": "memory",
            END: END
        }
    )
    
    workflow.add_edge("task", END)
    workflow.add_edge("file", END)
    workflow.add_edge("memory", END)
    
    return workflow.compile()
