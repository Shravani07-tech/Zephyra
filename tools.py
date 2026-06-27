import datetime
import psutil

def get_current_time():
    return datetime.datetime.now().strftime("%I:%M %p")

def get_current_date():
    return datetime.datetime.now().strftime("%A, %B %d, %Y")

def calculate(expression):
    allowed_chars = set("0123456789+-*/(). ")
    if not expression or not set(expression) <= allowed_chars:
        return "I can only do basic arithmetic (+, -, *, /) — that input has something else in it."
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))
    except Exception:
        return "That expression didn't evaluate cleanly — check it and try again."

def get_system_info():
    cpu = psutil.cpu_percent(interval=0.3)
    mem = psutil.virtual_memory()
    return (
        f"CPU usage: {cpu}%\n"
        f"RAM: {mem.percent}% used ({mem.used // (1024**2)} MB / {mem.total // (1024**2)} MB)"
    )

def try_handle_with_tool(user_input):
    text = user_input.lower().strip()
    if "what time" in text or text in {"time", "current time"}:
        return get_current_time()
    if "what date" in text or "today's date" in text or text in {"date", "current date"}:
        return get_current_date()
    if text.startswith("calculate ") or text.startswith("calc "):
        return calculate(text.split(" ", 1)[1])
    return None