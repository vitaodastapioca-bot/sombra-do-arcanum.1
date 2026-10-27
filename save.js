import {json, problem, bodyFrom, safeIdFromURL, passwordGate, validate, table, handlerError} from '../../../lib/arcanum.js';
export async function POST(request){
 try{
  const id=safeIdFromURL(request,'save');const body=await bodyFrom(request);
  const row=await passwordGate(request,id,body.password);
  const err=validate(body.data);if(err)return problem(400,err);
  const result=await table('?id=eq.'+encodeURIComponent(row.id),{method:'PATCH',prefer:'return=minimal',body:{name:body.data.fields.name.trim(),portrait:body.data.portrait||'',data:body.data,updated_at:new Date().toISOString()}});
  return json({ok:true});
 }catch(err){return handlerError(err)}
}
