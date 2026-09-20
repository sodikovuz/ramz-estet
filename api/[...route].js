const path = require("path");

const routes = {
  "start": "./start",
  "reset": "./reset",
  "cron-notify": "./cron-notify",
  "telegram-status": "./telegram-status",
  "next": "./next",
  "set-webhook": "./set-webhook",
  "telegram-webhook": "./telegram-webhook",
  "giveaways": "./giveaways",
  "giveaway": "./giveaway",
  "state": "./state",
  "watch": "./watch",
  "public-giveaway": "./public-giveaway",
  "join": "./join",
  "current-giveaway": "./current-giveaway",
  "ably-token": "./ably-token",
  "finish-round": "./finish-round"
};

module.exports = async function(req, res) {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const parts = pathname.split("/").filter(Boolean);
    const name = parts[0] === "api" ? parts[1] : null;
    const target = routes[name];

    if (!target) return res.status(404).json({error:"API route not found"});

    const handler = require(path.join("../lib/api", target));
    return await handler(req, res);
  } catch (e) {
    console.error(e);
    return res.status(500).json({error:e.message || "Server error"});
  }
};
