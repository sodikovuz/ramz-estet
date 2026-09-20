import { neon } from "@neondatabase/serverless";
const sql=neon(process.env.DATABASE_URL);
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    await sql`UPDATE giveaway_state SET status=CASE WHEN current_spin>=5 THEN 'finished' ELSE 'ready' END WHERE id=1`;
    res.status(200).json({success:true});
  }catch(e){console.error(e);res.status(500).json({error:"Finish xatosi"});}
}