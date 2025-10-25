from google.adk.agents.llm_agent import Agent
import datetime
import requests



def create_task(name: str, summary: str, start_time: datetime.date, end_time: datetime.date) -> dict:
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
    caldav_endpont = "https://caldavserver.com/caldav/"

    headers = {
        'Content-Type': 'text/calendar',
        'Authorization': 'Basic ' + 'base64encoded_credentials'
    }
    request = requests.post(endpoint, )

root_agent = Agent(
    model='gemini-2.5-flash',
    name='pro sweet plannel',
    description="Plans Schedules",
    instruction="You are a helpful assistant that observes the users already proposed schedule and some other info and plans out the best way for the user to integrate this into their day",
    tools=[create_task],
)
