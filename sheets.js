import {json, problem, bodyFrom, validate, passwordValid, newId, newSalt, derive, getIP, bucket, bucketCount, addAttempt, connectionProblem, table, handlerError} from '../lib/arcanum.js';
export async function GET(){
 try{
  connectionProblem();
  const rows=await table('?select=id,name,portrait&order=created_at.desc&limit=1000');
  return json(rows||[]);
 }catch(err){return handlerError(err)}
}
export async function POST(request){
 try{
  connectionProblem();
  const limitKey=bucket('create',getIP(request));
  if(await bucketCount(limitKey)>=12)return problem(429,'Muitas fichas criadas em pouco tempo. Aguarde 15 minutos.');
  const body=await bodyFrom(request);
  const error=validate(body.data);if(error)return problem(400,error);
  if(!passwordValid(body.password))return problem(400,'A senha deve ter entre 6 e 200 caracteres');
  const id=newId(),pass_salt=newSalt(),pass_hash=await derive(body.password,pass_salt);
  await table('',{method:'POST',prefer:'return=minimal',body:{id,name:body.data.fields.name.trim(),portrait:body.data.portrait||'',data:body.data,pass_salt,pass_hash}});
  await addAttempt(limitKey);
  return json({id},201);
 }catch(err){return handlerError(err)}
}
