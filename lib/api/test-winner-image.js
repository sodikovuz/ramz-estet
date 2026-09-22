const {error: auditError}=require('./_audit');
const {renderWinnerImage}=require('./_winner-image');

module.exports=async function(req,res){
  try{
    if(req.method!=='GET')return res.status(405).json({error:'GET only'});
    const winners=[
      {winner:'@username1'},
      {winner:'@username2'},
      {winner:'@username3'},
      {winner:'@username4'},
      {winner:'@username5'}
    ];
    const dateText=new Date().toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'});
    const png=await renderWinnerImage('RAMZ ESTET Giveaway',winners,dateText);
    res.setHeader('Content-Type','image/png');
    res.setHeader('Cache-Control','no-store');
    return res.status(200).send(png);
  }catch(e){
    console.error(e);
    return res.status(500).json({error:e.message||'Image generation error'});
  }
};
