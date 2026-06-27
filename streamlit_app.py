"""
Zephyra — Streamlit Chat UI
-----------------------------
Reuses brain.py and memory.py exactly as-is. Failed LLM calls are shown
as an error message but NOT saved to memory, matching the CLI's behavior.
"""

import streamlit as st
from brain import think, format_error
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

    try:
        reply = think(user_input, st.session_state.history)
    except Exception as e:
        with st.chat_message("assistant"):
            st.error(format_error(e))
    else:
        with st.chat_message("assistant"):
            st.markdown(reply)
        save_turn(user_input, reply)
        st.session_state.history.append({"role": "user", "content": user_input})
        st.session_state.history.append({"role": "zephyra", "content": reply})