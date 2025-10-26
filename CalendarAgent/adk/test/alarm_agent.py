from google.adk.agents.llm_agent import Agent
import google.generativeai as genai
import datetime as dt
import requests
import base64
import json
from requests.auth import HTTPBasicAuth

API_BASE_URL = "http://localhost:3001"  # Your Hono + CalDAV server

# ============================================================
#  FUNCTION SCHEMAS
# ============================================================

create_alarm_schema = {
    "name": "create_alarm",
    "description": "Creates a new calendar event with optional alarm(s) in the user's Radicale calendar.",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "summary": {"type": "string"},
            "start_time": {"type": "string"},
            "end_time": {"type": "string"},
            "username": {"type": "string"},
            "password": {"type": "string"},
            "alarms": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "action": {"type": "string"},
                        "trigger": {"type": "string"},
                        "description": {"type": "string"},
                    },
                    "required": ["action", "trigger"],
                },
            },
        },
        "required": ["name", "summary", "start_time", "end_time", "username", "password"],
    },
}

update_alarm_schema = {
    "name": "update_alarm",
    "description": "Updates an existing calendar event (with alarms) in the user's Radicale calendar.",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "summary": {"type": "string"},
            "start_time": {"type": "string"},
            "end_time": {"type": "string"},
            "username": {"type": "string"},
            "password": {"type": "string"},
            "event_uid": {"type": "string"},
            "alarms": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "action": {"type": "string"},
                        "trigger": {"type": "string"},
                        "description": {"type": "string"},
                    },
                    "required": ["action", "trigger"],
                },
            },
        },
        "required": ["name", "summary", "start_time", "end_time", "username", "password", "event_uid"],
    },
}

delete_alarm_schema = {
    "name": "delete_alarm",
    "description": "Deletes an existing calendar event (and alarms) from the user's Radicale calendar.",
    "parameters": {
        "type": "object",
        "properties": {
            "username": {"type": "string"},
            "password": {"type": "string"},
            "event_uid": {"type": "string"},
        },
        "required": ["username", "password", "event_uid"],
    },
}

# ============================================================
#  HELPERS
# ============================================================

def to_safe_json(obj):
    """Recursively convert protobuf / complex Gemini args to JSON-safe types."""
    if isinstance(obj, dict):
        return {k: to_safe_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [to_safe_json(v) for v in obj]
    elif hasattr(obj, "to_dict"):
        return to_safe_json(obj.to_dict())
    elif hasattr(obj, "_pb"):
        return to_safe_json(obj._pb)
    elif hasattr(obj, "__iter__") and not isinstance(obj, (str, bytes)):
        try:
            return [to_safe_json(v) for v in obj]
        except Exception:
            return str(obj)
    else:
        try:
            json.dumps(obj)
            return obj
        except TypeError:
            return str(obj)


def get_all_events(username: str, password: str):
    """Fetch all events (with alarms) from the calendar."""
    try:
        response = requests.get(f"{API_BASE_URL}/events?all=true", =HauthTTPBasicAuth(username, password))
        response.raise_for_status()
        events = response.json()
        print("✅ Events found:")
        print(json.dumps(events, indent=2))
        return events
    except Exception as e:
        print(f"❌ Failed to fetch events: {e}")
        return []


# ============================================================
#  CORE ALARM FUNCTIONS
# ============================================================

def create_alarm(name: str, summary: str, start_time: str, end_time: str,
                 username: str, password: str, alarms=None):
    """Create a new event with alarm(s)."""
    auth = HTTPBasicAuth(username, password)
    headers = {"Content-Type": "application/json"}

    # ✅ 1. Parse alarms if Gemini gave them as protobuf string
    if isinstance(alarms, str):
        try:
            alarms_str = alarms.strip()
            if alarms_str.startswith("["):
                alarms = json.loads(alarms_str)
            else:
                # fallback default if it looks like a struct dump
                alarms = [{
                    "action": "DISPLAY",
                    "trigger": "-PT10M",
                    "description": "Starts in 10 minutes"
                }]
        except Exception as e:
            print("⚠️ Could not parse alarms string:", e)
            alarms = [{
                "action": "DISPLAY",
                "trigger": "-PT10M",
                "description": "Starts in 10 minutes"
            }]

    # ✅ 2. Build event data
    data = {
        "summary": name,
        "description": summary,
        "start": start_time,
        "end": end_time,
    }
    if alarms:
        data["alarms"] = alarms

    # ✅ 3. Try standard endpoint first, fallback to /{username}/events
    try:
        response = requests.post(f"{API_BASE_URL}/events", auth=auth, headers=headers, json=data)
        if response.status_code == 401:
            print("⚠️ Received 401 — retrying with username in URL...")
            response = requests.post(f"{API_BASE_URL}/{username}/events", auth=auth, headers=headers, json=data)

        response.raise_for_status()
        result = response.json()
        print("✅ Alarm created:")
        print(json.dumps(result, indent=2))
        return result

    except Exception as e:
        print("❌ Failed to create alarm:", e)
        if hasattr(e, "response") and e.response is not None:
            print("Response text:", e.response.text)
        return None


def update_alarm(name: str, summary: str, start_time: str, end_time: str,
                 username: str, password: str, event_uid: str, alarms=None):
    """Update an existing event by deleting and recreating with same UID."""
    auth = HTTPBasicAuth(username, password)
    headers = {"Content-Type": "application/json"}

    # ✅ 1. Parse alarms if Gemini gave them as protobuf string
    if isinstance(alarms, str):
        try:
            alarms_str = alarms.strip()
            if alarms_str.startswith("["):
                alarms = json.loads(alarms_str)
            else:
                alarms = [{
                    "action": "DISPLAY",
                    "trigger": "-PT10M",
                    "description": "Starts in 10 minutes"
                }]
        except Exception as e:
            print("⚠️ Could not parse alarms string:", e)
            alarms = [{
                "action": "DISPLAY",
                "trigger": "-PT10M",
                "description": "Starts in 10 minutes"
            }]

    # ✅ 2. Delete existing event first
    try:
        delete_url = f"{API_BASE_URL}/events/{event_uid}"
        del_response = requests.delete(delete_url, auth=auth)
        if del_response.status_code in (200, 204, 404):
            print(f"🗑️ Deleted existing event UID: {event_uid}")
        else:
            print(f"⚠️ Failed to delete event before update: {del_response.text}")
    except Exception as e:
        print(f"⚠️ Error deleting event before update: {e}")

    # ✅ 3. Recreate with same UID
    try:
        data = {
            "summary": name,
            "description": summary,
            "start": start_time,
            "end": end_time,
            "uid": event_uid,
        }
        if alarms:
            data["alarms"] = alarms

        response = requests.post(f"{API_BASE_URL}/events", auth=auth, headers=headers, json=data)
        if response.status_code == 401:
            print("⚠️ Received 401 — retrying with username in URL...")
            response = requests.post(f"{API_BASE_URL}/{username}/events", auth=auth, headers=headers, json=data)

        response.raise_for_status()
        result = response.json()
        print("✅ Alarm re-created (updated):")
        print(json.dumps(result, indent=2))
        return result

    except Exception as e:
        print("❌ Failed to recreate event:", e)
        if hasattr(e, "response") and e.response is not None:
            print("Response text:", e.response.text)
        return None


def delete_alarm(event_uid: str, username: str, password: str):
    """Delete an event (and its alarms)."""
    auth = HTTPBasicAuth(username, password)
    try:
        response = requests.delete(f"{API_BASE_URL}/events/{event_uid}", auth=auth)
        if response.status_code in (200, 204):
            print("🗑️ Event (and alarms) deleted successfully.")
            return {"status": "ok"}
        else:
            print("⚠️ Unexpected response:", response.text)
            return {"status": "error", "response": response.text}
    except Exception as e:
        print("❌ Failed to delete alarm:", e)
        if hasattr(e, "response") and e.response is not None:
            print("Response text:", e.response.text)
        return None


# ============================================================
#  GEMINI INTEGRATION
# ============================================================

def to_dict_safe(obj):
    """
    Recursively convert Gemini protobuf structures (MapComposite, RepeatedComposite, StructValue)
    into plain Python dicts/lists/strings so they can be safely serialized and printed.
    """
    # Handle primitives and None
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj

    # Handle dict-like objects (protobuf MapComposite, StructValue)
    if hasattr(obj, "items"):
        return {k: to_dict_safe(v) for k, v in obj.items()}

    # Handle iterable objects (protobuf RepeatedComposite, lists, tuples)
    if hasattr(obj, "__iter__") and not isinstance(obj, (str, bytes, dict)):
        return [to_dict_safe(v) for v in obj]

    # Fallback for unknowns
    try:
        return json.loads(json.dumps(obj, default=str))
    except Exception:
        return str(obj)


def ask_gemini(username: str, password: str, model: genai.GenerativeModel):
    """Main loop for interacting with Gemini and managing calendar alarms."""
    existing_events = get_all_events(username, password)
    formatted_events = json.dumps(existing_events, indent=2) if existing_events else "[]"
    today = dt.date.today().isoformat()

    # 🗣️ Get user command
    user_prompt = str(input("User prompt: ")).strip()

    # 🧠 Improved system prompt
    prompt = (
        "You are an intelligent scheduling assistant that manages events and reminders "
        "for a user's Radicale CalDAV calendar via a REST API.\n"
        f"Today's date is {today}.\n"
        f"The user's Radicale username is '{username}' and password is '{password}'.\n"
        "All date/time values must be ISO 8601 formatted strings (YYYY-MM-DDTHH:MM:SS).\n\n"
        "Below is a JSON list of all current events in the user's calendar:\n"
        f"{formatted_events}\n\n"
        "If the user asks to **add or schedule** a new reminder, call the `create_alarm` function.\n"
        "If the user asks to **update, modify, or reschedule** a reminder, call the `update_alarm` function.\n"
        "If the user asks to **delete, cancel, or remove** a reminder, call the `delete_alarm` function.\n\n"
        "❗ IMPORTANT RULES:\n"
        "- Always use valid JSON for all arguments.\n"
        "- The `alarms` field must always be a JSON array, not a string or struct.\n"
        "  Example: \"alarms\": [{\"action\": \"DISPLAY\", \"trigger\": \"-PT10M\", \"description\": \"Starts in 10 minutes\"}]\n"
        "- Do NOT include markdown or explanations — only return a function call or a short text reply.\n\n"
        f"User: {user_prompt}"
    )

    # 🧠 Ask Gemini
    response = model.generate_content([prompt])

    # ✅ Extract function call
    part = response.candidates[0].content.parts[0]
    if hasattr(part, "function_call") and part.function_call:
        func = part.function_call
        print(f"\n🤖 Gemini called function `{func.name}`")

        # 🔧 Convert protobuf arguments into plain Python dict safely
        args = to_dict_safe(func.args)

        print("With arguments:")
        print(json.dumps(args, indent=2))

        # 🧩 Execute the correct function
        if func.name == "create_alarm":
            result = create_alarm(**args)
        elif func.name == "update_alarm":
            result = update_alarm(**args)
        elif func.name == "delete_alarm":
            result = delete_alarm(**args)
        else:
            print(f"⚠️ Unknown function call: {func.name}")
            return

        # ✅ Log result
        if result:
            print("\n✅ Operation successful.")
        else:
            print("\n⚠️ Operation may not have completed.")
    else:
        # If Gemini didn’t call a function
        print("\n🗣️ Gemini replied:")
        print(part.text)


# ============================================================
#  MAIN LOOP
# ============================================================

if __name__ == "__main__":
    username = "test"
    password = "test"

    genai.configure(api_key="AIzaSyABMW-LywTlbg5x-tHMY6XeqaTXktNSYtQ")
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        tools=[{"function_declarations": [create_alarm_schema, update_alarm_schema, delete_alarm_schema]}],
    )

    print("🚀 Alarm Agent started.\n")
    while True:
        ask_gemini(username, password, model)
        print("\n──────────────────────────────────────────\n")
        choice = input("Continue? (y/n): ").strip().lower()
        if choice == "n":
            print("👋 Exiting.")
            break