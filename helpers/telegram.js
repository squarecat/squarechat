const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const channelId = process.env.CHANNEL_ID;

bot.on("message", (ctx) => {
  console.log(`Message in group: ${ctx.message.text}`);
  if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
    console.log(`Message in group: ${ctx.message.text}`);
    // Add your logic here
  }
});

module.exports.sendMessageToTelegram = function sendMessageToTelegram(message) {
  bot.telegram.sendMessage(channelId, message);
};

module.exports.sendTypingAction = function sendTypingAction() {
  bot.telegram.sendChatAction(channelId, "typing");
};

module.exports.startBot = function startBot() {
  bot.launch();
  console.info("Launched Squarechat.");
};

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
