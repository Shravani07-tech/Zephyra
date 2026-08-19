import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def log(msg):
    print(f"[SMOKE TEST] {msg}")

def run_test():
    try:
        # 1. /api/system/status
        log("Testing GET /api/system/status...")
        req = urllib.request.urlopen(f"{BASE_URL}/api/system/status")
        assert req.status == 200, f"Expected status 200, got {req.status}"
        status_data = json.loads(req.read().decode())
        assert status_data["provider"] == "NVIDIA", "Provider should be NVIDIA"
        log("System status OK.")

        # 2. first chat & SSE chunks & conversation ID
        log("Testing first chat stream (sending message)...")
        payload = {"message": "Hello Zephyra"}
        chat_req = urllib.request.Request(
            f"{BASE_URL}/api/chat",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"}
        )
        conversation_id = None
        chunks = []
        done_received = False

        with urllib.request.urlopen(chat_req) as response:
            assert response.status == 200, f"Expected 200, got {response.status}"
            for line in response:
                line_str = line.decode().strip()
                if not line_str.startswith("data: "):
                    continue
                data = json.loads(line_str[6:])
                log(f"Received SSE event: {data}")
                if data["event"] == "conversation":
                    conversation_id = data["conversation_id"]
                elif data["event"] == "chunk":
                    chunks.append(data.get("text", ""))
                elif data["event"] == "done":
                    done_received = True

        assert conversation_id is not None, "Failed to receive conversation ID"
        assert len(chunks) > 0, "Failed to receive SSE message chunks"
        assert done_received, "Failed to receive done event"
        log(f"First chat successful. Conversation ID: {conversation_id}")
        log(f"Response: {''.join(chunks)}")

        # 3. second contextual message
        log("Testing second contextual message...")
        payload2 = {"conversation_id": conversation_id, "message": "What did I just say?"}
        chat_req2 = urllib.request.Request(
            f"{BASE_URL}/api/chat",
            data=json.dumps(payload2).encode(),
            headers={"Content-Type": "application/json"}
        )
        chunks2 = []
        done_received2 = False

        with urllib.request.urlopen(chat_req2) as response2:
            assert response2.status == 200
            for line in response2:
                line_str = line.decode().strip()
                if not line_str.startswith("data: "):
                    continue
                data = json.loads(line_str[6:])
                log(f"Received SSE event: {data}")
                if data["event"] == "chunk":
                    chunks2.append(data.get("text", ""))
                elif data["event"] == "done":
                    done_received2 = True

        assert len(chunks2) > 0, "Failed to receive chunks for second message"
        assert done_received2, "Failed to receive done event for second message"
        log(f"Second chat successful. Response: {''.join(chunks2)}")

        # 4. conversation listing
        log("Testing GET /api/conversations (listing)...")
        list_req = urllib.request.urlopen(f"{BASE_URL}/api/conversations")
        assert list_req.status == 200
        convs = json.loads(list_req.read().decode())
        ids = [c["id"] for c in convs]
        assert conversation_id in ids, f"Conversation {conversation_id} not listed in conversations"
        log("Conversation is successfully listed.")

        # 5. message persistence
        log(f"Testing GET /api/conversations/{conversation_id}/messages...")
        msgs_req = urllib.request.urlopen(f"{BASE_URL}/api/conversations/{conversation_id}/messages")
        assert msgs_req.status == 200
        messages = json.loads(msgs_req.read().decode())
        # We expect 4 messages: User 1, Assistant 1, User 2, Assistant 2
        log(f"Messages found in history: {len(messages)}")
        for m in messages:
            log(f"  {m['role']}: {m['content']}")
        assert len(messages) >= 4, f"Expected at least 4 messages, got {len(messages)}"
        assert messages[0]["role"] == "user"
        assert messages[1]["role"] == "assistant"
        log("Message history and persistence verified.")

        # 6. deletion
        log(f"Testing DELETE /api/conversations/{conversation_id}...")
        del_req = urllib.request.Request(f"{BASE_URL}/api/conversations/{conversation_id}", method="DELETE")
        with urllib.request.urlopen(del_req) as del_res:
            assert del_res.status == 204
        log("Conversation deleted.")

        # Verify deletion
        log("Verifying conversation is no longer listed...")
        list_req2 = urllib.request.urlopen(f"{BASE_URL}/api/conversations")
        convs2 = json.loads(list_req2.read().decode())
        ids2 = [c["id"] for c in convs2]
        assert conversation_id not in ids2, "Conversation was not removed from list"
        log("Verification complete. Conversation is gone.")

        log("ALL SMOKE TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)

    except Exception as e:
        log(f"TEST FAILED: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    run_test()
