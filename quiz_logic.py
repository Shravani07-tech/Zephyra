"""Quiz logic for Zephyra Day 1 quiz app."""

def load_questions():
    """Returns the quiz question bank."""
    return [
        {"question": "What language is Zephyra built in?", "answer": "python"},
        {"question": "What framework handles the API?", "answer": "fastapi"},
        {"question": "What tool runs LLMs locally?", "answer": "ollama"},
        {"question": "What is the name of the project?", "answer": "zephyra"},
        {"question": "What stores vector memory?", "answer": "chromadb"},
    ]


def ask_question(q, attempts=1):
    """Ask one question, return True if correct. 'attempts' = default arg."""
    for attempt in range(attempts):
        try:
            user_input = input(q["question"] + " > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nInput cancelled.")
            return False

        if user_input == q["answer"].lower():   # bug fix: lowercase both sides
            print("Correct!")
            return True
        else:
            remaining = attempts - attempt - 1
            if remaining > 0:
                print(f"Wrong, try again. {remaining} attempt(s) left.")
            else:
                print(f"Wrong. Answer was: {q['answer']}")
    return False


def run_quiz(questions, *, shuffle=False, sorter=None):
    """Run full quiz. sorter = optional lambda to order questions."""
    if sorter:
        questions = sorted(questions, key=sorter)
    if shuffle:
        import random
        questions = questions[:]
        random.shuffle(questions)

    score = 0
    for q in questions:
        if ask_question(q):
            score += 1
    return score


def summarize(score, total, *notes, **extra_stats):
    """*notes = any extra lines to print. **extra_stats = labeled stats."""
    print(f"\nYour score: {score}/{total}")
    for note in notes:
        print(note)
    for key, value in extra_stats.items():
        print(f"{key.replace('_', ' ').title()}: {value}")