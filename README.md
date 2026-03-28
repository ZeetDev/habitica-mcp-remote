# 🎮 Habitica MCP Remote Server

A remote MCP (Model Context Protocol) server that connects Claude AI to your Habitica account. Deploy once, use from **any device** on claude.ai.

## What Can You Do?

Talk to Claude naturally and it controls your Habitica:

- "Show me my todos" → Lists all your tasks
- "Create a daily habit for coding React" → Creates the habit
- "Mark my workout as done" → Scores the task
- "Add a checklist item to my project task" → Adds it
- "What's my character stats?" → Shows HP, EXP, Gold, Level

## Available Tools

| Tool | Description |
|------|-------------|
| `list_tasks` | List tasks (filter: habits, dailys, todos, rewards) |
| `create_task` | Create habit/daily/todo/reward with checklist |
| `update_task` | Update task title, notes, difficulty |
| `delete_task` | Delete a task |
| `score_task` | Complete/undo a task (up/down) |
| `add_checklist_item` | Add checklist item to a task |
| `score_checklist_item` | Toggle checklist item completion |
| `list_tags` | List all tags |
| `create_tag` | Create a new tag |
| `get_profile` | Get character stats (level, HP, MP, EXP, gold) |

---

## 🚀 Deploy on Render (Free)

### Step 1: Get Habitica API Credentials

1. Log in to [Habitica](https://habitica.com)
2. Go to **Settings → Site Data** (scroll down to API section)
3. Copy your **User ID** and **API Token**
4. ⚠️ Keep your API Token secret — treat it like a password

### Step 2: Push to GitHub

1. Create a new GitHub repository (e.g., `habitica-mcp-remote`)
2. Push this project to it:

```bash
git init
git add .
git commit -m "Initial commit - Habitica MCP Server"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/habitica-mcp-remote.git
git push -u origin main
```

### Step 3: Deploy on Render

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo
4. Render will auto-detect settings from `render.yaml`, but verify:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Add **Environment Variables:**
   - `HABITICA_USER_ID` → paste your User ID
   - `HABITICA_API_TOKEN` → paste your API Token
6. Click **"Deploy Web Service"**
7. Wait for deployment (2-3 minutes)
8. Copy your URL: `https://habitica-mcp-XXXX.onrender.com`

### Step 4: Connect to Claude

1. Go to [claude.ai](https://claude.ai)
2. Navigate to **Settings → Connectors**
3. Click **"Add custom connector"** (at the bottom)
4. Enter:
   - **Name:** Habitica
   - **URL:** `https://your-render-url.onrender.com/sse`
5. Click **"Add"**
6. Done! 🎉

Now start a new chat and try: "Show me my Habitica tasks"

---

## ⚠️ Important Notes

- **Render Free Tier:** The server sleeps after 15 min of inactivity. First request after sleep takes ~30 seconds to wake up. This is normal.
- **Free Plan Limit:** Claude's free plan allows 1 custom connector. If you already have one, you'll need Pro ($20/mo) for more.
- **Security:** Your Habitica credentials are stored as environment variables on Render — never in code.

## Local Development

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/habitica-mcp-remote.git
cd habitica-mcp-remote
npm install

# Set environment variables
export HABITICA_USER_ID="your-id"
export HABITICA_API_TOKEN="your-token"

# Run
npm start
```

Server starts at `http://localhost:3000/sse`

---

## License

MIT — do whatever you want with it.
