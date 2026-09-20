import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
export default async function handler(req,res){
  try{
    const state=await sql`SELECT * FROM giveaway_state WHERE id=1 LIMIT 1`;
    const winners=await sql`SELECT id,username,prize,created_at FROM winners ORDER BY id ASC`;
    res.status(200).json({state:state[0]||null,winners});
  }catch(e){console.error(e);res.status(500).json({error:"Server xatosi"});}
}