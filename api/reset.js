import { neon } from "@neondatabase/serverless";
const sql=neon(process.env.DATABASE_URL);
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    await sql`UPDATE participants SET winner=false`;
    await sql`DELETE FROM winners`;
    await sql`UPDATE giveaway_state SET status='ready',current_spin=0,winner=NULL,spin_started_at=NULL WHERE id=1`;
    res.status(200).json({success:true});
  }catch(e){console.error(e);res.status(500).json({error:"Reset xatosi"});}
}