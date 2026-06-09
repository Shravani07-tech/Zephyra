zephyra_modules = ["memory", "planner", "executor", "research"]
print("Modules:", zephyra_modules)
print("First module:", zephyra_modules[0])

zephyra_modules.append("security")
print("After adding security:", zephyra_modules)

zephyra_version = (1, 0, 0)
print("Version:", zephyra_version)

zephyra_status = {
    "name": "Zephyra",
    "version": 1.0,
    "status": "active",
    "modules": 5
}
print("System name:", zephyra_status["name"])
print("Full status:", zephyra_status)