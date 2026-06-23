import time
from quiz_logic import load_questions, run_quiz, summarize

def main():
    questions = load_questions()
    start = time.time()

    try:
        score = run_quiz(
            questions,
            sorter=lambda q: len(q["question"])  # shortest question first
        )
    except Exception as e:
        print(f"Something broke during the quiz: {e}")
        score = 0
    finally:
        elapsed = round(time.time() - start, 1)

    summarize(score, len(questions), "Good hustle.", time_seconds=elapsed)


if __name__ == "__main__":
    main()