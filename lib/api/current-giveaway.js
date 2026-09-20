const {db}=require("./_db");
module.exports=async function(req,res){
  try{
    const sql=db();
    const g=(await sql`
      SELECT id,title,description,image_file_id,total_rounds,status,start_at,started_at,finished_at
      FROM giveaways
      WHERE status IN ('scheduled','running')
      ORDER BY
        CASE WHEN status='running' THEN 0 ELSE 1 END,
        start_at ASC
      LIMIT 1
    `)[0];

    if(!g){
      return res.status(200).json({ok:true,giveaway:null});
    }

    const participants=(await sql`
      SELECT COUNT(*)::int AS n
      FROM telegram_giveaway_participants
      WHERE giveaway_id=${g.id}
    `)[0].n;

    const viewers=(await sql`
      SELECT COUNT(*)::int AS n
      FROM giveaway_viewers
      WHERE giveaway_id=${g.id}
        AND last_seen_at>NOW()-INTERVAL '45 seconds'
    `)[0].n;

    const state=(await sql`
      SELECT status,round,total_rounds,start_at,duration_ms,target_index,participants,winners
      FROM giveaway_state
      WHERE giveaway_id=${g.id}
      LIMIT 1
    `)[0] || null;

    res.setHeader("Cache-Control","no-store");
    res.json({
      ok:true,
      giveaway:g,
      participantCount:Number(participants),
      viewerCount:Number(viewers),
      state
    });
  }catch(e){
    console.error(e);
    res.status(500).json({error:e.message});
  }
};
