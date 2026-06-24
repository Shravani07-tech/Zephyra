class Task:
    def __init__(self, title, status="pending", priority="medium"):
        self.title = title
        self.status = status
        self.priority = priority

    def __str__(self):
        return f"[{self.priority}] {self.title} - {self.status}"

    def __repr__(self):
        return f"Task(title='{self.title}', status='{self.status}', priority='{self.priority}')"

    def mark_complete(self):
        self.status = "completed"


class UrgentTask(Task):
    def __init__(self, title, status="pending", priority="high", deadline="today"):
        super().__init__(title, status, priority)
        self.deadline = deadline

    def __str__(self):
        base = super().__str__()
        return f"{base} (DEADLINE: {self.deadline})"


if __name__ == "__main__":
    t = Task("Build Zephyra memory module")
    u = UrgentTask("Fix critical bug before demo")

    print("--- Before ---")
    print(t)
    print(u)

    t.mark_complete()
    u.mark_complete()

    print("--- After ---")
    print(t)
    print(u)

    print("--- Repr check ---")
    print(repr(t))
    print(repr(u))