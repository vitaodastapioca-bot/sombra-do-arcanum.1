import {json, bodyFrom, safeIdFromURL, passwordGate, handlerError} from '../../../lib/arcanum.js';
export async function POST(request){
 try{const id=safeIdFromURL(request,'unlock');const {password}=await bodyFrom(request);const row=await passwordGate(request,id,password);return json({data:row.data});}
 catch(err){return handlerError(err)}
}
