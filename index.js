const express = require("express");
const { Telegraf } = require("telegraf");
const http = require("http");

const cors = require("cors");
const { sendMessageToTelegram, startBot } = require("./helpers/telegram");
const { getMessageCount } = require("./helpers/buffer");
const { createSocketServer } = require("./helpers/socket");

const { PORT } = process.env;

const app = express();
const server = http.createServer(app);

createSocketServer(server);

app.post("/usage-start", cors(), function (req, res) {
  console.log("usage from", req.query.host);
  const unreadCount = getMessageCount(req.query.userId);
  res.status(200).send(unreadCount.toString());
});

app.post("/unreads", cors(), function (req, res) {
  const unreadCount = getMessageCount(req.query.userId);
  res.status(200).send(unreadCount.toString());
});

// left here until the cache expires
app.post("/usage-end", cors(), function (req, res) {
  res.statusCode = 200;
  res.end();
});

app.use(express.static("dist"));

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
startBot();
