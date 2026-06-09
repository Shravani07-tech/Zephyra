while True:
    command = input("Zephyra> ").lower()
    
    if command == "status":
        print("Zephyra is active.")
    elif command == "version":
        print("Version 1.0.0")
    elif command == "quit":
        print("Shutting down Zephyra...")
        break
    else:
        print(f"Unknown command: {command}")