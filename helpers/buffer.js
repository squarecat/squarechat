const messageBuffer = {
  jz0ahj: [
    {
      chatId: "-388078727",
      name: "jim",
      text: "helloo",
      from: "jims",
      adminName: "admin",
    },
  ],
};

module.exports.getMessages = function getMessages(userId) {
  return messageBuffer[userId] || [];
};

module.exports.getMessageCount = function getMessageCount(userId) {
  return messageBuffer[userId] ? messageBuffer[userId].length : 0;
};

module.exports.deleteBuffer = function deleteBuffer(userId) {
  delete messageBuffer[userId];
};
