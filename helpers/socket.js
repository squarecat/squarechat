const { getMessages, deleteBuffer } = require("./buffer");
const { sendMessageToTelegram, sendTypingAction } = require("./telegram");
const socketIo = require("socket.io");

const connectedSockets = {};

module.exports.createSocketServer = function createSocketServer(server) {
  const io = socketIo(server);

  io.on("connection", (socket) => {
    socket.on("register", async function (registerMsg) {
      const { isNewUser, chatId, userId, oldId, userData, currentUrl } =
        registerMsg;
      console.info("a user connected", userId);
      socket.userId = userId;
      socket.userData = userData;
      connectedSockets[userId] = socket;
      const messages = getMessages(userId);

      if (messages.length) {
        console.info(`${userId} has ${messages.length} messages in the buffer`);
        for (let msg of messages) {
          const { chatId, name, text, from, adminName } = msg;
          console.info("sending buffered message to user", text);
          socket.emit(chatId + "-" + userId, {
            name,
            text,
            from,
            adminName,
          });
        }
        deleteBuffer(userId);
      }
    });

    socket.on("message", (data) => {
      if (!connectedSockets[socket.userId]) {
        console.log(
          `Message received on disconnected socket - ${socket.userId}`
        );
        connectedSockets[socket.userId] = socket;
      }
      const { action, msg } = data;
      console.log("Message received:", data);
      if (action === "typing") {
        sendTypingAction();
      } else if (action === "message") {
        connectedSockets[socket.userId].messageReceived = true;
        const text = `[${socket.userId}]: ${socket.userData?.email}\n${data.msg.text}`;
        sendMessageToTelegram(text);
      }
    });

    socket.on("disconnect", () => {
      if (connectedSockets[socket.userId].messageReceived) {
        sendTelegramMessage(chatId, socket.userId + " has left");
      }
      delete connectedSockets[socket.userId];
    });
  });
};

// export function sendMessageToUser({ chatId, userId, message }) {
//   const { name, text, from } = message;
//   // check if connected, if not then buffer
//   if (connectedSockets[userId]) {
//     console.log("client connected sending message");
//     const sock = connectedSockets[userId];
//     sock.emit(chatId + "-" + userId, {
//       name,
//       text,
//       from: "admin",
//       adminName: from,
//     });
//   } else {
//     if (!messageBuffer[userId]) {
//       messageBuffer[userId] = [];
//     }
//     console.log("client not connected buffering message");
//     messageBuffer[userId].unshift({
//       chatId,
//       name,
//       text,
//       from: "admin",
//       adminName: from,
//     });
//   }
// }

// export async function onConnectionStart(client) {
//   client.on("register", async function (registerMsg) {
//     const { isNewUser, chatId, userId, oldId, userData, currentUrl } =
//       registerMsg;
//     console.log("register user", userId);
//     connectedSockets[userId] = client;
//     let messageReceived = false;
//     // check the buffer and send anything in there
//     if (messageBuffer[userId]) {
//       const buffered = messageBuffer[userId];
//       let msg = buffered.pop();
//       console.log(`sending ${buffered.length} buffered messages`);
//       while (msg) {
//         const { chatId, name, text, from, adminName } = msg;
//         client.emit(chatId + "-" + userId, {
//           name,
//           text,
//           from,
//           adminName,
//         });
//         msg = buffered.pop();
//       }
//       delete messageBuffer[userId];
//     }

//     console.log("userId " + userId + " connected to chatId " + chatId);

//     if (oldId) {
//       await sendMessage(
//         chatId,
//         userId,
//         `Lead ${oldId} has logged in as ${userData.email}`
//       );
//       await sendStartMessage(chatId, { ...userData, currentUrl });
//     }

//     client.on("message", async function (data) {
//       if (data.action === "typing") {
//         return setTyping(chatId);
//       }
//       const { msg } = data;
//       if (isNewUser && !messageReceived) {
//         // enrich user data
//         await sendStartMessage(chatId, {
//           ...userData,
//           currentUrl,
//         });
//       }

//       messageReceived = true;
//       client.emit(chatId + "-" + userId, msg);
//       return sendMessage(
//         chatId,
//         userId,
//         msg.text,
//         userData ? userData.email : ""
//       );
//     });

//     client.on("disconnect", function () {
//       if (messageReceived) {
//         sendTelegramMessage(chatId, userId + " has left");
//       }
//       delete connectedSockets[userId];
//     });
//   });
// }

// function sendStartMessage(chatId, userData = {}) {
//   const { id, email, currentUrl } = userData;
//   console.log(userData);
//   const isLead = !email;
//   let text = "";

//   if (isLead) {
//     text = `<b>New Lead</b>
// <b>URL:</b>\t ${currentUrl || "unknown"}
// `;
//   } else {
//     text = `A user has started a chat.
// <b>ID:</b>\t ${id}
// <b>Email:</b>\t ${email}
// <b>URL:</b>\t ${currentUrl || "unknown"}
// <b>Stripe:</b>\t https://dashboard.stripe.com/search?query=${email}
// `;
//   }
//   text = `${text}`;
//   return sendTelegramMessage(chatId, text, "HTML");
// }

// function sendMessage(chatId, userId, text, email = "") {
//   return sendTelegramMessage(
//     chatId,
//     `<b>[${userId}]</b> ${email}:\n${text}`,
//     "HTML"
//   );
// }

// function setTyping(chatId) {
//   return new Promise((resolve, reject) => {
//     request
//       .post(
//         "https://api.telegram.org/bot" +
//           process.env.TELEGRAM_TOKEN +
//           "/sendChatAction",
//         function (err, resp, body) {
//           if (err) {
//             console.error(err);
//             return reject(err);
//           }
//           resolve(body);
//         }
//       )
//       .form({
//         chat_id: chatId,
//         action: "typing",
//       });
//   });
// }

// export function connectSocket(http) {
//   const io = require("socket.io")(http);
//   // handle chat visitors websocket messages
//   io.on("connection", onConnectionStart);
// }
