const Ably = require("ably");

module.exports = async function(req, res) {
  try {
    if (!process.env.ABLY_API_KEY)
      return res.status(500).json({error:"ABLY_API_KEY is missing"});

    const client = new Ably.Rest(process.env.ABLY_API_KEY);
    const token = await client.auth.createTokenRequest({
      capability: JSON.stringify({"ramz-giveaway":["subscribe"]}),
      ttl: 3600000
    });

    res.setHeader("Cache-Control","no-store");
    res.status(200).json(token);
  } catch(e) {
    console.error(e);
    res.status(500).json({error:"Could not create token"});
  }
};
