import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {GET as health} from '../api/health.js';
import {GET as list, POST as create} from '../api/sheets.js';
import {POST as unlock} from '../api/sheets/[id]/unlock.js';
import {POST as save} from '../api/sheets/[id]/save.js';
import {validate} from '../lib/arcanum.js';

let sheets=[],limits=new Map();
const oldFetch=global.fetch;
const make=(route,body)=>new Request(`https://sombra-do-arcanum.vercel.app${route}`,{method:'POST',headers:{'content-type':'application/json','x-vercel-forwarded-for':'192.0.2.11'},body:JSON.stringify(body)});
const template=()=>({schemaVersion:10,portrait:'',fields:{name:'Kairo',age:'25',sex:'',sexuality:'',race:'Humano',className:'',weapon:'',element:'',chaotic:'',phobia:'Altura',personality:'',money:'0',defense:'0',flasks:'',items:'',abilities:'',load:'0'},classMode:'none',level:1,extra:0,xp:0,xpTarget:100,attrs:Array(20).fill(0),resources:[120,50,50,100].map(current=>({invest:0,current}))});
function fakeDb(path, init){
 const url=new URL(path),table=url.pathname.split('/').at(-1),method=init?.method||'GET';
 const payload=init?.body?JSON.parse(init.body):null;
 const param=url.searchParams;const val=(key)=>param.get(key)?.replace(/^eq\./,'');
 if(table==='arcanum_count_attempt'){
   const last=limits.get(payload.p_bucket)||{attempts:0,window_started_at:new Date().toISOString()};
   last.attempts++;limits.set(payload.p_bucket,last);return Response.json(last.attempts);
 }
 if(table==='arcanum_rate_limits'){
   const k=val('bucket');
   if(method==='GET')return Response.json(limits.has(k)?[limits.get(k)]:[]);
   if(method==='DELETE'){limits.delete(k);return new Response(null,{status:204});}
 }
 if(table==='arcanum_sheets'){
   if(method==='GET'){
     let rows=sheets;if(val('id'))rows=rows.filter(x=>x.id===val('id'));
     let cols=(param.get('select')||'').split(',');rows=rows.map(r=>Object.fromEntries(cols.map(c=>[c,r[c]])));
     return Response.json(rows);
   }
   if(method==='POST'){sheets.push(payload);return new Response(null,{status:201});}
   if(method==='PATCH'){sheets=sheets.map(x=>x.id===val('id')?{...x,...payload}:x);return new Response(null,{status:204});}
 }
 return Response.json({message:'unknown route '+path},{status:404});
}
before(()=>{
 process.env.SUPABASE_URL='https://fake.supabase.co';process.env.SUPABASE_SECRET_KEY='sb_secret_test_fake_not_real';
 global.fetch=async(input,options)=>fakeDb(input,options);
});
after(()=>{global.fetch=oldFetch;delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SECRET_KEY});

test('configuração responde pronta',async()=>{
 assert.deepEqual((await (await health()).json()).ready,true);
});
test('validação inclui recursos e aplica limites por modo',()=>{
 const d=template();d.attrs[1]=1600;assert.equal(validate(d),null);
 d.attrs[1]=1601;assert.match(validate(d),/limite/);
 d.attrs[1]=1800;d.classMode='with';d.fields.className='Mago';assert.equal(validate(d),null);
 d.resources[0].invest=1;assert.match(validate(d),/limite/);
 d.resources[0].current=999;assert.match(validate(d),/Recursos/);
});
test('cria ficha, lista só metadados, bloqueia senha errada, permite senha certa e edição',async()=>{
 const d=template();d.attrs[1]=400;
 let res=await create(make('/api/sheets',{data:d,password:'MinhaSenha123'}));
 assert.equal(res.status,201);
 const {id}=await res.json();assert.ok(id);
 res=await list();assert.equal(res.status,200);const publicRows=await res.json();assert.equal(publicRows.length,1);
 assert.deepEqual(Object.keys(publicRows[0]).sort(),['id','name','portrait']);assert.equal(publicRows[0].name,'Kairo');
 res=await unlock(make(`/api/sheets/${id}/unlock`,{password:'errada'}));assert.equal(res.status,401);
 res=await unlock(make(`/api/sheets/${id}/unlock`,{password:'MinhaSenha123'}));assert.equal(res.status,200);
 assert.equal((await res.json()).data.attrs[1],400);
 const invalid=structuredClone(d);invalid.attrs[1]=3000;
 res=await save(make(`/api/sheets/${id}/save`,{data:invalid,password:'MinhaSenha123'}));assert.equal(res.status,400);
 const updated=structuredClone(d);updated.fields.name='Kairo, o Viajante';updated.attrs[1]=800;
 res=await save(make(`/api/sheets/${id}/save`,{data:updated,password:'MinhaSenha123'}));assert.equal(res.status,200);
 res=await unlock(make(`/api/sheets/${id}/unlock`,{password:'MinhaSenha123'}));assert.equal((await res.json()).data.attrs[1],800);
 res=await list();assert.equal((await res.json())[0].name,'Kairo, o Viajante');
});
test('bloqueio de força bruta após repetidas senhas incorretas',async()=>{
 const id=sheets[0].id;
 for(let i=0;i<8;i++){const r=await unlock(make(`/api/sheets/${id}/unlock`,{password:'invalida'}));assert.equal(r.status,401)}
 const blocked=await unlock(make(`/api/sheets/${id}/unlock`,{password:'MinhaSenha123'}));assert.equal(blocked.status,429);
});
