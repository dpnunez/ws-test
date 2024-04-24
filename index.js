const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const sqlite = require("sqlite3");

const PORT = 3002;
const app = express();
const server = http.createServer().listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

// Rest Config
server.on("request", app);
server.on("close", () => {
  console.log("aqui");
});

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});

// Websocket config
const wss = new WebSocket.Server({ server: server });

wss.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

function sendCurrentStats() {
  wss.broadcast(`Current visitors: ${wss.clients.size}`);
}

wss.on("connection", (ws) => {
  const numClients = wss.clients.size;
  console.log("clients connected: ", numClients);

  if (ws.readyState === ws.OPEN) {
    ws.send("welcome!");
  }

  db.run(`
      INSERT INTO visitors (count, time) VALUES (${numClients}, datetime('now'));
    `);

  logCounts();
  ws.on("close", () => {
    console.log("A client has disconnected");
    sendCurrentStats();
  });

  ws.on("error", (_, error) => {
    console.log("error", error);
  });

  sendCurrentStats();
});

// Database config

const db = new sqlite.Database(":memory:");

db.on("close", () => {
  console.log("closing db connection");
});

db.serialize(() => {
  db.run(`
      CREATE TABLE visitors (
        count INTEGER,
        time TEXT
      );
    `);
});

function logCounts() {
  console.log("Counts on DATABASE: ");
  db.serialize(() => {
    db.each("SELECT * FROM visitors", (err, row) => {
      console.log(row);
    });
  });
}

process.on("SIGINT", async () => {
  wss.clients.forEach((client) => {
    client.close();
  });
  shutdownDB(() => {
    process.exit(0);
  });
});

function shutdownDB(cb) {
  logCounts();
  db.close();
  cb();
}
