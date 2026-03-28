// server.js — Remote Habitica MCP Server
// Supports both Streamable HTTP (/mcp) and SSE (/sse) transports

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { z } from "zod";

import * as habitica from "./habitica-api.js";

// ── Express app ──────────────────────────────────────────

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "mcp-session-id", "Accept"],
  exposedHeaders: ["mcp-session-id"],
}));

app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    server: "habitica-mcp-remote",
    message: "Habitica MCP Server is running. Connect via /mcp or /sse endpoint.",
  });
});

// ── MCP Server factory ──────────────────────────────────

function createMcpServer() {
  const server = new McpServer({
    name: "habitica-mcp-remote",
    version: "1.0.0",
  });

  // ─── Tool: list_tasks ───────────────────────────────

  server.tool(
    "list_tasks",
    "List all Habitica tasks. Optionally filter by type: habits, dailys, todos, rewards.",
    { type: z.enum(["habits", "dailys", "todos", "rewards"]).optional().describe("Task type to filter") },
    async ({ type }) => {
      try {
        const tasks = await habitica.listTasks(type);
        const summary = tasks.map((t) => ({
          id: t.id,
          text: t.text,
          type: t.type,
          completed: t.completed ?? null,
          isDue: t.isDue ?? null,
          streak: t.streak ?? null,
          notes: t.notes || null,
          checklist: t.checklist?.length ? t.checklist.map((c) => ({ id: c.id, text: c.text, completed: c.completed })) : null,
          tags: t.tags || [],
        }));
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ─── Tool: create_task ──────────────────────────────

  server.tool(
    "create_task",
    "Create a new Habitica task (habit, daily, todo, or reward).",
    {
      text: z.string().describe("Task title"),
      type: z.enum(["habit", "daily", "todo", "reward"]).describe("Task type"),
      notes: z.string().optional().describe("Additional notes"),
      priority: z.enum(["0.1", "1", "1.5", "2"]).optional().describe("Difficulty: 0.1=trivial, 1=easy, 1.5=medium, 2=hard"),
      tags: z.array(z.string()).optional().describe("Array of tag IDs"),
      checklist: z.array(z.string()).optional().describe("Checklist items (text strings) to add"),
    },
    async ({ text, type, notes, priority, tags, checklist }) => {
      try {
        const taskData = { text, type };
        if (notes) taskData.notes = notes;
        if (priority) taskData.priority = parseFloat(priority);
        if (tags) taskData.tags = tags;

        const task = await habitica.createTask(taskData);

        if (checklist?.length) {
          for (const item of checklist) {
            await habitica.addChecklistItem(task.id, item);
          }
        }

        return { content: [{ type: "text", text: `Created ${type}: "${text}" (ID: ${task.id})` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ─── Tool: update_task ──────────────────────────────

  server.tool(
    "update_task",
    "Update an existing Habitica task's text, notes, priority, or other fields.",
    {
      taskId: z.string().describe("Task ID to update"),
      text: z.string().optional().describe("New task title"),
      notes: z.string().optional().describe("New notes"),
      priority: z.enum(["0.1", "1", "1.5", "2"]).optional().describe("New difficulty"),
    },
    async ({ taskId, text, notes, priority }) => {
      try {
        const updates = {};
        if (text) updates.text = text;
        if (notes) updates.notes = notes;
        if (priority) updates.priority = parseFloat(priority);

        const task = await habitica.updateTask(taskId, updates);
        return { content: [{ type: "text", text: `Updated task: "${task.text}"` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ─── Tool: delete_task ──────────────────────────────

  server.tool(
    "delete_task",
    "Permanently delete a Habitica task by its ID.",
    { taskId: z.string().describe("Task ID to delete") },
    async ({ taskId }) => {
      try {
        await habitica.deleteTask(taskId);
        return { content: [{ type: "text", text: `Task deleted successfully.` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ─── Tool: score_task ───────────────────────────────

  server.tool(
    "score_task",
    "Score a task up (complete/positive) or down (undo/negative). For habits use up/down, for dailys and todos use up to complete.",
    {
      taskId: z.string().describe("Task ID to score"),
      direction: z.enum(["up", "down"]).describe("Score direction: up = complete/positive, down = undo/negative"),
    },
    async ({ taskId, direction }) => {
      try {
        const result = await habitica.scoreTask(taskId, direction);
        return {
          content: [{
            type: "text",
            text: `Task scored ${direction}! HP: ${Math.round(result.hp)}, EXP: ${Math.round(result.exp)}, Gold: ${Math.round(result.gp)}`,
          }],
        };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ─── Tool: add_checklist_item ───────────────────────

  server.tool(
    "add_checklist_item",
    "Add a checklist item to an existing task.",
    {
      taskId: z.string().describe("Task ID"),
      text: z.string().describe("Checklist item text"),
    },
    async ({ taskId, text }) => {
      try {
        await habitica.addChecklistItem(taskId, text);
        return { content: [{ type: "text", text: `Added checklist item: "${text}"` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ─── Tool: score_checklist_item ─────────────────────

  server.tool(
    "score_checklist_item",
    "Toggle a checklist item as complete/incomplete.",
    {
      taskId: z.string().describe("Task ID"),
      itemId: z.string().describe("Checklist item ID"),
    },
    async ({ taskId, itemId }) => {
      try {
        await habitica.scoreChecklistItem(taskId, itemId);
        return { content: [{ type: "text", text: `Checklist item toggled.` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ─── Tool: list_tags ───────────────────────────────

  server.tool(
    "list_tags",
    "List all Habitica tags for organizing tasks.",
    {},
    async () => {
      try {
        const tags = await habitica.listTags();
        const summary = tags.map((t) => ({ id: t.id, name: t.name }));
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ─── Tool: create_tag ──────────────────────────────

  server.tool(
    "create_tag",
    "Create a new tag in Habitica.",
    { name: z.string().describe("Tag name") },
    async ({ name }) => {
      try {
        const tag = await habitica.createTag(name);
        return { content: [{ type: "text", text: `Created tag: "${name}" (ID: ${tag.id})` }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  // ─── Tool: get_profile ─────────────────────────────

  server.tool(
    "get_profile",
    "Get the Habitica user profile with stats (level, HP, MP, EXP, gold, class).",
    {},
    async () => {
      try {
        const profile = await habitica.getUserProfile();
        return { content: [{ type: "text", text: JSON.stringify(profile, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }
  );

  return server;
}

// ══════════════════════════════════════════════════════════
// TRANSPORT 1: Streamable HTTP (/mcp) — preferred by claude.ai
// ══════════════════════════════════════════════════════════

const httpTransports = {};

app.post("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"];

    // Existing session
    if (sessionId && httpTransports[sessionId]) {
      const transport = httpTransports[sessionId];
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const server = createMcpServer();

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && httpTransports[sid]) {
        delete httpTransports[sid];
      }
      server.close();
    };

    await server.connect(transport);

    httpTransports[transport.sessionId] = transport;

    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("POST /mcp error:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !httpTransports[sessionId]) {
    res.status(400).json({ error: "No active session. Send an initialize request first via POST /mcp" });
    return;
  }
  try {
    const transport = httpTransports[sessionId];
    await transport.handleRequest(req, res);
  } catch (e) {
    console.error("GET /mcp error:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId && httpTransports[sessionId]) {
    try {
      const transport = httpTransports[sessionId];
      await transport.close();
      delete httpTransports[sessionId];
    } catch (e) {
      console.error("DELETE /mcp error:", e);
    }
  }
  res.status(200).end();
});

// ══════════════════════════════════════════════════════════
// TRANSPORT 2: SSE (/sse) — legacy fallback
// ══════════════════════════════════════════════════════════

const sseTransports = {};

app.get("/sse", async (req, res) => {
  console.log("SSE connection opened");

  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  sseTransports[sessionId] = transport;

  const server = createMcpServer();

  res.on("close", () => {
    console.log(`SSE connection closed: ${sessionId}`);
    delete sseTransports[sessionId];
    server.close();
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = sseTransports[sessionId];

  if (!transport) {
    return res.status(400).json({ error: "No active SSE session" });
  }

  await transport.handlePostMessage(req, res);
});

// ── Start ────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
🎮 Habitica MCP Server running!
   Health:     http://localhost:${PORT}/
   HTTP (new): http://localhost:${PORT}/mcp
   SSE (old):  http://localhost:${PORT}/sse
   Ready for claude.ai custom connector
  `);
});
