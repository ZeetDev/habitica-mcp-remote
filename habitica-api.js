// habitica-api.js — Lightweight Habitica REST API wrapper

const BASE_URL = "https://habitica.com/api/v3";

const USER_ID = process.env.HABITICA_USER_ID;
const API_TOKEN = process.env.HABITICA_API_TOKEN;

if (!USER_ID || !API_TOKEN) {
  console.error("❌ Missing HABITICA_USER_ID or HABITICA_API_TOKEN env vars");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "x-api-user": USER_ID,
  "x-api-key": API_TOKEN,
  "x-client": `${USER_ID}-habitica-mcp-remote`,
};

async function request(method, path, body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || `Habitica API error: ${res.status}`);
  }
  return json.data;
}

// ── Tasks ────────────────────────────────────────────────

export async function listTasks(type = null) {
  const query = type ? `?type=${type}` : "";
  return request("GET", `/tasks/user${query}`);
}

export async function getTask(taskId) {
  return request("GET", `/tasks/${taskId}`);
}

export async function createTask(taskData) {
  return request("POST", "/tasks/user", taskData);
}

export async function updateTask(taskId, updates) {
  return request("PUT", `/tasks/${taskId}`, updates);
}

export async function deleteTask(taskId) {
  return request("DELETE", `/tasks/${taskId}`);
}

export async function scoreTask(taskId, direction = "up") {
  return request("POST", `/tasks/${taskId}/score/${direction}`);
}

// ── Checklist ────────────────────────────────────────────

export async function addChecklistItem(taskId, text) {
  return request("POST", `/tasks/${taskId}/checklist`, { text });
}

export async function scoreChecklistItem(taskId, itemId) {
  return request("POST", `/tasks/${taskId}/checklist/${itemId}/score`);
}

export async function deleteChecklistItem(taskId, itemId) {
  return request("DELETE", `/tasks/${taskId}/checklist/${itemId}`);
}

// ── Tags ─────────────────────────────────────────────────

export async function listTags() {
  return request("GET", "/tags");
}

export async function createTag(name) {
  return request("POST", "/tags", { name });
}

export async function deleteTag(tagId) {
  return request("DELETE", `/tags/${tagId}`);
}

// ── User / Stats ─────────────────────────────────────────

export async function getUserProfile() {
  const data = await request("GET", "/user?userFields=stats,profile,items.pets,items.mounts,preferences");
  const { stats, profile, preferences } = data;
  return {
    name: profile?.name,
    class: stats?.class,
    level: stats?.lvl,
    hp: `${Math.round(stats?.hp)}/${stats?.maxHealth}`,
    mp: `${Math.round(stats?.mp)}/${stats?.maxMP}`,
    exp: `${Math.round(stats?.exp)}/${stats?.toNextLevel}`,
    gold: Math.round(stats?.gp),
    gems: data?.balance ? data.balance * 4 : 0,
    dayStart: preferences?.dayStart,
  };
}

export async function getUserStats() {
  const data = await request("GET", "/user?userFields=stats");
  return data.stats;
}
