// server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = 3000;

// === HTTP-СЕРВЕР ===
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // 1) Обробка HTTP-запиту /disconnect
  if (req.url.startsWith("/disconnect") && req.method === "GET") {
    handleDisconnectRequest(req, res);
    return;
  }

  // 2) Роздача статичних файлів із папки public
  let urlPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(__dirname, "public", urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Файл не знайдено");
    }

    const ext = path.extname(filePath);
    let contentType = "text/plain; charset=utf-8";

    if (ext === ".html") contentType = "text/html; charset=utf-8";
    if (ext === ".js")   contentType = "text/javascript; charset=utf-8";
    if (ext === ".css")  contentType = "text/css; charset=utf-8";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

// === WebSocket-сервер поверх цього ж HTTP ===
const wss = new WebSocket.Server({ server });

// Розсилка всім клієнтам
function broadcast(message, exceptWs = null) {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client !== exceptWs) {
      client.send(message);
    }
  }
}

// 🔹 Підключення нового клієнта
wss.on("connection", (ws, req) => {
  // читаємо clientId з рядка запиту ?id=...
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  let clientId = urlObj.searchParams.get("id");

  // якщо раптом не передали id – згенеруємо (про всяк випадок)
  if (!clientId) {
    clientId = "user_" + Date.now() + "_" + Math.random();
  }

  // зберігаємо id всередині сокета (для відключення по HTTP)
  ws.clientId = clientId;

  console.log(`Новий клієнт: ${clientId}`);

  // 🔸 повідомлення самому користувачу (без ID)
  ws.send(`Вітаємо в WebSocket-чаті!`);

  // 🔸 повідомлення іншим (просто "Користувач")
  broadcast(`Користувач приєднався до чату`, ws);

  // коли користувач надсилає повідомлення
  ws.on("message", (data) => {
    const text = data.toString();
    console.log(`Повідомлення від ${clientId}:`, text);
    broadcast(`Користувач: ${text}`, ws);
  });

  // коли WebSocket закривається (закрив вкладку)
  ws.on("close", () => {
    console.log(`Клієнт ${clientId} відключився`);
    broadcast(`Користувач залишив чат`);
  });
});

// === ОБРОБКА /disconnect за clientId ===
function handleDisconnectRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const clientId = urlObj.searchParams.get("id");

  console.log("Запит /disconnect для ID:", clientId);

  let clientToClose = null;

  for (const ws of wss.clients) {
    if (ws.clientId === clientId) {
      clientToClose = ws;
      break;
    }
  }

  if (clientToClose) {
    // 🔸 повідомляємо самого користувача (без ID у тексті)
    clientToClose.send(`Вас відключено від чату.`);

    // 🔸 повідомляємо інших
    broadcast(`Користувач відключився від чату`, clientToClose);

    // закриваємо сокет
    clientToClose.close();
  } else {
    console.log("WebSocket-з’єднання для цього ID не знайдено");
  }

  // Відповідь на HTTP-запит
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("OK");
}

// Запуск сервера
server.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});
