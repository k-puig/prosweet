import os
import json
import google.generativeai as genai

events = [
    {
        "title": "Team Standup",
        "start": "2025-10-25T09:00:00",
        "end": "2025-10-25T09:30:00",
        "location": "Zoom",
        "description": "Daily team sync"
    },
    {
        "title": "Lunch with Sarah",
        "start": "2025-10-25T12:00:00",
        "end": "2025-10-25T13:00:00",
        "location": "Cafe 101",
        "description": "Catch-up lunch"
    },
    {
        "title": "Project Work",
        "start": "2025-10-25T14:00:00",
        "end": "2025-10-25T17:00:00",
        "location": "Office",
        "description": "Work on the calendar app"
    }
]

genai.configure(api_key="AIzaSyABMW-LywTlbg5x-tHMY6XeqaTXktNSYtQ")

# Initialize the Gemini model
model = genai.GenerativeModel("gemini-2.5-flash")

events_json = json.dumps(events, indent=2)

# User query
user_prompt = """
Given the following calendar, please find a time tomorrow to go to the gym for one hour.
Return only a JSON object of new events following the schema.
"""

prompt = f"Current calendar:\n{events_json}\n\n{user_prompt}"

# Generate structured output
response = model.generate_content(
    prompt,
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        response_schema={
            "type": "object",
            "properties": {
                "new_events": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "start": {"type": "string"},
                            "end": {"type": "string"},
                            "location": {"type": "string"},
                            "description": {"type": "string"},
                        },
                        "required": ["title", "start", "end"]
                    }
                }
            }
        }
    ),
)

# Parse response
result = json.loads(response.text)
print(json.dumps(result, indent=2))
