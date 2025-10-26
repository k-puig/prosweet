from google.adk.agents.llm_agent import Agent
import google.generativeai as genai
import datetime as dt
import requests
import base64
import json
from icalendar import Calendar, Event
from requests.auth import HTTPBasicAuth

from test.alarm_agent import *
from test.event_agent import *

    
# END OF TASKS__________________________________
    
username = "test"
password = "test"

existing_events = get_all_calendar_items(username, password)

formatted_events = json.dumps(existing_events, indent=2) if existing_events else "[]"
today = dt.date.today().isoformat()

user_prompt = str(input("User prompt: "))

event_agent = Agent(
    model='gemini-2.5-flash',
    name='pro_sweet_plannel',
    description="Plans Schedules",
    instruction="You are a scheduling AI that manages events in a Radicale CalDAV server.\n"
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
    tools=[create_event_schema, update_event_schema, delete_event_schema],
    output_key="events_results"
)

alarm_agent = Agent(
    model='gemini-2.5-flash',
    name='pro_sweet_plannel',
    description="Plans Schedules",
    instruction=(
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
    tools=[create_alarm_schema, update_alarm_schema, delete_alarm_schema],
    output_key="alarm_results"
)