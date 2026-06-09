questions =[
    {"question":"What language is Zephyra build in?","answer":"python"},
    {"question":"What framwork handles the API?","answer":"fastapi"},
    {"question":"What tool runs LLMs locally?","answer":"ollama"},
    {"question":"What is the name of the project?","answer":"Zephyra"},
    {"question":"What stores vector memory?","answer":"chromadb"},
]
score = 0
for q in questions:
    user_input =input(q["question"] + ">").lower()
    if user_input ==q["answer"]:
        print("correct!")
        score += 1
    else:
        print(f"Wrong.Answer was:{q['answer']}")
        print(f"\nYour score:{score}/5")