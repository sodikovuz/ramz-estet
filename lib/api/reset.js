const Ably=require("ably");
const {db}=require("./_db");
const {requireAdmin}=require("./_auth");

module.exports=async function(req,res){
  try{
    if(req.method!=="POST")return res.status(405).json({error:"POST only"});
    requireAdmin(req);
    const sql=db();
    await sql`
      UPDATE giveaway_state SET
        status='ready', round=0, spin_id=0, start_at=NULL,
        target_index=NULL, participants='[]'::jsonb,
        winners='[]'::jsonb, updated_at=NOW()
      WHERE id=1
    `;
    await new Ably.Rest(process.env.ABLY_API_KEY)
      .channels.get("ramz-giveaway").publish("reset",{type:"reset"});
    res.status(200).json({ok:true});
  }catch(e){
    console.error(e);
    res.status(e.statusCode||500).json({error:e.message});
  }
};
