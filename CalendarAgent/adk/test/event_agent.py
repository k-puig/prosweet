from google.adk.agents.llm_agent import Agent
import google.generativeai as genai
import datetime as dt
import requests
import base64
import json
from icalendar import Calendar, Event
from requests.auth import HTTPBasicAuth

API_BASE_URL = "http://localhost:3001"  # your Hono server

# -------------------- FUNCTION SCHEMAS --------------------

create_event_schema = {
    "name": "create_event",
    "description": "Creates a new calendar event in the user's Radicale calendar.",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "summary": {"type": "string"},
            "start_time": {"type": "string"},
            "end_time": {"type": "string"},
            "username": {"type": "string"},
            "password": {"type": "string"},
        },
        "required": ["name", "summary", "start_time", "end_time", "username", "password"],
    },
}

update_event_schema = {
    "name": "update_event",
    "description": "Updates an existing calendar event in the user's Radicale calendar.",
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
        },
        "required": ["name", "summary", "start_time", "end_time", "username", "password", "event_uid"],
    },
}

delete_event_schema = {
    "name": "delete_event",
    "description": "Deletes an existing calendar event from the user's Radicale calendar.",
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

# -------------------- HELPERS --------------------

def make_auth_header(username: str, password: str) -> dict:
    """Helper to build Basic Auth header for the API"""
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json",
    }

headers = {"Content-Type": "application/json"}

# -------------------- CORE FUNCTIONS --------------------

def get_all_calendar_items(username: str, password: str):
    """Fetch all events from the server API."""
    try:
        response = requests.get(f"{API_BASE_URL}/events?all=true", auth=HTTPBasicAuth(username, password))
        response.raise_for_status()

        events = response.json()
        print("✅ Events found:")
        print(json.dumps(events, indent=2))
        return events
    except Exception as e:
        print(f"❌ Failed to fetch events: {e}")
        return []


def create_event(name: str, summary: str, start_time: str, end_time: str, username: str, password: str):
    """Create a new calendar event via the API."""
    auth = HTTPBasicAuth(username, password)
    data = {
        "summary": name,
        "start": start_time,
        "end": end_time,
        "description": summary,
    }

    try:
        response = requests.post(f"{API_BASE_URL}/events", auth=auth, headers=headers, json=data)
        response.raise_for_status()

        result = response.json()
        print("✅ Event created:")
        print(json.dumps(result, indent=2))
        return result
    except Exception as e:
        print("❌ Failed to create event:", e)
        if hasattr(e, "response") and e.response is not None:
            print("Response text:", e.response.text)
        return None


def update_event(name: str, summary: str, start_time: str, end_time: str,
                 username: str, password: str, event_uid: str):
    """Update an existing calendar event by deleting and recreating it with the same UID."""
    auth = HTTPBasicAuth(username, password)
    data = {
        "summary": name,
        "start": start_time,
        "end": end_time,
        "description": summary,
        "uid": event_uid,
    }

    # 1️⃣ Delete existing event
    try:
        delete_url = f"{API_BASE_URL}/events/{event_uid}"
        del_response = requests.delete(delete_url, auth=auth)
        if del_response.status_code not in (200, 204, 404):
            print(f"⚠️ Failed to delete event (status {del_response.status_code}): {del_response.text}")
        else:
            print(f"🗑️ Deleted existing event UID: {event_uid}")
    except Exception as e:
        print(f"⚠️ Error deleting event before update: {e}")

    # 2️⃣ Recreate event
    try:
        post_url = f"{API_BASE_URL}/events"
        post_response = requests.post(post_url, auth=auth, headers=headers, json=data)
        post_response.raise_for_status()

        result = post_response.json()
        print("✅ Event re-created (updated):")
        print(json.dumps(result, indent=2))
        return result
    except Exception as e:
        print(f"❌ Failed to recreate event after delete: {e}")
        if hasattr(e, "response") and e.response is not None:
            print("Response text:", e.response.text)
        return None


def delete_event(event_uid: str, username: str, password: str):
    """Delete an event via the API."""
    auth = HTTPBasicAuth(username, password)
    try:
        response = requests.delete(f"{API_BASE_URL}/events/{event_uid}", auth=auth)
        response.raise_for_status()

        result = response.json()
        print("🗑️ Event deleted:")
        print(json.dumps(result, indent=2))
        return result
    except Exception as e:
        print("❌ Failed to delete event:", e)
        if hasattr(e, "response") and e.response is not None:
            print("Response text:", e.response.text)
        return None

# -------------------- GEMINI INTEGRATION --------------------

def ask_gemini(username: str, password: str, model: genai.GenerativeModel):
    existing_events = get_all_calendar_items(username, password)

    formatted_events = json.dumps(existing_events, indent=2) if existing_events else "[]"
    today = dt.date.today().isoformat()

    user_prompt = str(input("User prompt: "))

    prompt = (
        "You are a scheduling AI that manages events in a Radicale CalDAV server.\n"
        f"Today's date is {today}.\n"
        f"The user's Radicale username is '{username}' and password is '{password}'.\n"
        "All date/time values must be ISO 8601 formatted strings (YYYY-MM-DDTHH:MM:SS).\n\n"
        "Below is a JSON list of all current events in the user's calendar:\n"
        f"{formatted_events}\n\n"
        "If the user asks to **add or schedule** a new event, respond by calling the `create_event` function "
        "with the correct arguments.\n"
        "If the user asks to **update, modify, or reschedule** an existing event, respond by calling the `update_event` "
        "function with the correct arguments (including the same `event_uid` as the existing event).\n"
        "If the user asks to **delete, cancel, or remove** an existing event, respond by calling the `delete_event` "
        "function with the correct arguments, including the `event_uid` of the event to delete.\n\n"
        "If you cannot find an existing event to update or delete, respond with plain text explaining that.\n"
        "Do NOT output any explanation or markdown — only return a function call or a short text reply.\n\n"
        f"User: {user_prompt}"
    )

    response = model.generate_content([prompt])
    part = response.candidates[0].content.parts[0]

    if hasattr(part, "function_call") and part.function_call:
        func = part.function_call
        if func.name == "create_event":
            result = create_event(**func.args)
        elif func.name == "update_event":
            result = update_event(**func.args)
        elif func.name == "delete_event":
            result = delete_event(**func.args)
        print(result)
    else:
        print(part.text)

# -------------------- MAIN --------------------

if __name__ == "__main__":
    username = "test"
    password = "test"

    genai.configure(api_key="AIzaSyABMW-LywTlbg5x-tHMY6XeqaTXktNSYtQ")
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        tools=[{"function_declarations": [create_event_schema, update_event_schema, delete_event_schema]}]
    )

    while True:
        ask_gemini(username, password, model)
        choice = input("Continue? (y/n): ").strip().lower()
        if choice == "n":
            break