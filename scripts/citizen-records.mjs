import {rows} from './db.mjs';
import {fail,text} from './auth-security.mjs';
import {facilities} from '../dist/data.js';
const ids=new Set(facilities.map(f=>f.id));
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
function payload(kind,data){
  if(!ids.has(data?.facility))fail(400,'Choose a listed facility.');
  if(kind==='review'){
    const rating=Number(data.rating);
    if(!Number.isInteger(rating)||rating<1||rating>5)fail(400,'Choose a rating from 1 to 5.');
    return {facility:data.facility,rating,feedback:text(data.feedback,500)};
  }
  if(kind!=='assessment'||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||!['Usable','Partly usable','Not usable','Unable to assess'].includes(data.condition))fail(400,'Choose an assessment date and condition.');
  return {facility:data.facility,date:data.date,condition:data.condition,notes:text(data.notes,1500),water:!!data.water,accessible:!!data.accessible,clean:!!data.clean};
}
export function installRecords(app,{citizen,write,limit,pool}){
  app.get('/api/records',citizen,async(req,res)=>{
    const after=Number(req.query.after||0);
    if(!Number.isSafeInteger(after)||after<0)fail(400,'Invalid page.');
    const items=await rows(pool,'SELECT sequence_id,record_id,kind,payload FROM citizen_records WHERE user_id=? AND sequence_id>? ORDER BY sequence_id LIMIT 100',[req.user.id,after]);
    res.json({owner:req.user.id,items});
  });
  app.put('/api/records/:id',citizen,limit('records',250),async(req,res)=>{
    const {owner,kind,data}=req.body;
    if(owner!==req.user.id)fail(409,'Sign back into the original account to sync.');
    if(!uuid.test(req.params.id))fail(400,'Invalid record ID.');
    const value=payload(kind,data);
    await write(req,async(db,user)=>{
      const [existing]=await rows(db,'SELECT kind,payload FROM citizen_records WHERE user_id=? AND record_id=?',[user.id,req.params.id]);
      if(existing){
        if(existing.kind!==kind||Object.keys(value).some(k=>value[k]!==existing.payload[k]))fail(409,'This record already has different contents.');
        return;
      }
      await rows(db,'INSERT INTO citizen_records(user_id,record_id,kind,payload) VALUES (?,?,?,?)',[user.id,req.params.id,kind,JSON.stringify(value)]);
    });
    res.json({ok:true});
  });
}
