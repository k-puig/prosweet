from google.adk.agents.llm_agent import Agent
import google.generativeai as genai
import datetime
import requests
import base64
import json
import uuid
import getpass


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

def print_result(result):
    if hasattr(part, "function_call") and part.function_call:
        func = part.function_call
        if func.name == "create_task":
            result = create_task(**func.args)

            # 🧾 Pretty-print the task result
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

        else:
            print(f"⚠️ Unknown function call: {func.name}")

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

    today = datetime.date.today().isoformat()

    genai.configure(api_key="AIzaSyABMW-LywTlbg5x-tHMY6XeqaTXktNSYtQ")

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        tools=[{"function_declarations": [create_task_schema]}]
    )

    # Schedule a yoga session tomorrow morning from 7:00 to 8:00 AM.
    user_prompt = str(input("User prompt: ")) 

    prompt = (
        "You are a scheduling AI. "
        f"Today's date is {today}. "
        f"The user's Radicale username is '{username}', password is '{password}', "
        f"and their calendar ID is '{calendar_id}'. "
        "All date/time values must be ISO 8601 formatted strings (YYYY-MM-DDTHH:MM:SS). "
        "When the user asks to add or schedule something, respond by calling the `create_task` function "
        "with the proper arguments including credentials.\n\n"
        f"User prompt: '{user_prompt}'"
    )

    response = model.generate_content([prompt])

    part = response.candidates[0].content.parts[0]

    if hasattr(part, "function_call") and part.function_call:
        func = part.function_call
        if func.name == "create_task":
            result = create_task(**func.args)
            print_result(result)
    else:
        print(part.text)