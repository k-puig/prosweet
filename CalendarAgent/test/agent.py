from google.adk.agents.llm_agent import Agent
import google.generativeai as genai
import datetime
import requests
import base64
import json


def create_task(uid: int, name: str, summary: str, start_time: datetime.date, end_time: datetime.date) -> dict:
    """Creates a new calendar item for the user"""
    calendar_item: dict = {
        "uid": uid,
        "name": name, 
        "summary": summary, 
        "start_time": start_time.isoformat() if isinstance(start_time, datetime.date) else str(start_time),
        "end_time": end_time.isoformat() if isinstance(end_time, datetime.date) else str(end_time)
    }
    add_task(calendar_item)
    return calendar_item

def add_task(task: dict):
    caldav_endpoint = "https://caldavserver.com/caldav/"

    headers = {
        'Content-Type': 'text/calendar',
        'Authorization': 'Basic ' + 'base64encoded_credentials'
    }

    try:
        response = requests.post(
            caldav_endpoint,
            headers=headers,
            data=json.dumps(task),
            timeout=10
        )
        response.raise_for_status()
        print("Task successfully added to CalDAV server!")
    except requests.exceptions.RequestException as e:
        print(f"Failed to add task: {e}")

"""root_agent = Agent(
    model='gemini-2.5-flash',
    name='pro_sweet_plannel',
    description="Plans Schedules",
    #instruction="You are a helpful assistant that observes the users already proposed schedule and some other info and plans out the best way for the user to integrate this into their day",
    instruction=(
        "You are a scheduling AI. "
        "When the user provides a task, output ONLY a Python dictionary definition named `calendar_item` "
        "that matches this format exactly:\n\n"
        "calendar_item: dict = {\n"
        '    "uid": uid,\n'
        '    "name": name,\n'
        '    "summary": summary,\n'
        '    "start_time": start_time,\n'
        '    "end_time": end_time\n'
        "}\n\n"
        "Replace the variable values appropriately for the user’s request, "
        "using ISO 8601 formatted timestamps for times, and unique integer `uid`s. "
        "Do not add any commentary or explanation — output only the dictionary."
    ),
    tools=[create_task],
)"""

create_task_schema = {
    "name": "create_task",
    "description": "Creates a calendar task in the user's schedule.",
    "parameters": {
        "type": "object",
        "properties": {
            "uid": {"type": "integer"},
            "name": {"type": "string"},
            "summary": {"type": "string"},
            "start_time": {"type": "string"},
            "end_time": {"type": "string"}
        },
        "required": ["uid", "name", "summary", "start_time", "end_time"]
    }
}

if __name__ == "__main__":
    genai.configure(api_key="AIzaSyABMW-LywTlbg5x-tHMY6XeqaTXktNSYtQ")

    # Initialize the Gemini model
    #model = genai.GenerativeModel("gemini-2.5-flash")
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        tools=[{"function_declarations": [create_task_schema]}]
    )
    
    prompt = (
        "You are a scheduling AI. "
        "If the user asks to add or schedule something, "
        "respond by calling the `create_task` function with appropriate arguments."
        "\nUser: Schedule a yoga session tomorrow morning from 7:00 to 8:00 AM."
    )

    response = model.generate_content([prompt])

    if response.candidates[0].content.parts[0].function_call:
        func = response.candidates[0].content.parts[0].function_call
        if func.name == "create_task":
            result = create_task(**func.args)
            print(result)