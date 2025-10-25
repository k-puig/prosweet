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

DELETE

```
curl -X DELETE "http://localhost:3001/events/${UID}
```
