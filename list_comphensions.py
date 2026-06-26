# Regular for loop way
modules = ["memory", "planner", "executor", "research", "security"]

active = []
for m in modules:
    if len(m) > 6:
        active.append(m)

print("Regular way:", active)

# List comprehension way - same result, one line
active2 = [m for m in modules if len(m) > 6]
print("Comprehension way:", active2)

# Another example - uppercase all modules
upper_modules = [m.upper() for m in modules]
print("Uppercase:", upper_modules)
