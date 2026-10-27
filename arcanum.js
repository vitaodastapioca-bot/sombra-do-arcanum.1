import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const baseAttrs = Array.from({length:20}, (_,i)=>i===5||i===19?50:0);
const baseResources = [120,50,50,100];

export const isConfigured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(process.env.SUPABASE_URL||'') && Boolean(process.env.SUPABASE_SECRET_KEY?.startsWith('sb_secret_') || process.env.SUPABASE_SECRET_KEY?.startsWith('eyJ'));
export class ApiError extends Error { constructor(code, message) { super(message); this.code=code; } }
const goodUInt = v => Number.isSafeInteger(v) && v>=0;
const isString = (v, max=50000) => typeof v==='string' && v.length<=max;
const MAX_BODY=750000;
const MAX_PORTRAIT=300000;

export function validate(d){
 if(!d||typeof d!=='object'||Array.isArray(d)) return 'Ficha ausente';
 if(!Array.isArray(d.attrs)||d.attrs.length!==20||!d.attrs.every(goodUInt)) return 'Atributos devem ser inteiros não negativos';
 if(d.portrait!==undefined&&d.portrait!==''&&!(typeof d.portrait==='string'&&d.portrait.length<=MAX_PORTRAIT&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(d.portrait))) return 'Formato ou tamanho de retrato inválido';
 if(!Array.isArray(d.resources)||d.resources.length!==4) return 'Recursos incompletos';
 for(let i=0;i<4;i++) {const r=d.resources[i];if(!r||!goodUInt(r.invest)||!goodUInt(r.current)||r.current>baseResources[i]+r.invest)return 'Recursos inválidos ou acima do máximo';}
 if(!['none','with'].includes(d.classMode))return 'Modo de classe inválido';
 if(!goodUInt(d.level)||d.level<1||d.level>100000)return 'Nível inválido';
 if(!goodUInt(d.extra)||d.extra>1e7)return 'Pontos extras inválidos';
 if(!goodUInt(d.xp)||!goodUInt(d.xpTarget)||d.xpTarget<1)return 'XP inválido';
 if(!d.fields||typeof d.fields!=='object'||Array.isArray(d.fields))return 'Identidade ausente';
 const allowed=new Set(['name','age','sex','sexuality','race','className','weapon','element','chaotic','phobia','personality','money','defense','flasks','items','abilities','load']);
 for(const [k,v] of Object.entries(d.fields))if(!allowed.has(k)||!isString(v))return 'Campo de ficha inválido';
 if(!isString(d.fields.name,100)||!d.fields.name.trim())return 'Preencha nome do personagem';
 if(!isString(d.fields.phobia,200)||!d.fields.phobia.trim())return 'Informe uma fobia';
 if(d.classMode==='with'&&(!isString(d.fields.className,100)||!d.fields.className.trim()))return 'Informe a classe escolhida';
 if(!goodUInt(Number(d.fields.load||0))||Number(d.fields.load||0)>baseAttrs[19]+d.attrs[19])return 'Peso carregado acima da capacidade';
 const spent=d.attrs.reduce((x,y)=>x+y,0)+d.resources.reduce((x,y)=>x+y.invest,0);
 const budget=(d.classMode==='with'?1800:1600)+(d.level-1)*250+d.extra;
 if(!Number.isSafeInteger(spent)||spent>budget)return 'Pontos ultrapassam o limite disponível';
 if(JSON.stringify(d).length>MAX_BODY)return 'Ficha excede o tamanho permitido';
 return null;
}

export function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}})}
export function problem(status,error){return json({error},status)}
export async function bodyFrom(request){
 if(Number(request.headers.get('content-length')||0)>MAX_BODY)throw new ApiError(413,'Ficha excede o tamanho permitido');
 const raw=await request.text();
 if(raw.length>MAX_BODY)throw new ApiError(413,'Ficha excede o tamanho permitido');
 try{return JSON.parse(raw)}catch{throw new ApiError(400,'JSON inválido')}
}
export function safeIdFromURL(request, verb){
 const url=new URL(request.url);
 const regex=new RegExp('^/api/sheets/([a-f0-9-]{36})/'+verb+'/?$','i');
 const id=url.pathname.match(regex)?.[1];
 if(!id||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id))throw new ApiError(400,'Identificador de ficha inválido');
 return id;
}
export function passwordValid(p){return typeof p==='string'&&p.length>=6&&p.length<=200;}
export async function derive(password,salt){return (await scrypt(password,Buffer.from(salt,'hex'),64,{maxmem:32*1024*1024})).toString('hex');}
export async function verify(password,row){
 if(!passwordValid(password)||typeof row?.pass_salt!=='string'||typeof row?.pass_hash!=='string')return false;
 try{const got=Buffer.from(await derive(password,row.pass_salt),'hex'),saved=Buffer.from(row.pass_hash,'hex');return got.length===saved.length&&timingSafeEqual(got,saved)}catch{return false}
}
export function newId(){return randomUUID()}
export function newSalt(){return randomBytes(16).toString('hex')}
export function getIP(request){
 // Vercel supplies x-forwarded-for; use its last proxy-supplied value only as an abuse-control hint.
 return (request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,70);
}
export function bucket(...parts){return createHash('sha256').update(parts.join('|')).digest('hex')}
export function connectionProblem(){if(!isConfigured())throw new ApiError(503,'Banco de dados ainda não configurado. Configure SUPABASE_URL e SUPABASE_SECRET_KEY na Vercel.');}
export async function database(route,{method='GET',body,prefer}={}){
 connectionProblem();
 const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'')+'/rest/v1/'+route;
 const key=process.env.SUPABASE_SECRET_KEY;
 const headers={'apikey':key,'Accept':'application/json','Content-Type':'application/json'};
 if(key.startsWith('eyJ'))headers['Authorization']='Bearer '+key;
 if(prefer)headers['Prefer']=prefer;
 let response;
 try{response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(9000)})}
 catch(e){throw new ApiError(503,'Não foi possível conectar ao banco de dados.');}
 const raw=await response.text();let content=null;try{content=raw?JSON.parse(raw):null}catch{}
 if(!response.ok){console.error('Supabase error',response.status,JSON.stringify(content).slice(0,350));throw new ApiError(503,'O banco de dados não respondeu corretamente. Confira o SQL e as chaves.');}
 return content;
}
export const table=(path,options)=>database('arcanum_sheets'+path,options);
export const rateTable=(path,options)=>database('arcanum_rate_limits'+path,options);
export async function getSheet(id){const rows=await table('?id=eq.'+encodeURIComponent(id)+'&select=id,name,portrait,data,pass_salt,pass_hash&limit=1');return rows?.[0]||null;}
export async function bucketCount(b){const rows=await rateTable('?bucket=eq.'+encodeURIComponent(b)+'&select=attempts,window_started_at&limit=1');const row=rows?.[0];if(!row||Date.now()-Date.parse(row.window_started_at)>15*60*1000)return 0;return row.attempts||0;}
export async function addAttempt(b){return database('rpc/arcanum_count_attempt',{method:'POST',body:{p_bucket:b}})}
export async function clearAttempt(b){return database('arcanum_rate_limits?bucket=eq.'+encodeURIComponent(b),{method:'DELETE'});}
export async function passwordGate(request,id,password){
 const ipKey=bucket('unlock',getIP(request),id),sheetKey=bucket('sheet',id);
 const counts=await Promise.all([bucketCount(ipKey),bucketCount(sheetKey)]);
 if(counts[0]>=8||counts[1]>=48)throw new ApiError(429,'Muitas tentativas com senha. Aguarde 15 minutos.');
 const row=await getSheet(id);
 if(!row||!await verify(password,row)){
  // Same answer whether ID is absent or password is wrong.
  await Promise.all([addAttempt(ipKey),addAttempt(sheetKey)]);
  throw new ApiError(401,'Ficha não encontrada ou senha incorreta');
 }
 await clearAttempt(ipKey);
 return row;
}
export async function handlerError(err){
 if(!(err instanceof ApiError))console.error('Unexpected API error',err);
 return problem(err instanceof ApiError?err.code:500,err instanceof ApiError?err.message:'Erro interno no servidor');
}
