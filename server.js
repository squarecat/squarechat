require("dotenv").config();
const request = require("request");
const cors = require("cors");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

if (!process.env.TELEGRAM_TOKEN) {
  console.error("TELEGRAM_TOKEN not provided");
  process.exit(1);
}
const channelId = parseInt(process.env.TELEGRAM_CHANNEL_ID);
const topicId = parseInt(process.env.TOPIC_ID);
const connectedSockets = {};
const messageBuffer = {};

console.log("Connected to", channelId, `#${topicId}`);

app.use(express.static("dist", { index: "demo.html", maxage: "4h" }));
app.use(bodyParser.json());

// handle admin Telegram messages
app.post("/hook", function (req, res) {
  try {
    console.log("got message", `"${req.body.message.text}"`);

    const message = req.body.message || req.body.channel_post;
    if (!topicId || message.message_thread_id === topicId) {
      const chatId = message.chat.id;
      const name = message.chat.first_name || message.chat.title || "admin";
      const text = message.text || "";
      const reply = message.reply_to_message;
      const from = message.from.username;
      res.statusCode = 200;

      if (text.startsWith("/start")) {
        console.log("/start chatId " + chatId);
        sendTelegramMessage(
          "*Welcome to Intergram* \n" +
            "The chat id is `" +
            chatId +
            "`\n" +
            "Use it to link between the embedded chat and this telegram chat",
          "Markdown"
        );
      } else if (reply) {
        let replyText = reply.text || "";
        // check if a reply to someone known
        const userIdMatch = replyText.match(/^\[(.+)\]/);
        if (userIdMatch) {
          const userId = userIdMatch[1];

          if (connectedSockets[userId]) {
            console.log(
              "client connected sending message",
              `${chatId}-${userId}`
            );
            const sock = connectedSockets[userId];
            sock.emit(chatId + "-" + userId, {
              name,
              text,
              from: "admin",
              adminName: from,
            });
            // check if connected, if not then buffer
            appendMissiveConversationAgent({
              conversationId: sock.conversationId,
              email: sock.userData.email,
              message: replyText,
            });
          } else {
            if (!messageBuffer[userId]) {
              messageBuffer[userId] = [];
            }
            console.log("client not connected buffering message");
            messageBuffer[userId].unshift({
              chatId,
              name,
              text,
              from: "admin",
              adminName: from,
            });
          }
        } else {
          console.log(
            "Ignoring message as id didn't match any connected users"
          );
        }
      }
    } else {
      console.log("Ignoring message in other topic");
    }
  } catch (e) {
    console.error("hook error", e, req.body);
  } finally {
    res.end();
  }
});

// handle chat visitors websocket messages
io.on("connection", function (client) {
  const address = client.handshake.address.replace("::ffff:", "");
  client.on("register", function (registerMsg) {
    const {
      isNewUser,
      chatId,
      userId,
      oldId,
      userData = {},
      currentUrl,
    } = registerMsg;
    console.log("register user", userId);
    client.userData = userData;
    connectedSockets[userId] = client;
    let messageReceived = false;
    // check the buffer and send anything in there
    if (messageBuffer[userId]) {
      const buffered = messageBuffer[userId];
      let msg = buffered.pop();
      console.log(`sending ${buffered.length} buffered messages`);
      while (msg) {
        const { chatId, name, text, from, adminName } = msg;
        client.emit(chatId + "-" + userId, {
          name,
          text,
          from,
          adminName,
        });
        appendMissiveConversationAgent({
          conversationId: client.conversationId,
          email: client.userData.email,
          message: text,
        });
        msg = buffered.pop();
      }
      delete messageBuffer[userId];
    }

    console.log("userId " + userId + " connected to chatId " + chatId);

    if (oldId) {
      sendMessage(
        userId,
        `Lead ${oldId} has logged in as ${obfuscateEmail(userData.email)}`
      ).then(() => {
        return sendStartMessage({ ...userData, currentUrl });
      });
    }
    client.on("message", function (data) {
      if (data.action === "typing") {
        return setTyping(chatId);
      }
      const { msg } = data;
      return Promise.resolve()
        .then(() => {
          if (isNewUser && !messageReceived) {
            console.log("sending start msg");
            sendStartMessage({
              ...userData,
              currentUrl,
            });
            return createMissiveConversation({
              email: userData.email,
              message: msg.text,
            });
          }
          return null;
        })
        .then((newConversationId) => {
          if (newConversationId) {
            client.conversationId = newConversationId;
          } else {
            appendMissiveConversationCustomer({
              conversationId: client.conversationId,
              email: userData.email,
              message: msg.text,
            });
          }
          messageReceived = true;
          client.emit(chatId + "-" + userId, msg);
          return sendMessage(userId, msg.text, userData ? userData.email : "");
        });
    });

    client.on("disconnect", function () {
      if (messageReceived) {
        sendTelegramMessage(userId + " has left");
      }
      delete connectedSockets[userId];
    });
  });
});

function sendStartMessage(userData = {}) {
  const { id, email, currentUrl } = userData;
  console.log(userData);
  const isLead = !email;
  let text = "";

  if (isLead) {
    text = `<b>New Lead</b>
<b>URL:</b>\t ${currentUrl || "unknown"}
`;
  } else {
    text = `A user has started a chat.
<b>ID:</b>\t ${id}
<b>Email:</b>\t ${obfuscateEmail(email)}
<b>URL:</b>\t ${currentUrl || "unknown"}
<b>Admin:</b>\t https://admin.leavemealone.com/#/users/${id}
`;
  }
  text = `${text}`;
  return sendTelegramMessage(text, "HTML");
}

function sendMessage(userId, text, email = "") {
  return sendTelegramMessage(
    `<b>[${userId}]</b> ${obfuscateEmail(email)}:\n${text}`,
    "HTML"
  );
}

app.post("/usage-start", cors(), function (req, res) {
  console.log("usage from", req.query.host);
  let unreadCount = 0;
  if (messageBuffer[req.query.userId]) {
    unreadCount = messageBuffer[req.query.userId].length;
  }
  res.statusCode = 200;
  res.status(200).send(unreadCount.toString());
});

app.post("/unreads", cors(), function (req, res) {
  let unreadCount = 0;
  if (messageBuffer[req.query.userId]) {
    unreadCount = messageBuffer[req.query.userId].length;
  }
  res.statusCode = 200;
  res.status(200).send(unreadCount.toString());
});

// left here until the cache expires
app.post("/usage-end", cors(), function (req, res) {
  res.statusCode = 200;
  res.end();
});

http.listen(process.env.PORT || 3000, function () {
  console.log("listening on port:" + (process.env.PORT || 3000));
});

app.get("/.well-known/acme-challenge/:content", (req, res) => {
  res.send(process.env.CERTBOT_RESPONSE);
});

function setTyping(chatId) {
  return new Promise((resolve, reject) => {
    request
      .post(
        "https://api.telegram.org/bot" +
          process.env.TELEGRAM_TOKEN +
          "/sendChatAction",
        function (err, resp, body) {
          if (err) {
            console.error(err);
            return reject(err);
          }
          resolve(body);
        }
      )
      .form({
        chat_id: chatId,
        action: "typing",
      });
  });
}

function sendTelegramMessage(text, parseMode = "HTML") {
  let data = {
    chat_id: channelId,
    text: text,
    parse_mode: parseMode,
  };
  if (topicId) {
    data.message_thread_id = topicId;
  }
  const url =
    "https://api.telegram.org/bot" +
    process.env.TELEGRAM_TOKEN +
    "/sendMessage";

  console.log("Sending message to Telegram", JSON.stringify(data, null, 2));

  return new Promise((resolve, reject) => {
    request
      .post(url, function (err, resp, body) {
        if (err) {
          console.error(err);
          return reject(err);
        }
        resolve(body);
      })
      .form(data);
  })
    .then(() => {
      console.log("Sent Telegram message");
    })
    .catch((err) => {
      console.error("Failed to send Telegram message");
      console.error(err);
    });
}

process.on("uncaughtException", (error) => {
  sendTelegramMessage(
    `Server uncaught exception:
${error.toString()}
`
  );
  console.error(error);
});

process.on("unhandledRejection", (error) => {
  sendTelegramMessage(
    `Server unhandled rejection:
${error.toString()}
`
  );
  console.error(error);
});

const missiveUrl = "https://public.missiveapp.com/v1/messages";

function createMissiveConversation({ email, message }) {
  if (!email) {
    console.log("No email provided, skipping Missive conversation");
    return Promise.resolve();
  }
  console.log("Creating Missive conversation", message);
  const converstaionData = {
    messages: {
      conversation_subject: `Live Chat message from ${email}`,
      account: "fc3ed25b-6e3f-4223-bf93-4e0a856be79c",
      organization: "c3aa45c4-1b6a-4489-9f12-a8ee165bc6cb",
      add_shared_labels: ["b4165c39-ea5d-4352-abd2-103bec50815a"],
      from_field: {
        address: email,
      },
      to_fields: [
        {
          address: "live-chat@leavemealone.com",
          name: "Leave Me Alone Support",
        },
      ],
      body: message,
    },
  };

  return new Promise((resolve, reject) => {
    request.post(
      missiveUrl,
      {
        json: converstaionData,
        headers: {
          Authorization: `Bearer ${process.env.MISSIVE_API_TOKEN}`,
        },
      },
      function (err, resp, body) {
        if (err) {
          console.error(err);
          return reject(err);
        }
        console.log(
          "Missive conversation created",
          JSON.stringify(body, null, 2)
        );
        const conversationId = body.messages.conversation;
        console.log("Set missive conversation ID", conversationId);
        resolve(conversationId);
      }
    );
  });
}

function appendMissiveConversationAgent({ conversationId, email, message }) {
  if (!email) {
    console.log("No email provided, skipping Missive conversation");
    return Promise.resolve();
  }
  console.log("Appending Missive conversation", conversationId, message);
  const converstaionData = {
    messages: {
      conversation: conversationId,
      account: "fc3ed25b-6e3f-4223-bf93-4e0a856be79c",
      from_field: {
        address: "live-chat@leavemealone.com",
        name: "Leave Me Alone Support",
      },
      to_fields: [
        {
          address: email,
        },
      ],
      body: message,
    },
  };
  return new Promise((resolve, reject) => {
    request.post(
      missiveUrl,
      {
        json: converstaionData,
        headers: {
          Authorization: `Bearer ${process.env.MISSIVE_API_TOKEN}`,
        },
      },
      function (err, resp, body) {
        if (err) {
          console.error(err);
          return reject(err);
        }
        console.log(
          "Missive conversation updated",
          JSON.stringify(body, null, 2)
        );
        resolve(body);
      }
    );
  });
}

function appendMissiveConversationCustomer({ conversationId, email, message }) {
  console.log("Appending Missive conversation", conversationId, message);
  const converstaionData = {
    messages: {
      conversation: conversationId,
      account: "fc3ed25b-6e3f-4223-bf93-4e0a856be79c",
      from_field: {
        address: email,
      },
      to_fields: [
        {
          address: "live-chat@leavemealone.com",
          name: "Leave Me Alone Support",
        },
      ],
      body: message,
    },
  };
  return new Promise((resolve, reject) => {
    request.post(
      missiveUrl,
      {
        json: converstaionData,
        headers: {
          Authorization: `Bearer ${process.env.MISSIVE_API_TOKEN}`,
        },
      },
      function (err, resp, body) {
        if (err) {
          console.error(err);
          return reject(err);
        }
        console.log(
          "Missive conversation updated",
          JSON.stringify(body, null, 2)
        );
        resolve(body);
      }
    );
  });
}

function obfuscateEmail(email) {
  return email ? email.replace(/(?<=.{2}).(?=.*@)/g, "*") : "";
}
