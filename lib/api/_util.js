
const crypto=require("crypto");
function token(){return crypto.randomBytes(24).toString("hex");}
function baseUrl(){return (process.env.PUBLIC_BASE_URL||"").replace(/\/$/,"");}
module.exports={token,baseUrl};
