'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const WebSocket=require('ws');
const E=require('./public/engine');
const ROOT=path.resolve(__dirname,'public');
const PORT=Number(process.env.PORT||3000);
const rooms=new Map();let uid=1,seed=1;
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const httpServer=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end('Bad URL');}
 if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('OK');}
 const target=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
 if(target!==ROOT&&!target.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden');}
 fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});
});
const wss=new WebSocket.Server({server:httpServer,maxPayload:2048});
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code(){let v;do{v=Array.from({length:5},()=>ALPHABET[Math.floor(Math.random()*ALPHABET.length)]).join('');}while(rooms.has(v));return v;}
function send(ws,obj){if(ws.readyState===WebSocket.OPEN)try{ws.send(JSON.stringify(obj));}catch{}}
function emit(room,obj){for(const c of room.clients)send(c,obj);}
function error(ws,msg){send(ws,{type:'error',message:msg});}
function sanitize(s){return String(s??'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,18);}
function lobbyState(room){return {type:'lobby',code:room.code,capacity:room.capacity,name:room.name,state:room.status,hostId:room.members[0]?.id??null,players:room.members.map(p=>({id:p.id,name:p.name,char:p.char,slot:p.slot,clientId:p.clientId}))};}
function lobby(room){emit(room,lobbyState(room));}
function leave(ws){
 const room=ws.room;if(!room)return;
 room.clients.delete(ws);
 room.members=room.members.filter(p=>p.ws!==ws);
 ws.room=null;ws.members=[];
 if(room.members.length===0){rooms.delete(room.code);return;}
 if(room.status==='playing' && room.match){
   const ids=new Set(room.members.map(p=>p.id));
   for(const p of room.match.players)if(!ids.has(p.id))E.eliminate(p,'disconnect');
 }
 lobby(room);
}
function validateNames(msg){const names=Array.isArray(msg.names)?msg.names:[];if(names.length<1||names.length>2)return null;const clean=names.map(sanitize);return clean.every(Boolean)?clean:null;}
function join(ws,msg,creating){
 if(ws.room)return error(ws,'Primero salí de tu sala actual.');
 const names=validateNames(msg);if(!names)return error(ws,'Ingresá un apodo para cada jugador (máximo dos por dispositivo).');
 let room;
 if(creating){
  const capacity=Math.floor(+msg.capacity);
  if(!Number.isInteger(capacity)||capacity<1||capacity>12)return error(ws,'La sala debe admitir entre 1 y 12 personas.');
  if(names.length>capacity)return error(ws,'La sala no tiene lugar para los dos jugadores de esta PC.');
  room={code:code(),capacity,name:sanitize(msg.roomName)||'Circuito Neón',members:[],clients:new Set(),status:'lobby',match:null,round:0,lastBroadcast:0};
  rooms.set(room.code,room);
 }else{
  room=rooms.get(String(msg.code||'').trim().toUpperCase());
  if(!room)return error(ws,'Código incorrecto o sala inexistente.');
  if(room.status!=='lobby')return error(ws,'La carrera ya comenzó.');
  if(room.members.length+names.length>room.capacity)return error(ws,'No hay suficientes lugares libres en la sala.');
 }
 const clientId=uid++;ws.members=[];ws.room=room;room.clients.add(ws);
 names.forEach((name,slot)=>{const p={id:uid++,name,char:null,slot,clientId,ws};room.members.push(p);ws.members.push(p);});
 send(ws,{type:'joined',code:room.code,ids:ws.members.map(p=>p.id)});lobby(room);
}
function select(ws,msg){
 const room=ws.room;if(!room||room.status!=='lobby')return;
 const player=ws.members.find(p=>p.id===msg.id);if(!player)return;
 const char=msg.char===null?null:Number(msg.char);
 if(char!==null&&(!Number.isInteger(char)||char<0||char>=12))return error(ws,'Personaje inválido.');
 if(char!==null&&room.members.some(p=>p.char===char&&p!==player))return error(ws,'El personaje fue seleccionado antes por otro jugador.');
 player.char=char;
 lobby(room); // changing a pick releases its previous character immediately
}
function start(ws){
 const room=ws.room;
 if(!room||room.status!=='lobby'||room.members[0]?.ws!==ws)return error(ws,'Solo el anfitrión puede iniciar la carrera.');
 const available=E.NAMES.map((_,i)=>i).filter(i=>!room.members.some(p=>p.char===i));
 for(const p of room.members)if(p.char===null){const pos=Math.floor(Math.random()*available.length);p.char=available.splice(pos,1)[0];}
 room.round++;room.status='playing';room.match=E.createMatch(room.members,seed++);
 room.lastBroadcast=0;
 emit(room,{type:'start',code:room.code,seed:room.match.seed,players:room.members.map(p=>({id:p.id,name:p.name,char:p.char}))});
 lobby(room);
}
function backToLobby(ws){const room=ws.room;if(!room||room.members[0]?.ws!==ws||room.status!=='ended')return;room.status='lobby';room.match=null;room.members.forEach(p=>p.char=null);lobby(room);}
wss.on('connection',ws=>{
 ws.isAlive=true;ws.members=[];ws.room=null;
 ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',data=>{
  let msg;try{msg=JSON.parse(data.toString());}catch{return;}
  if(!msg||typeof msg.type!=='string')return;
  switch(msg.type){
   case 'create':join(ws,msg,true);break;
   case 'join':join(ws,msg,false);break;
   case 'pick':select(ws,msg);break;
   case 'start':start(ws);break;
   case 'flip':if(ws.room?.status==='playing'&&ws.members.some(p=>p.id===msg.id))E.flip(ws.room.match,msg.id);break;
   case 'lobbyAgain':backToLobby(ws);break;
   case 'leave':leave(ws);break;
  }
 });
 ws.on('close',()=>leave(ws));ws.on('error',()=>leave(ws));
});
let last=performance.now(),sendTimer=0;
setInterval(()=>{
 const now=performance.now(),dt=Math.min(.055,(now-last)/1000);last=now;sendTimer+=dt;
 for(const room of rooms.values())if(room.status==='playing'){
  E.step(room.match,dt);
  if(sendTimer>=.05)emit(room,{type:'snapshot',...E.snapshot(room.match)});
  if(room.match.ended){room.status='ended';emit(room,{type:'ended',ranking:room.match.players.map(p=>({id:p.id,name:p.name,char:p.char,score:p.score,reason:p.reason})).sort((a,b)=>b.score-a.score)});lobby(room);}
 }
 if(sendTimer>=.05)sendTimer=0;
},16);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},30000);
httpServer.listen(PORT,'0.0.0.0',()=>console.log('Gravity Shift 2.0 listening on '+PORT));
process.on('SIGTERM',()=>{clearInterval(heartbeat);wss.close();httpServer.close(()=>process.exit(0));});
