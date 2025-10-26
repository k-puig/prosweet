import { getClient } from "./caldav";

// ---- Types ----
export type CreateTaskInput = {
  summary: string;
  due?: string; // ISO (optional)
  description?: string;
  location?: string;
  uid?: string;
  // Optional VALARM(s) — same shape you used for events
  alarms?: Array<
    | { action: "DISPLAY"; trigger: string; description?: string }
    | { action: "AUDIO"; trigger: string }
    | { action: "EMAIL"; trigger: string; summary?: string; description?: string; attendees?: string[] }
  >;
  // You can extend with priority/status/categories etc. if ts-caldav supports them.
};

export type ListTasksOptions = {
  all?: boolean;          // if true, fetch all tasks
  dueStart?: string;      // ISO: include tasks due >= dueStart
  dueEnd?: string;        // ISO: include tasks due <= dueEnd
  completed?: boolean;    // filter by completion status (best-effort)
};

// ---- Utilities ----

// Pick a collection that supports VTODO if possible; else fallback to first calendar.
async function resolveTaskCollectionUrl(client: any, authHeader: string): Promise<string> {
  const calendars = await client.getCalendars?.();
  if (Array.isArray(calendars) && calendars.length) {
    const withVtodo = calendars.find((c: any) =>
      Array.isArray(c.components) && c.components.includes("VTODO")
    );

    if (withVtodo?.url) return ensureTrailingSlash(withVtodo.url);

    // Heuristic: look for a tasks-like name/path
    const tasksLike = calendars.find((c: any) =>
      /tasks?/i.test(c.displayName ?? "") || /\/tasks\/?$/i.test(c.url ?? "")
    );
    if (tasksLike?.url) return ensureTrailingSlash(tasksLike.url);

    // Fallback to first
    return ensureTrailingSlash(calendars[0].url);
  }

  // As a last resort, derive from username like http://host:5232/<user>/tasks/
  const { username } = parseBasicFromHeader(authHeader);
  return ensureTrailingSlash(`${CALDAV_ROOT.replace(/\/+$/, "")}/${encodeURIComponent(username)}/tasks/`);
}

// Simple helpers (reuse your existing ones if present)
function ensureTrailingSlash(u: string) {
  return u.endsWith("/") ? u : u + "/";
}
function parseBasicFromHeader(auth: string) {
  const [, b64] = auth.split(" ");
  const [username, password] = Buffer.from(b64, "base64").toString("utf8").split(":");
  return { username, password };
}

// ---- CREATE ----
export async function createTask(auth: string, input: CreateTaskInput) {
  const client = await getClient(auth) as any; // CalDAVClient (runtime)
  const taskCollectionUrl = await resolveTaskCollectionUrl(client, auth);

  const { summary, due, description, location, uid, alarms } = input;

  const created = await client.createTodo(taskCollectionUrl, {
    summary,
    description,
    location,
    uid,
    // ts-caldav accepts Date for due (if not, pass string directly)
    ...(due ? { due: new Date(due) } : {}),
    alarms,
  });

  return created; // typically includes href/etag/uid
}

// ---- LIST ----
export async function getTasks(auth: string, opts: ListTasksOptions = {}) {
  const client = await getClient(auth) as any;
  const taskCollectionUrl = await resolveTaskCollectionUrl(client, auth);

  // Best-effort: ask ts-caldav first. If its getTodos supports range, great; if not, filter after.
  let tasks: any[];
  try {
    // Some builds support a shape like { all: true } or date ranges by DUE
    if (opts.all) {
      tasks = await client.getTodos(taskCollectionUrl, { all: true });
    } else if (opts.dueStart || opts.dueEnd) {
      // If the client supports a range object keyed by due, pass it; otherwise fetch all and filter.
      const range: any = {};
      if (opts.dueStart) range.start = new Date(opts.dueStart);
      if (opts.dueEnd) range.end = new Date(opts.dueEnd);

      try {
        tasks = await client.getTodos(taskCollectionUrl, range);
      } catch {
        // fallback to all + filter below
        tasks = await client.getTodos(taskCollectionUrl, { all: true });
      }
    } else {
      // default to all (tasks are usually fewer than events)
      tasks = await client.getTodos(taskCollectionUrl, { all: true });
    }
  } catch (e) {
    // If getTodos doesn’t exist, try generic getEvents with VTODO filter—not all clients expose it.
    if (typeof client.getTodos !== "function") {
      // As a last resort, use events and then filter to VTODO-shaped objects (depends on ts-caldav internals)
      const all = await client.getEvents(taskCollectionUrl, { all: true });
      tasks = (all ?? []).filter((x: any) => (x?.component === "VTODO") || /BEGIN:VTODO/i.test(x?.ical ?? ""));
    } else {
      throw e;
    }
  }

  // In-process filtering by due/completed if needed
  const dueStartMs = opts.dueStart ? new Date(opts.dueStart).getTime() : undefined;
  const dueEndMs = opts.dueEnd ? new Date(opts.dueEnd).getTime() : undefined;

  const filtered = tasks.filter((t: any) => {
    let ok = true;

    if (opts.completed === true) {
      ok = ok && (t?.status === "COMPLETED" || !!t?.completed);
    } else if (opts.completed === false) {
      ok = ok && !(t?.status === "COMPLETED" || !!t?.completed);
    }

    if (dueStartMs || dueEndMs) {
      const dueVal: Date | string | undefined = t?.due ?? t?.dtDue ?? t?.dueDate;
      const dueMs = dueVal ? new Date(dueVal as any).getTime() : NaN;
      if (dueStartMs && !(dueMs >= dueStartMs)) ok = false;
      if (dueEndMs && !(dueMs <= dueEndMs)) ok = false;
    }

    return ok;
  });

  return filtered;
}

// ---- DELETE ----
export async function deleteTask(auth: string, uidOrHref: string, etag?: string) {
  const client = await getClient(auth) as any;
  const taskCollectionUrl = await resolveTaskCollectionUrl(client, auth);

  // Allow passing a full href or just a UID
  const href = uidOrHref.endsWith(".ics") ? uidOrHref : `${ensureTrailingSlash(taskCollectionUrl)}${uidOrHref}.ics`;
  const uid = href.split("/").pop()!.replace(/\.ics$/i, "");

  // Prefer library delete by UID when available
  try {
    if (typeof client.deleteTodo === "function") {
      const res = await client.deleteTodo(taskCollectionUrl, uid, etag);
      return { ok: true, status: 204, result: res };
    }

    // Fallback to direct DELETE by href
    const res = await fetch(href, {
      method: "DELETE",
      headers: {
        ...(etag ? { "If-Match": etag } : {}),
        // Add Authorization header derived from auth string
        Authorization: (auth || ""),
      },
    });

    if (res.status === 200 || res.status === 204) {
      return { ok: true, status: res.status };
    }
    if (res.status === 404) {
      return { ok: false, status: 404, error: "Task not found" };
    }

    const text = await res.text().catch(() => "");
    throw new Error(`DELETE ${href} failed: ${res.status} ${res.statusText} ${text}`);
  } catch (e: any) {
    // Normalize success-on-200 quirk
    const status = (e?.response?.status ?? e?.status) as number | undefined;
    if (status === 200 || status === 204) return { ok: true, status };

    // Verify by listing (best-effort)
    try {
      const tasks = await getTasks(auth, { all: true });
      const stillThere = tasks.some((t: any) => t?.uid === uid || (t?.href && t.href.endsWith(`/${uid}.ics`)));
      if (!stillThere) return { ok: true, status: 204, note: "Verified deletion by absence" };
    } catch { /* ignore verification failure */ }

    throw e;
  }
}

