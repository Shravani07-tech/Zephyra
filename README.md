# Zephyra 🤖

> A modular, privacy-first, local-running AI chatbot — built from scratch.

## What it is

Zephyra is a CLI + web AI assistant built on LangChain, designed around clean separation of concerns: a **brain** for LLM reasoning, a **memory** layer for persistent conversation history, and a **tools** layer for deterministic functions the model can call instead of guessing. It runs entirely local-first via **Ollama** — no API key, no cost, no data leaving your machine — with an optional cloud-hosted demo (Groq) for public deployment.

## Live demo

🔗 **(https://zephyra-dy4zog7lyanrcxv8a44c6t.streamlit.app)**

> Note: the hosted demo runs on Groq's cloud API (free tier), not local Ollama — Streamlit Community Cloud has no access to a local machine, so the public version swaps backends. The local CLI version below runs fully offline.

## Features

- 💬 Conversational chat — CLI and Streamlit web UI, same underlying brain
- 🧠 Persistent memory — conversations survive a restart, with a 5-turn sliding context window so the model doesn't drown in old history
- 🛠️ Built-in tools — current time, date, calculator, system info (CPU/RAM via `psutil`)
- 🔁 Dual LLM backend — Ollama locally (free, private), Groq for the public demo, swapped via one env var
- ⌨️ Slash commands — `/help /quit /clear /history /time /date /calc /sysinfo`
- 🛡️ Graceful failure handling — a dropped LLM connection shows a clear message instead of crashing, and failed calls are never saved into memory

## Architecture

```
zephyra_chatbot.py   → CLI interface — I/O and slash-command dispatch only
streamlit_app.py     → Web chat UI — reuses the same brain/memory/tools, zero duplicate logic
brain.py             → LLM logic — prompt construction, provider switch, tool routing
memory.py            → Persistent JSON conversation log + sliding-window context
tools.py             → Plain Python functions Zephyra can call directly
```

Each interface is a thin wrapper around the same `brain.py`. Built once, reused everywhere — adding the Streamlit UI required zero changes to the chat logic itself.

## Tech stack

Python · LangChain · Ollama (local inference) · Groq (cloud inference) · Streamlit · psutil

## Install & run locally

```bash
git clone https://github.com/Shravani07-tech/Zephyra.git
cd Zephyra
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Pull a local model (one-time, ~2GB)
ollama pull llama3.2

python zephyra_chatbot.py
```

## Usage

Type normally to chat, or use a command:

```
/help          list all commands
/time          /date          /calc 12*4+1          /sysinfo
/history       view the full conversation log
/clear         wipe memory (this session + the saved file)
/quit          exit
```

## Roadmap (Phase 2)

- Semantic + procedural memory (full four-layer memory architecture)
- Real LLM-driven tool-calling — current tool routing is simple keyword matching, not agentic
- FastAPI backend, SQLite/ChromaDB persistence
- Multi-session support (`/sessions` is currently a stub)

## Built by

Shravani Mayekar — B.Tech Electronics & Computer Science, building toward AI generalist / freelance AI development work.
