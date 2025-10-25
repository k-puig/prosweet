from google.adk.agents.llm_agent import Agent
import google.generativeai as genai
import datetime
import requests
import base64
import json
import getpass


# 🧩 1️⃣ create_task — now accepts credentials dynamically
def create_task(uid: int, name: str, summary: str, start_time: str, end_time: str,
                username: str, password: str, calendar_id: str) -> dict:
    """Creates and uploads a calendar event to the Radicale server."""

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


# ⚙️ 2️⃣ add_task — uses dynamic credentials from task dict
def add_task(task: dict):
    """
    Uploads (or updates) a task to the CalDAV server (Radicale) as an iCalendar event (.ics file).
    Automatically handles missing collections and proper CalDAV headers.
    """

    username = task["username"]
    password = task["password"]
    calendar_id = task["calendar_id"]
    base_url = "http://localhost:5232"
    event_uid = str(task["uid"])
    caldav_event_url = f"{base_url}/{username}/{calendar_id}/{event_uid}.ics"

    start_dt = datetime.datetime.fromisoformat(str(task["start_time"]))
    end_dt = datetime.datetime.fromisoformat(str(task["end_time"]))
    now = datetime.datetime.now(datetime.timezone.utc)

    def to_ical_time(dt: datetime.datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.strftime("%Y%m%dT%H%M%SZ")

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
        "If-None-Match": "*",
    }

    print(f"➡️ Uploading event to: {caldav_event_url}")
    response = requests.put(caldav_event_url, headers=headers, data=ical_event.encode("utf-8"), timeout=10)

    # Retry as update if already exists
    if response.status_code == 412:
        print("ℹ️ Event already exists, updating instead...")
        head = requests.head(caldav_event_url, auth=(username, password))
        etag = head.headers.get("ETag", None)
        if etag:
            headers.pop("If-None-Match", None)
            headers["If-Match"] = etag
            response = requests.put(caldav_event_url, headers=headers, data=ical_event.encode("utf-8"), timeout=10)

    if response.status_code in (200, 201, 204):
        print("✅ Task successfully added or updated on CalDAV server!")
        return True
    else:
        print(f"❌ Failed to add task: {response.status_code} {response.reason}")
        print("Response text:", response.text)
        return False


# 🧠 3️⃣ Function schema for AI
create_task_schema = {
    "name": "create_task",
    "description": "Creates a calendar task in the user's Radicale calendar.",
    "parameters": {
        "type": "object",
        "properties": {
            "uid": {"type": "integer"},
            "name": {"type": "string"},
            "summary": {"type": "string"},
            "start_time": {"type": "string"},
            "end_time": {"type": "string"},
            "username": {"type": "string"},
            "password": {"type": "string"},
            "calendar_id": {"type": "string"},
        },
        "required": ["uid", "name", "summary", "start_time", "end_time", "username", "password", "calendar_id"],
    },
}


# 🚀 4️⃣ Main runtime logic
if __name__ == "__main__":
    # User enters credentials interactively
    #print("🔐 Please enter your Radicale credentials:")
    #username = input("Username: ")
    #password = getpass.getpass("Password: ")
    #calendar_id = input("Calendar ID (from web UI): ")

    username = "admin"
    password = "mypassword"
    calendar_id = "aa5e311e-00e3-5874-0b59-e4cb9e1dfd32" 

    today = datetime.date.today().isoformat()

    genai.configure(api_key="AIzaSyABMW-LywTlbg5x-tHMY6XeqaTXktNSYtQ")

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        tools=[{"function_declarations": [create_task_schema]}]
    )

    prompt = (
        "You are a scheduling AI. "
        f"Today's date is {today}. "
        f"The user's Radicale username is '{username}', password is '{password}', "
        f"and their calendar ID is '{calendar_id}'. "
        "All date/time values must be ISO 8601 formatted strings (YYYY-MM-DDTHH:MM:SS). "
        "When the user asks to add or schedule something, respond by calling the `create_task` function "
        "with the proper arguments including credentials.\n\n"
        "User: Schedule a yoga session tomorrow morning from 7:00 to 8:00 AM. "
        "My user ID is 1."
    )

    response = model.generate_content([prompt])

    if response.candidates[0].content.parts[0].function_call:
        func = response.candidates[0].content.parts[0].function_call
        if func.name == "create_task":
            result = create_task(**func.args)
            print(result)
    else:
        print(response.candidates[0].content.parts[0].text)