require('dotenv').config();

const storageValidator = require("./storageValidator");
const { loadBoardData } = require("./boardLoader");
const express = require('express');
const fs = require('fs').promises;
const http = require("http");
const { Server } = require("socket.io");
const path = require('path');
const cookieParser = require('cookie-parser');

// Validate data location and default data JSON file
async function initializeStorage() {
  // Ensure read‐access to data/defaultData.json
  try {
    await validateStorageRead();
    console.log("✅ Read check passed: data/defaultData.json is present & readable.");
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // Ensure write‐access (e.g., can create temp files in data/)
  try {
    await validateStorageWrite();
    console.log("✅ Write check passed: can create temp files in data/.");
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(cookieParser());

// ──────────────────────────────────────────────────────────────────────────────
// Brute‐force protection (login attempts) – exists already in your code
// ──────────────────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in ms
const loginAttempts = new Map();

function resetAttempts(ip) {
  loginAttempts.delete(ip);
}

function isLockedOut(ip) {
  const attempts = loginAttempts.get(ip);
  if (!attempts) return false;
  if (Date.now() - attempts.lastAttempt >= LOCKOUT_TIME) {
    resetAttempts(ip);
    return false;
  }
  return attempts.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip) {
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  loginAttempts.set(ip, attempts);
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of loginAttempts.entries()) {
    if (now - attempts.lastAttempt >= LOCKOUT_TIME) {
      loginAttempts.delete(ip);
    }
  }
}, LOCKOUT_TIME);

// ──────────────────────────────────────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────────────────────────────────────

// Root route: if no default board in cookie or ENV, serve join‐or‐create page
app.get('/', (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'join-or-create.html'));
});

// ──────────────────────────────────────────────────────────────────────────────
// API: GET /api/board/:boardName
//   • Loads (and, if missing, initializes) data/<boardName>.json
//   • Returns that JSON to the client
// ──────────────────────────────────────────────────────────────────────────────
app.get("/api/board/:boardName", async (req, res) => {
  const boardName = req.params.boardName;

  // Reject invalid boardName
  if (!/^[a-zA-Z0-9]+$/.test(boardName)) {
    return res.status(400).json({ error: "Invalid board name (only alphanumeric allowed)." });
  }

  try {
    const boardData = await loadBoardData(boardName);
    return res.json(boardData);
  } catch (err) {
    console.error(`Error in GET /api/board/${boardName}:`, err);
    return res.status(500).json({ error: "Failed to load or initialize board." });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// API: PUT /api/board/:boardName
//   • Receives updated board JSON in req.body
//   • Overwrites data/<boardName>.json with new contents
//   • Emits "boardUpdated" via Socket.IO
// ──────────────────────────────────────────────────────────────────────────────
app.put("/api/board/:boardName", async (req, res) => {
  const boardName = req.params.boardName;
  const newData   = req.body;

  if (!/^[a-zA-Z0-9]+$/.test(boardName)) {
    return res.status(400).json({ error: "Invalid board name." });
  }

  const boardFile = path.join(__dirname, "data", `${boardName}.json`);
  try {
    // Ensure the file exists and is writable
    await fs.access(boardFile, fs.constants.W_OK);
  } catch {
    return res.status(404).json({ error: "Board does not exist." });
  }

  try {
    // Write the updated JSON to disk
    await fs.writeFile(boardFile, JSON.stringify(newData, null, 2), "utf8");

    // Emit real‐time update to all connected clients
    console.log(`[socket] emitting boardUpdated for ${boardName}`);
    io.emit("boardUpdated", { boardId: boardName, boardData: newData });

    return res.json({ status: "ok" });
  } catch (err) {
    console.error(`Error writing ${boardFile}:`, err);
    return res.status(500).json({ error: "Failed to save board." });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// API: DELETE /api/board/:boardName
//   • Deletes data/<boardName>.json
//   • Emits "boardDeleted" via Socket.IO
// ──────────────────────────────────────────────────────────────────────────────
app.delete("/api/board/:boardName", async (req, res) => {
  const boardName = req.params.boardName;
  const boardFile = path.join(__dirname, "data", `${boardName}.json`);

  try {
    // Remove the file
    await fs.unlink(boardFile);

    // Emit real‐time deletion event
    console.log(`[socket] emitting boardDeleted for ${boardName}`);
    io.emit("boardDeleted", { boardId: boardName });

    return res.json({ status: "deleted" });
  } catch (err) {
    console.error(`Error deleting ${boardFile}:`, err);
    return res.status(404).json({ error: "Board not found." });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// API: POST /api/board/:boardName
//   • Creates a new board JSON from request body if it doesn’t exist
//   • Emits "boardCreated" via Socket.IO
// ──────────────────────────────────────────────────────────────────────────────
app.post("/api/board/:boardName", async (req, res) => {
  const boardName = req.params.boardName;
  const newBoard  = req.body;

  if (!/^[a-zA-Z0-9]+$/.test(boardName)) {
    return res.status(400).json({ error: "Invalid board name." });
  }

  const boardFile = path.join(__dirname, "data", `${boardName}.json`);

  try {
    // If the file already exists, reject with 409
    await fs.access(boardFile, fs.constants.F_OK);
    return res.status(409).json({ error: "Board already exists." });
  } catch {
    // File does not exist → create it
    try {
      await fs.writeFile(boardFile, JSON.stringify(newBoard, null, 2), "utf8");

      // Emit real‐time creation event
      console.log(`[socket] emitting boardCreated for ${boardName}`);
      io.emit("boardCreated", { boardId: boardName, boardData: newBoard });

      return res.status(201).json({ status: "created" });
    } catch (err) {
      console.error(`Error creating ${boardFile}:`, err);
      return res.status(500).json({ error: "Failed to create board." });
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// API: GET /api/boards
//   • Lists all boards (reads data/*.json except defaultData.json)
// ──────────────────────────────────────────────────────────────────────────────
app.get("/api/boards", async (req, res) => {
  try {
    const files = await fs.readdir(path.join(__dirname, "data"));
    const boardFiles = files.filter(
      (f) => f.endsWith(".json") && f !== "defaultData.json"
    );
    const boardList = await Promise.all(
      boardFiles.map(async (filename) => {
        const id = filename.replace(/\.json$/, "");
        const content = JSON.parse(
          await fs.readFile(path.join(__dirname, "data", filename), "utf8")
        );
        return { id, name: content.name };
      })
    );
    return res.json(boardList);
  } catch (err) {
    console.error("Error listing boards:", err);
    return res.status(500).json({ error: "Failed to list boards." });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// “Catch‐all” for client‐side routing: render board.html for any /:boardName
// ──────────────────────────────────────────────────────────────────────────────
app.get("/:boardName", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "views", "board.html"));
});

// ──────────────────────────────────────────────────────────────────────────────
// Create HTTP server and attach Socket.IO
// ──────────────────────────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*", // allow all origins, adjust in production
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

io.on("connection", (socket) => {
  const ipAddress = socket.handshake.address;
  console.log(`Socket.IO client connected: ${socket.id} from IP: ${ipAddress}` );
});

// ──────────────────────────────────────────────────────────────────────────────
// Start listening on the same HTTP server
// ──────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO listening on http://localhost:${PORT}`);
});
