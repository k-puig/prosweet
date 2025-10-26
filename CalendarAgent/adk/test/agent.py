from google.adk.agents.llm_agent import Agent
import google.generativeai as genai
import datetime as dt
import requests
import base64
import json
import uuid
import getpass
from icalendar import Calendar, Event
import re

API_BASE_URL = "http://localhost:3001"  # your Hono server

create_task_schema = {
    "name": "create_task",
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
            "calendar_id": {"type": "string"},
        },
        "required": ["name", "summary", "start_time", "end_time", "username", "password", "calendar_id"],
    },
}

update_task_schema = {
    "name": "update_task",
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
            "calendar_id": {"type": "string"},
            "event_uid": {"type": "string"},
        },
        "required": ["name", "summary", "start_time", "end_time", "username", "password", "calendar_id", "event_uid"],
    },
}

delete_task_schema = {
    "name": "delete_task",
    "description": "Deletes an existing calendar event from the user's Radicale calendar.",
    "parameters": {
        "type": "object",
        "properties": {
            "username": {"type": "string"},
            "password": {"type": "string"},
            "calendar_id": {"type": "string"},
            "event_uid": {"type": "string"}
        },
        "required": ["username", "password", "calendar_id", "event_uid"]
    },
}

def make_auth_header(username: str, password: str) -> dict:
    """Return a Basic Auth header."""
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def get_all_calendar_items(username: str, password: str, calendar_id: str):
    """Fetch all events from the server API."""
    headers = make_auth_header(username, password)
    try:
        response = requests.get(f"{API_BASE_URL}/events?all=true", headers=headers)
        response.raise_for_status()
        return response.json().get("events", [])
    except Exception as e:
        print(f"❌ Failed to fetch events: {e}")
        return []


def create_task(name: str, summary: str, start_time: str, end_time: str, username: str, password: str, calendar_id: str):
    """Create a new calendar event via the API."""
    headers = make_auth_header(username, password)
    data = {
        "summary": summary or name,
        "start": start_time,
        "end": end_time,
        "description": name,
        "calendarUrl": calendar_id,
    }
    try:
        response = requests.post(f"{API_BASE_URL}/events", json=data, headers=headers)
        response.raise_for_status()
        print("✅ Event created:", response.json())
        return response.json()
    except Exception as e:
        print("❌ Failed to create event:", e)
        print("Response:", getattr(e, 'response', None))
        return None


def update_task(name: str, summary: str, start_time: str, end_time: str, username: str, password: str, calendar_id: str, event_uid: str):
    """Update an existing calendar event."""
    headers = make_auth_header(username, password)
    data = {
        "summary": summary or name,
        "start": start_time,
        "end": end_time,
        "description": name,
        "calendarUrl": calendar_id,
    }
    try:
        response = requests.put(f"{API_BASE_URL}/events/{event_uid}", json=data, headers=headers)
        response.raise_for_status()
        print("✅ Event updated:", response.json())
        return response.json()
    except Exception as e:
        print("❌ Failed to update event:", e)
        return None


def delete_task(event_uid: str, username: str, password: str):
    """Delete an event via the API."""
    headers = make_auth_header(username, password)
    try:
        response = requests.delete(f"{API_BASE_URL}/events/{event_uid}", headers=headers)
        response.raise_for_status()
        print("🗑️ Event deleted:", response.json())
        return response.json()
    except Exception as e:
        print("❌ Failed to delete event:", e)
        return None
    
def ask_gemini(username: str, password: str, calendar_id: str, model: genai.GenerativeModel):
    existing_events = get_all_calendar_items(username, password, calendar_id)

    if existing_events:
        formatted_events = json.dumps(existing_events, indent=2)
    else:
        formatted_events = "[]"

    #print_calendar_events(username, password, calendar_id)

    today = dt.date.today().isoformat()

    # Schedule a yoga session tomorrow morning from 7:00 to 8:00 AM.
    user_prompt = str(input("User prompt: ")) 
    #user_prompt = "Please update my Differential Equation Exam's time to 11:00 AM to 1:15 PM"

    # "Please add a brief summary to 'summary'"
    prompt = (
        "You are a scheduling AI that manages events in a Radicale CalDAV server.\n"
        f"Today's date is {today}.\n"
        f"The user's Radicale username is '{username}', password is '{password}', "
        f"and their calendar ID is '{calendar_id}'.\n"
        "All date/time values must be ISO 8601 formatted strings (YYYY-MM-DDTHH:MM:SS).\n\n"
        "Below is a JSON list of all current events in the user's calendar:\n"
        f"{formatted_events}\n\n"
        "If the user asks to **add or schedule** a new event, respond by calling the `create_task` function "
        "with the correct arguments.\n"
        "If the user asks to **update, modify, or reschedule** an existing event, respond by calling the `update_task` "
        "function with the correct arguments (including the the same `uid` as the existing event).\n"
        "If the user asks to **delete, cancel, or remove** an existing event, respond by calling the `delete_task` "
        "function with the correct arguments, including the `event_uid` of the event to delete.\n\n"
        "If you cannot find an existing event to update, respond with plain text explaining that.\n"
        "Do NOT output any explanation or markdown — only return a function call or a short text reply.\n\n"
        f"User: {user_prompt}"
    )

    response = model.generate_content([prompt])

    part = response.candidates[0].content.parts[0]

    if hasattr(part, "function_call") and part.function_call:
        func = part.function_call

        if func.name == "create_task":
            result = create_task(**func.args)
        if func.name == "update_task":
            result = update_task(**func.args)
        if func.name == "delete_task":
            result = delete_task(**func.args)
        
        print(result)
        #print_result(result, func.name)

    else:
        print(part.text)

if __name__ == "__main__":
    # Optional: prompt the user interactively
    # print("🔐 Please enter your Radicale credentials:")
    # username = input("Username: ")
    # password = getpass.getpass("Password: ")
    # calendar_id = input("Calendar ID (from web UI): ")

    username = "admin"
    password = "mypassword"
    calendar_id = "aa5e311e-00e3-5874-0b59-e4cb9e1dfd32"

    genai.configure(api_key="AIzaSyABMW-LywTlbg5x-tHMY6XeqaTXktNSYtQ")
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        tools=[{"function_declarations": [create_task_schema, update_task_schema, delete_task_schema]}]
    )

    while(True):
        #print_calendar_events(username, password, calendar_id)
        ask_gemini(username, password, calendar_id, model)

        choice = str(input("Continue? (y/n): "))
        if (choice == "n"):
            #print_calendar_events(username, password, calendar_id)
            break