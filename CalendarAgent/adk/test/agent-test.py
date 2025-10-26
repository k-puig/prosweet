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

base_url = "http://localhost:5232"

# 🧠 3️⃣ Function schema for AI — no uid anymore
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

def print_result(result, funcName: str):
    if funcName == "create_task":
        print("\nTask successfully created!")
        print("────────────────────────────────────")
        print(f"UID:          {result.get('uid')}")
        print(f"Name:         {result.get('name')}")
        print(f"Summary:      {result.get('summary')}")
        print(f"Start Time:   {result.get('start_time')}")
        print(f"End Time:     {result.get('end_time')}")
        print(f"Username:     {result.get('username')}")
        print(f"Calendar ID:  {result.get('calendar_id')}")
        print("────────────────────────────────────\n")
    elif funcName == "update_task":
        print("\nTask successfully updated!")
        print("────────────────────────────────────")
        print(f"UID:          {result.get('event_uid')}")
        print(f"Name:         {result.get('name')}")
        print(f"Summary:      {result.get('summary')}")
        print(f"Start Time:   {result.get('start_time')}")
        print(f"End Time:     {result.get('end_time')}")
        print(f"Username:     {result.get('username')}")
        print(f"Calendar ID:  {result.get('calendar_id')}")
        print("────────────────────────────────────\n")
    elif funcName == "delete_task":
        print("\nTask successfully deleted!")
        print("────────────────────────────────────")
        print(f"UID:          {result.get('event_uid')}")
        print(f"Username:     {result.get('username')}")
        print(f"Calendar ID:  {result.get('calendar_id')}")
    else:
        print(f"⚠️ Unknown function call: {funcName}")

def print_calendar_events(username: str, password: str, calendar_id: str):
    url = f"{base_url}/{username}/{calendar_id}/"

    response = requests.get(url, auth=(username, password))

    if response.status_code != 200:
        print(f"❌ Error {response.status_code}: {response.reason}")
        exit()
    
    cal = Calendar.from_ical(response.text)

    i = 1
    for component in cal.walk('vevent'):
        uid = str(component.get('uid'))
        summary = str(component.get('summary'))
        dtstart = component.get('dtstart').dt
        dtend = component.get('dtend').dt

        if isinstance(dtstart, dt.datetime):
            dtstart = dtstart.strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(dtend, dt.datetime):
            dtend = dtend.strftime("%Y-%m-%d %H:%M:%S")

        print(f"Event #{i}:")
        print(f"UID:          {uid}")
        print(f"Name:         {summary}")
        print(f"Start Time:   {dtstart}")
        print(f"End Time:     {dtend}")
        print(f"Username:     {username}")
        print(f"Calendar ID:  {calendar_id}")
        print("────────────────────────────────────\n")
        i += 1

def get_all_calendar_items(username: str, password: str, calendar_id: str):
    """
    Fetches all calendar events for a user from the Radicale server and returns them as structured dicts.
    """
    base_url = "http://localhost:5232"
    caldav_url = f"{base_url}/{username}/{calendar_id}/"

    headers = {
        "Authorization": "Basic " + base64.b64encode(f"{username}:{password}".encode()).decode()
    }

    try:
        response = requests.get(caldav_url, headers=headers, timeout=10)
        response.raise_for_status()

        ics_data = response.text

        # Parse the ICS file to extract events
        events = []
        raw_events = ics_data.split("BEGIN:VEVENT")
        for raw in raw_events[1:]:  # Skip the first part (calendar header)
            event = {}
            event["uid"] = re.search(r"UID:(.+)", raw)
            event["summary"] = re.search(r"SUMMARY:(.+)", raw)
            event["description"] = re.search(r"DESCRIPTION:(.+)", raw)
            event["dtstart"] = re.search(r"DTSTART.*:(\d+T\d+Z?)", raw)
            event["dtend"] = re.search(r"DTEND.*:(\d+T\d+Z?)", raw)

            events.append({
                "uid": event["uid"].group(1).strip() if event["uid"] else None,
                "summary": event["summary"].group(1).strip() if event["summary"] else None,
                "description": event["description"].group(1).strip() if event["description"] else None,
                "start_time": event["dtstart"].group(1).strip() if event["dtstart"] else None,
                "end_time": event["dtend"].group(1).strip() if event["dtend"] else None,
            })

        return events

    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to fetch calendar items: {e}")
        return []

def to_ical_time(datet: dt.datetime) -> str:
    if datet.tzinfo is None:
        datet = datet.replace(tzinfo=dt.timezone.utc)
    return datet.strftime("%Y%m%dT%H%M%SZ")

# 🧩 1️⃣ create_task — now auto-generates UID
def create_task(name: str, summary: str, start_time: str, end_time: str,
                username: str, password: str, calendar_id: str) -> dict:
    """Creates and uploads a calendar event to the Radicale server."""

    # Generate a unique UID for the new event
    uid = str(uuid.uuid4())

    calendar_item: dict = {
        "uid": uid,
        "name": name,
        "summary": summary,
        "start_time": start_time,
        "end_time": end_time,
        "username": username,
        "password": password,
        "calendar_id": calendar_id,
    }

    add_task(calendar_item)
    return calendar_item


# ⚙️ 2️⃣ add_task — dynamic credentials + UID collision check
def add_task(task: dict):
    """
    Uploads a task to the CalDAV (Radicale) server as an iCalendar VEVENT (.ics file).
    Automatically handles UID conflicts and authentication.
    """

    username = task["username"]
    password = task["password"]
    calendar_id = task["calendar_id"]
    event_uid = str(task["uid"])
    caldav_event_url = f"{base_url}/{username}/{calendar_id}/{event_uid}.ics"

    start_dt = dt.datetime.fromisoformat(str(task["start_time"]))
    end_dt = dt.datetime.fromisoformat(str(task["end_time"]))
    now = dt.datetime.now(dt.timezone.utc)

    ical_event = "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        "PRODID:-//ProSweet Planner//EN",
        "BEGIN:VEVENT",
        f"UID:{event_uid}",
        f"DTSTAMP:{to_ical_time(now)}",
        f"SUMMARY:{task['name']}",
        f"DESCRIPTION:{task['summary']}",
        f"DTSTART:{to_ical_time(start_dt)}",
        f"DTEND:{to_ical_time(end_dt)}",
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
        "END:VEVENT",
        "END:VCALENDAR",
        ""
    ])

    

    headers = {
        "Content-Type": "text/calendar",
        "Authorization": "Basic " + base64.b64encode(f"{username}:{password}".encode()).decode(),
        "If-None-Match": "*",  # prevents overwriting existing UIDs
    }

    try:
        print(f"➡️ Uploading event to: {caldav_event_url}")
        response = requests.put(caldav_event_url, headers=headers, data=ical_event.encode("utf-8"), timeout=10)

        # 409/412 = UID or ETag conflict → regenerate new UID once
        if response.status_code in (409, 412):
            print("⚠️ UID conflict detected, regenerating and retrying...")
            new_uid = str(uuid.uuid4())
            new_url = f"{base_url}/{username}/{calendar_id}/{new_uid}.ics"
            task["uid"] = new_uid
            headers["If-None-Match"] = "*"  # reset header
            response = requests.put(new_url, headers=headers, data=ical_event.encode("utf-8"), timeout=10)

        if response.status_code in (200, 201, 204):
            print("✅ Task successfully added or updated on CalDAV server!")
            return True
        else:
            print(f"❌ Failed to add task: {response.status_code} {response.reason}")
            print("Response text:", response.text)
            return False

    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return False
    
def update_task(name: str, summary: str, start_time: str, end_time: str, 
                username: str, password: str, calendar_id: str, event_uid: str) -> dict:
    """Creates and uploads a calendar event to the Radicale server."""

    calendar_item: dict = {
        "event_uid": event_uid,
        "name": name,
        "summary": summary,
        "start_time": start_time,
        "end_time": end_time,
        "username": username,
        "password": password,
        "calendar_id": calendar_id,
    }

    put_task(calendar_item)
    return calendar_item
    
def put_task(task: dict):
    username = task["username"]
    password = task["password"]
    calendar_id = task["calendar_id"]
    event_uid = str(task["event_uid"])
    caldav_event_url = f"{base_url}/{username}/{calendar_id}/{event_uid}.ics"

    # Parse and format times
    start_dt = dt.datetime.fromisoformat(str(task["start_time"]))
    end_dt = dt.datetime.fromisoformat(str(task["end_time"]))
    now = dt.datetime.now(dt.timezone.utc)

    ical_event = "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        "PRODID:-//ProSweet Planner//EN",
        "BEGIN:VEVENT",
        f"UID:{event_uid}",
        f"DTSTAMP:{to_ical_time(now)}",
        f"SUMMARY:{task['name']}",
        f"DESCRIPTION:{task['summary']}",
        f"DTSTART:{to_ical_time(start_dt)}",
        f"DTEND:{to_ical_time(end_dt)}",
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
        "END:VEVENT",
        "END:VCALENDAR",
        ""
    ])

    headers = {
        "Content-Type": "text/calendar",
        "Authorization": "Basic " + base64.b64encode(f"{username}:{password}".encode()).decode(),
    }

    print(f"📝 Updating event: {event_uid}")
    print(f"➡️  URL: {caldav_event_url}")

    try:
        # Get current ETag (required for updates)
        head = requests.head(caldav_event_url, auth=(username, password), timeout=10)
        if head.status_code != 200:
            print(f"⚠️  Event not found or inaccessible: {head.status_code}")
            return False

        etag = head.headers.get("ETag")
        if not etag:
            print("⚠️  No ETag found — cannot safely update event.")
            return False

        headers["If-Match"] = etag  # ensures safe overwrite
        response = requests.put(
            caldav_event_url,
            headers=headers,
            data=ical_event.encode("utf-8"),
            timeout=10,
        )

        if response.status_code in (200, 204):
            print("✅ Event successfully updated!")
            return True
        else:
            print(f"❌ Update failed: {response.status_code} {response.reason}")
            print("Response text:", response.text)
            return False

    except requests.exceptions.RequestException as e:
        print(f"❌ Network error during update: {e}")
        return False 


def delete_task(username: str, password: str, calendar_id: str, event_uid: str) -> dict:
    """Creates and uploads a calendar event to the Radicale server."""

    calendar_item: dict = {
        "username": username,
        "password": password,
        "calendar_id": calendar_id,
        "event_uid": event_uid,
    }

    remove_task(calendar_item)
    return calendar_item

def remove_task(task: dict):
    username = task["username"]
    password = task["password"]
    calendar_id = task["calendar_id"]
    event_uid = str(task["event_uid"])
    caldav_event_url = f"{base_url}/{username}/{calendar_id}/{event_uid}.ics"
    caldav_event_url = f"{base_url}/{username}/{calendar_id}/{event_uid}.ics"

    print(f"Attempting to delete: {caldav_event_url}")
    response = requests.delete(caldav_event_url, auth=(username, password))

    if response.status_code in (200, 204):
        print("Event deleted successfully.")
        return True
    elif response.status_code == 404:
        print("Event not found — check UID or calendar ID.")
        return False
    elif response.status_code == 401:
        print("Unauthorized — check your credentials.")
        return False
    else:
        print(f"Error {response.status_code}: {response.reason}")
        print("Response content:", response.text)
        return False

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
        
        print_result(result, func.name)

    else:
        print(part.text)

# 🚀 4️⃣ Main runtime logic
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
        print_calendar_events(username, password, calendar_id)
        ask_gemini(username, password, calendar_id, model)

        choice = str(input("Continue? (y/n): "))
        if (choice == "n"):
            print_calendar_events(username, password, calendar_id)
            break