"""
Zephyra — Streamlit Chat UI
-----------------------------
Reuses brain.py and memory.py exactly as-is. No new LangChain code here —
just chat_input/chat_message wired to the same think() function the CLI uses.
This is the proof the modular architecture actually pays off.

Note: on Streamlit Community Cloud, the filesystem is ephemeral. Within one
browser session, st.session_state.history keeps memory working fine. The
data/zephyra_memory.json file will NOT survive a cold start/redeploy on the
free tier — that's a hosting limitation, not a bug here.
"""

import streamlit as st
from brain import think
from memory import load_memory, save_turn

st.set_page_config(page_title="Zephyra", page_icon="🤖")
st.title("Zephyra 🤖")
st.caption("Local-first AI assistant — built by Shravani")

if "history" not in st.session_state:
    st.session_state.history = load_memory()

for turn in st.session_state.history:
    role = "user" if turn["role"] == "user" else "assistant"
    with st.chat_message(role):
        st.markdown(turn["content"])

user_input = st.chat_input("Message Zephyra...")

if user_input:
    with st.chat_message("user"):
        st.markdown(user_input)

    reply = think(user_input, st.session_state.history)

    with st.chat_message("assistant"):
        st.markdown(reply)

    save_turn(user_input, reply)
    st.session_state.history.append({"role": "user", "content": user_input})
    st.session_state.history.append({"role": "zephyra", "content": reply})