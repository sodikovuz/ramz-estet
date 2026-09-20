const { db } = require("./_db");

module.exports = async function(req,res) {
  try {
    const sql = db();
    const rows = await sql`SELECT * FROM giveaway_state WHERE id=1 LIMIT 1`;
    res.setHeader("Cache-Control","no-store");
    res.status(200).json(rows[0] || {
      id:1,status:"ready",giveaway_id:0,round:0,total_rounds:5,
      spin_id:0,start_at:null,duration_ms:8000,target_index:null,
      participants:[],winners:[]
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({error:e.message});
  }
};
