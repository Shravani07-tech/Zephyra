import uuid
import streamlit as st
from brain import think, format_error
from memory import load_memory, save_turn, clear_memory

st.set_page_config(page_title="Zephyra", page_icon="⚡", layout="centered")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

html, body, [class*="css"] {
    font-family: 'Inter', sans-serif;
}

#MainMenu, footer, header { visibility: hidden; }

.stApp {
    background: #05080f;
}

.block-container {
    padding-top: 0 !important;
    padding-bottom: 130px;
    max-width: 740px;
}

/* NAV */
.z-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 0 16px;
    border-bottom: 1px solid #080f1e;
    margin-bottom: 0;
    background: #030508;
}

.z-wordmark {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
}

.z-dot {
    width: 6px;
    height: 6px;
    background: #2563eb;
    border-radius: 50%;
    display: inline-block;
}

.z-version {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #1e3a5f;
    letter-spacing: 0.05em;
    padding: 2px 8px;
    border: 1px solid #0e1a2e;
    border-radius: 3px;
}

/* EMPTY STATE */
.z-empty {
    padding: 96px 0 56px;
}

.z-greeting {
    font-size: 32px;
    font-weight: 600;
    color: #f0f4ff;
    letter-spacing: -0.03em;
    margin: 0 0 10px;
    line-height: 1.2;
}

.z-greeting span {
    color: #2563eb;
}

.z-byline {
    font-size: 13px;
    color: #1e3a5f;
    margin: 0 0 40px;
    font-weight: 400;
}

.z-suggestions {
    display: flex;
    flex-direction: column;
    gap: 1px;
    border: 1px solid #0e1525;
    border-radius: 8px;
    overflow: hidden;
    max-width: 480px;
}

.z-suggestion {
    padding: 12px 16px;
    font-size: 13px;
    color: #3d5a80;
    background: #080d1a;
    border: none;
    cursor: pointer;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 10px;
}

.z-suggestion:hover {
    background: #0a1020;
    color: #6b8cba;
}

.z-suggestion-arrow {
    margin-left: auto;
    color: #0e1a2e;
    font-size: 11px;
}

/* MESSAGES */
[data-testid="stChatMessage"] {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
}

div[data-testid="stChatMessageContent"] {
    background: transparent !important;
    border: none !important;
    padding: 14px 0 !important;
    border-bottom: 1px solid #0a1020 !important;
    border-radius: 0 !important;
}

div[data-testid="stChatMessageContent"] p {
    color: #8ba3cc !important;
    font-size: 14px !important;
    line-height: 1.75 !important;
    margin: 0 !important;
}

[data-testid="stChatMessage"][data-testid*="user"] div[data-testid="stChatMessageContent"] p,
div[data-testid="stChatMessageContent"]:has(+ *) p {
    color: #c8d8f0 !important;
}

/* differentiate user messages */
[data-testid="stChatMessage"]:nth-child(odd) div[data-testid="stChatMessageContent"] p {
    color: #d0dff5 !important;
}

/* INPUT */
[data-testid="stChatInput"] {
    background: #05080f !important;
    border-top: 1px solid #0e1525 !important;
    padding: 20px 0 !important;
}

.stChatInput textarea {
    background: #080d1a !important;
    border: 1px solid #0e1a2e !important;
    border-radius: 6px !important;
    color: #c8d8f0 !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 14px !important;
    caret-color: #2563eb !important;
    padding: 14px 16px !important;
}

.stChatInput textarea:focus {
    border-color: #1a3560 !important;
    box-shadow: 0 0 0 2px rgba(37,99,235,0.06) !important;
    outline: none !important;
}

.stChatInput textarea::placeholder {
    color: #111d33 !important;
}

/* NEW CHAT BUTTON */
.stButton button {
    background: transparent !important;
    border: 1px solid #0e1a2e !important;
    border-radius: 4px !important;
    color: #1e3a5f !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    font-family: 'JetBrains Mono', monospace !important;
    letter-spacing: 0.04em !important;
    padding: 6px 12px !important;
    text-transform: uppercase !important;
}

.stButton button:hover {
    border-color: #1a3560 !important;
    color: #3d6499 !important;
    background: #080d1a !important;
}

/* AVATAR — hidden completely */
[data-testid="stChatMessageAvatar"],
[data-testid="stChatMessageAvatar"] * {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
}
</style>
""", unsafe_allow_html=True)

# Session management
if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())
    st.session_state.history = load_memory(st.session_state.session_id)

# Nav
nav_col, btn_col = st.columns([5, 1])
with nav_col:
    st.markdown("""
    <div class="z-nav">
        <div class="z-wordmark">
            <span class="z-dot"></span>
            ZEPHYRA
        </div>
        <span class="z-version">v0.1</span>
    </div>
    """, unsafe_allow_html=True)
with btn_col:
    st.markdown("<div style='padding-top:18px'>", unsafe_allow_html=True)
    if st.button("new chat", use_container_width=True):
        clear_memory(st.session_state.session_id)
        st.session_state.session_id = str(uuid.uuid4())
        st.session_state.history = []
        st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)

# Empty state
if not st.session_state.history:
    st.markdown("""
    <div class="z-empty">
        <p class="z-greeting">What do you want<br>to <span>know?</span></p>
        <p class="z-byline">Built by Shravani · Local-first · No data leaves your machine</p>
    </div>
    """, unsafe_allow_html=True)

# Chat history
for turn in st.session_state.history:
    role = "user" if turn["role"] == "user" else "assistant"
    with st.chat_message(role):
        st.markdown(turn["content"])

# Input
user_input = st.chat_input("Ask anything...")

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