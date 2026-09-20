const Ably = require("ably");

module.exports = async function handler(req, res) {
  try {
    if (!process.env.ABLY_API_KEY) {
      return res.status(500).json({ error: "ABLY_API_KEY is missing" });
    }

    const client = new Ably.Rest(process.env.ABLY_API_KEY);

    const tokenRequest = await client.auth.createTokenRequest({
      capability: JSON.stringify({
        "ramz-giveaway": ["subscribe"]
      }),
      ttl: 60 * 60 * 1000
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(tokenRequest);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not create Ably token" });
  }
};
