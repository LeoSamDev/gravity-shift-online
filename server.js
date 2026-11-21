'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||3000),ROOT=path.join(__dirname,'public');
const COLORS=['#52e0ff','#ff6b9a','#ffd166','#92f48d'],SPEED=220,GRAVITY=1050,FLIP=420,PLAYER_X=140,SIZE=23,H=450;
const rooms=new Map();let idCounter=1;
const server=http.createServer((req,res)=>{let u;try{u=new URL(req.url,'http://localhost')}catch{res.writeHead(400);return res.end()}
if(u.pathname==='/healthz'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('ok')}
let p=u.pathname==='/'?'/index.html':u.pathname,file=path.resolve(ROOT,'.'+p);if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end()}
fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end('Not found')}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript':'text/plain');res.end(data)})});
const wss=new WebSocketServer({server,maxPayload:2048});
const safeSend=(ws,data)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))};
const sendRoom=(room,data)=>room.players.forEach(p=>safeSend(p.ws,data));
const code=()=>{let s;do{s=Array.from({length:5},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('')}while(rooms.has(s));return s};
function level(){let obs=[];for(let i=0;i<150;i++){let x=620+i*255,type=i%8;
if(type===0)obs.push({x,y:0,w:42,h:140,kind:'wall'});
else if(type===1)obs.push({x,y:310,w:42,h:140,kind:'wall'});
else if(type===2)obs.push({x,y:0,w:45,h:75,kind:'spike'},{x:x+100,y:375,w:45,h:75,kind:'spike'});
else if(type===3)obs.push({x,y:160,w:40,h:130,kind:'wall'});
else if(type===4)obs.push({x,y:375,w:65,h:75,kind:'spike'});
else if(type===5)obs.push({x,y:0,w:55,h:180,kind:'wall'});
else if(type===6)obs.push({x,y:310,w:52,h:70,kind:'wall'});
else obs.push({x,y:0,w:60,h:70,kind:'spike'},{x:x+100,y:380,w:48,h:70,kind:'spike'});
}return obs}
function lobby(room){sendRoom(room,{type:'lobby',code:room.code,host:room.players[0]?.id,players:room.players.map(p=>({id:p.id,name:p.name,color:p.color,alive:p.alive,score:p.score})),state:room.state})}
function reset(room){room.state='playing';room.distance=0;room.obstacles=level();for(let p of room.players){Object.assign(p,{x:PLAYER_X,y:427,v:0,gravity:1,alive:true,score:0,flip:false})}sendRoom(room,{type:'start',obstacles:room.obstacles})}
function disconnect(ws){let room=ws.room;if(!room)return;room.players=room.players.filter(p=>p.ws!==ws);ws.room=null;ws.player=null;if(!room.players.length)rooms.delete(room.code);else{if(room.state==='playing'&&room.players.every(p=>!p.alive))room.state='ended';lobby(room)}}
wss.on('connection',ws=>{ws.on('message',raw=>{let msg;try{msg=JSON.parse(raw)}catch{return}if(!msg||typeof msg.type!=='string')return;
if(msg.type==='create'||msg.type==='join'){let name=String(msg.name||'').trim().slice(0,18);if(!name)return safeSend(ws,{type:'error',message:'Ingresá un apodo.'});let room;
if(msg.type==='create'){room={code:code(),players:[],state:'lobby',obstacles:[],distance:0};rooms.set(room.code,room)}else{room=rooms.get(String(msg.code||'').toUpperCase().trim());if(!room)return safeSend(ws,{type:'error',message:'No existe esa sala.'});if(room.state!=='lobby')return safeSend(ws,{type:'error',message:'La partida ya comenzó.'});if(room.players.length>=4)return safeSend(ws,{type:'error',message:'Sala llena.'})}
disconnect(ws);const used=new Set(room.players.map(p=>p.color));let p={id:idCounter++,ws,name,color:COLORS.find(c=>!used.has(c))||COLORS[0],x:PLAYER_X,y:427,v:0,gravity:1,alive:true,score:0,flip:false};room.players.push(p);ws.room=room;ws.player=p;safeSend(ws,{type:'joined',id:p.id,code:room.code});lobby(room)}
else if(msg.type==='start'){let room=ws.room;if(room&&room.players[0]?.ws===ws&&room.state==='lobby')reset(room)}
else if(msg.type==='flip'){if(ws.room?.state==='playing'&&ws.player?.alive)ws.player.flip=true}
else if(msg.type==='again'){let room=ws.room;if(room&&room.players[0]?.ws===ws&&room.state==='ended'){room.state='lobby';lobby(room)}}
});ws.on('close',()=>disconnect(ws));ws.on('error',()=>disconnect(ws))});
function updatePlayer(p,room,dt){if(!p.alive)return;if(p.flip){p.gravity*=-1;p.v=p.gravity*FLIP;p.flip=false}
const oldX=p.x,oldY=p.y;p.x+=SPEED*dt;p.v+=p.gravity*GRAVITY*dt;p.y+=p.v*dt;
if(p.y<=8){p.y=8;if(p.v<0)p.v=0}if(p.y>=H-SIZE-8){p.y=H-SIZE-8;if(p.v>0)p.v=0}
for(let o of room.obstacles){if(o.x>p.x+SIZE+4)break;if(o.x+o.w<p.x-4)continue;
if(p.x>=o.x+o.w||p.x+SIZE<=o.x||p.y>=o.y+o.h||p.y+SIZE<=o.y)continue;
if(o.kind==='spike'){p.alive=false;break}
const above=oldY+SIZE<=o.y&&p.y+SIZE>=o.y,below=oldY>=o.y+o.h&&p.y<=o.y+o.h;
const left=oldX+SIZE<=o.x&&p.x+SIZE>=o.x,right=oldX>=o.x+o.w&&p.x<=o.x+o.w;
if(above){p.y=o.y-SIZE;p.v=0}else if(below){p.y=o.y+o.h;p.v=0}else if(left||right){p.alive=false;break}else{p.alive=false;break}
}p.score=Math.max(0,Math.floor((p.x-PLAYER_X)/10))}
let last=Date.now();setInterval(()=>{let now=Date.now(),dt=Math.min((now-last)/1000,.05);last=now;for(let room of rooms.values()){if(room.state!=='playing')continue;
for(let p of room.players)updatePlayer(p,room,dt);room.distance=Math.max(0,...room.players.map(p=>p.x-PLAYER_X));
sendRoom(room,{type:'tick',distance:room.distance,players:room.players.map(p=>({id:p.id,y:p.y,gravity:p.gravity,alive:p.alive,score:p.score}))});
if(room.players.every(p=>!p.alive)){room.state='ended';sendRoom(room,{type:'ended',ranking:room.players.map(p=>({name:p.name,score:p.score,color:p.color})).sort((a,b)=>b.score-a.score)});lobby(room)}
}},33);
server.listen(PORT,'0.0.0.0',()=>console.log('Gravity Shift Online: http://localhost:'+PORT));
