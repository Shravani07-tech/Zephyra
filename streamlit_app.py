"""
Zephyra — Streamlit Frontend
-------------------------------
This file is the "frontend" — UI, session management, and styling only.
All thinking happens in brain.py, all storage in memory.py. This file
calls them but contains zero LLM/prompt logic itself, keeping the
backend/frontend separation real even within one deployed app.

Each browser session gets its own private, isolated session_id — fixing
the earlier bug where every visitor shared one memory file and could see
each other's conversations.
"""

import uuid
import streamlit as st
from brain import think, format_error
from memory import load_memory, save_turn, clear_memory

st.set_page_config(page_title="Zephyra", page_icon="🤖", layout="centered")

# ---------------------------------------------------------------------------
# Custom styling — flat, minimal, no gradients/shadows. Overrides Streamlit's
# default chrome to feel like a designed product, not a default template.
# ---------------------------------------------------------------------------
st.markdown("""
<style>
    #MainMenu, footer, header {visibility: hidden;}

    .stApp {
        background: #0f1115;
    }

    .block-container {
        padding-top: 2rem;
        max-width: 720px;
    }

    .zephyra-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 4px;
    }
    .zephyra-title {
        font-size: 28px;
        font-weight: 600;
        color: #f5f5f5;
        margin: 0;
    }
    .zephyra-subtitle {
        color: #8b8d93;
        font-size: 14px;
        margin: 0 0 24px 0;
    }

    [data-testid="stChatMessage"] {
        background: transparent;
        border: none;
        padding: 10px 0;
    }

    div[data-testid="stChatMessageContent"] {
        background: #1a1d24;
        border-radius: 12px;
        padding: 12px 16px;
        border: 1px solid #262932;
    }

    .stChatInput textarea {
        background: #1a1d24 !important;
        border: 1px solid #262932 !important;
        border-radius: 10px !important;
        color: #f5f5f5 !important;
    }

    .stButton button {
        background: #1a1d24;
        border: 1px solid #262932;
        border-radius: 8px;
        color: #d0d2d6;
        font-size: 13px;
        padding: 6px 14px;
    }
    .stButton button:hover {
        border-color: #3a3e4a;
        background: #21242c;
        color: #f5f5f5;
    }
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Session management — one isolated session_id per browser session.
# This is the actual fix for the multi-user privacy bug.
# ---------------------------------------------------------------------------
if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())
    st.session_state.history = load_memory(st.session_state.session_id)

# ---------------------------------------------------------------------------
# Header + New chat control
# ---------------------------------------------------------------------------
header_col, button_col = st.columns([5, 1])
with header_col:
    st.markdown(
        '<p class="zephyra-title">Zephyra</p>'
        '<p class="zephyra-subtitle">Local-first AI assistant — built by Shravani</p>',
        unsafe_allow_html=True,
    )
with button_col:
    if st.button("New chat", use_container_width=True):
        clear_memory(st.session_state.session_id)
        st.session_state.session_id = str(uuid.uuid4())
        st.session_state.history = []
        st.rerun()

# ---------------------------------------------------------------------------
# Conversation
# ---------------------------------------------------------------------------
for turn in st.session_state.history:
    role = "user" if turn["role"] == "user" else "assistant"
    with st.chat_message(role):
        st.markdown(turn["content"])

user_input = st.chat_input("Message Zephyra...")

if user_input:
    with st.chat_message("user"):
        st.markdown(user_input)

    try:
        reply = think(user_input, st.session_state.history)
    except Exception as e:
        with st.chat_message("assistant"):
            st.error(format_error(e))
    else:
        with st.chat_message("assistant"):
            st.markdown(reply)
        save_turn(st.session_state.session_id, user_input, reply)
        st.session_state.history.append({"role": "user", "content": user_input})
        st.session_state.history.append({"role": "zephyra", "content": reply})