import { neon } from "@neondatabase/serverless";
const sql=neon(process.env.DATABASE_URL);
export default async function handler(req,res){
  try{
    const rows=await sql`SELECT username FROM participants WHERE winner=false ORDER BY id ASC`;
    res.status(200).json({participants:rows.map(x=>x.username)});
  }catch(e){console.error(e);res.status(500).json({error:"Server xatosi"});}
}