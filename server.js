const WebSocket = require('ws');
const http = require('http');

const PORT = 3000;
const HTTP_PORT = 3001;


const server = new WebSocket.Server({ port: PORT });

let nextClientId = 1;
const clients = new Map(); // ws -> { id }

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const [client] of clients.entries()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

server.on('connection', (ws) => {
  const clientId = nextClientId++;
  clients.set(ws, { id: clientId });

  console.log(`Користувач #${clientId} приєднався`);
  
  broadcast({
    type: 'system',
    text: `Користувач #${clientId} приєднався до чату`,
  });

  ws.on('message', (messageBuffer) => {
    const text = messageBuffer.toString();
    console.log(`Повідомлення від #${clientId}:`, text);
    
    broadcast({
      type: 'chat',
      from: `Користувач #${clientId}`,
      text,
      time: new Date().toISOString(),
    });
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Користувач #${clientId} від’єднався`);
    
    broadcast({
      type: 'system',
      text: `Користувач #${clientId} залишив чат`,
    });
  });

  ws.on('error', (err) => {
    console.error('Помилка WebSocket з’єднання:', err.message);
  });
});

console.log(`WebSocket сервер запущено на ws://localhost:${PORT}`);




const httpServer = http.createServer((req, res) => {
  if (req.url === "/disconnect") {

    
    for (const [client] of clients.entries()) {
      client.close();
    }

    res.writeHead(200);
    res.end("OK");
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(HTTP_PORT, () => {
  console.log("HTTP сервер працює на http://localhost:" + HTTP_PORT);
});
