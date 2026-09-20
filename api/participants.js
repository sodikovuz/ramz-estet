import { neon } from "@neondatabase/serverless";
const sql=neon(process.env.DATABASE_URL);
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const {participants}=req.body||{};
    if(!Array.isArray(participants)) return res.status(400).json({error:"participants array kerak"});
    const clean=[...new Set(participants.map(x=>String(x).trim()).filter(Boolean))];
    await sql`DELETE FROM participants`;
    for(const username of clean) await sql`INSERT INTO participants(username) VALUES(${username})`;
    await sql`UPDATE giveaway_state SET status='ready',current_spin=0,winner=NULL,spin_started_at=NULL WHERE id=1`;
    await sql`DELETE FROM winners`;
    res.status(200).json({success:true,count:clean.length});
  }catch(e){console.error(e);res.status(500).json({error:"Saqlashda xatolik"});}
}