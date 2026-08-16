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
    background: #08090D;
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
    border-bottom: 1px solid #0F1420;
    margin-bottom: 0;
    background: transparent;
}

.z-wordmark {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    font-weight: 500;
    color: #ffffff;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
}

.z-dot {
    width: 6px;
    height: 6px;
    background: #00C9A7;
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 0 8px rgba(0, 201, 167, 0.4);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.8; }
    100% { transform: scale(1); opacity: 1; }
}

.z-version {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #4A6382;
    letter-spacing: 0.05em;
    padding: 3px 8px;
    border: 1px solid #1A2235;
    border-radius: 4px;
    background: #0D111A;
}

/* EMPTY STATE */
.z-empty {
    padding: 96px 0 56px;
}

.z-greeting {
    font-size: 36px;
    font-weight: 500;
    color: #F0F4FF;
    letter-spacing: -0.02em;
    margin: 0 0 12px;
    line-height: 1.2;
    text-align: left;
}

.z-greeting span {
    color: #00C9A7;
}

.z-byline {
    font-size: 14px;
    color: #4A6382;
    margin: 0 0 40px;
    font-weight: 400;
    letter-spacing: 0.01em;
}

/* MESSAGES */
[data-testid="stChatMessage"] {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    animation: slideUp 0.3s ease-out forwards;
}

@keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

div[data-testid="stChatMessageContent"] {
    background: transparent !important;
    border: none !important;
    padding: 16px 0 !important;
    border-bottom: 1px solid #0F1420 !important;
    border-radius: 0 !important;
}

div[data-testid="stChatMessageContent"] p {
    color: #8BA3CC !important;
    font-size: 15px !important;
    line-height: 1.7 !important;
    margin: 0 !important;
}

[data-testid="stChatMessage"][data-testid*="user"] div[data-testid="stChatMessageContent"] p,
div[data-testid="stChatMessageContent"]:has(+ *) p {
    color: #C8D8F0 !important;
}

[data-testid="stChatMessage"]:nth-child(odd) div[data-testid="stChatMessageContent"] p {
    color: #D0DFF5 !important;
}

/* INPUT */
[data-testid="stChatInput"] {
    background: transparent !important;
    border-top: 1px solid #0F1420 !important;
    padding: 24px 0 !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}

.stChatInput textarea {
    background: rgba(14, 16, 24, 0.7) !important;
    border: 1px solid #1A2235 !important;
    border-radius: 8px !important;
    color: #C8D8F0 !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 13px !important;
    caret-color: #00C9A7 !important;
    padding: 16px 20px !important;
    transition: all 0.2s ease;
}

.stChatInput textarea:focus {
    border-color: #00C9A7 !important;
    box-shadow: 0 0 0 1px #00C9A7, 0 4px 12px rgba(0, 201, 167, 0.1) !important;
    outline: none !important;
    background: rgba(14, 16, 24, 0.9) !important;
}

.stChatInput textarea::placeholder {
    color: #2D3F56 !important;
}

/* NEW CHAT BUTTON */
.stButton button {
    background: transparent !important;
    border: 1px solid #1A2235 !important;
    border-radius: 6px !important;
    color: #4A6382 !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    font-family: 'JetBrains Mono', monospace !important;
    letter-spacing: 0.05em !important;
    padding: 8px 14px !important;
    text-transform: uppercase !important;
    transition: all 0.2s ease;
}

.stButton button:hover {
    border-color: #00C9A7 !important;
    color: #00C9A7 !important;
    background: rgba(0, 201, 167, 0.05) !important;
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