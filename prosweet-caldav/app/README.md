To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:3001

# some quick tests

GET

CAL (this is obsolete now)
```
curl -X GET -u "test:test" "http://localhost:3001/calendars"
```

EVENTS

```
curl -u test:test -s -G "http://localhost:3001/events?all=true?time="
```

POST

```
curl -X POST "http://localhost:3001/events" \
  -u "test:test" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Radicale test",
    "start": "2025-10-25T14:00:00Z",
    "end":   "2025-10-25T15:00:00Z",
    "description": "Created via Bun + Hono + ts-caldav"
  }'
```

```
curl -u test:test \
  -X POST "http://localhost:3001/events" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Team standup",
    "start": "2025-10-26T14:00:00Z",
    "end":   "2025-10-26T14:15:00Z",
    "alarms": [
      { "action": "DISPLAY", "trigger": "-PT10M", "description": "Starts in 10 minutes" }
    ]
  }'
```

DELETE

```
curl -u test:test -X DELETE "http://localhost:3001/events/${UID}
```
