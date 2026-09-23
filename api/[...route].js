const path = require("path");
const {error: auditError} = require("../lib/api/_audit");

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
  "settings": "./settings",
  "state": "./state",
  "watch": "./watch",
  "join": "./join",
  "public-giveaway": "./public-giveaway",
  "current-giveaway": "./current-giveaway",
  "ably-token": "./ably-token",
  "finish-round": "./finish-round",
  "winner-status": "./winner-status",
  "client-log": "./client-log",
  "log-test": "./log-test",
  "test-winner-image": "./test-winner-image"
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
    try { await auditError({source:'api',action:'router.exception',error:e,meta:{path:req.url,method:req.method}}); } catch (_) {}
    return res.status(500).json({error:e.message || "Server error"});
  }
};
