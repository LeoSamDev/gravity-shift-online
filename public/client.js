(()=>{'use strict';
const E=window.GravityEngine,$=id=>document.getElementById(id);
const state={mode:'local',onlineAction:'create',room:null,hostId:null,players:[],ownIds:[],localCount:1,slot:0,capacity:8,ws:null,match:null,remote:false,playing:false,finished:false,showHitboxes:false,last:0,raf:0,lobbyCode:'LOCAL',connectionReady:false,resultShown:false};
const asset=p=>window.GRAVITY_ASSETS?.[p]||p;
const sprites=E.NAMES.map((_,i)=>{const im=new Image();im.src=asset('/assets/sprite_'+String(i+1).padStart(2,'0')+'.webp');return im;});
const can=$('canvas'),ctx=can.getContext('2d');let toastTimer=0;
const reason={left:'Te quedaste fuera del borde izquierdo.',top:'Saliste completamente por el borde superior.',bottom:'Saliste completamente por el borde inferior.',hazard:'Tocaste un obstáculo mortal.',disconnect:'Jugador desconectado.'};
function show(s){['Menu','Lobby','Game'].forEach(k=>$('screen'+k).classList.toggle('on',k===s));window.scrollTo({top:0,behavior:'instant'});}
function setStatus(msg){$('statusMenu').textContent=msg;}
function htmlSafe(s){return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function namesFromForm(){const n=[$('nick1').value.trim()];if(state.localCount===2)n.push($('nick2').value.trim());return n.map(x=>x.slice(0,18));}
function localIds(){return state.ownIds;}
function ownPlayer(){return state.players.find(p=>p.id===localIds()[state.slot]);}
function availableChars(){return E.NAMES.map((_,i)=>i).filter(i=>!state.players.some(p=>p.char===i));}
function updateCapacity(){state.capacity=+$('capacity').value;$('capacityValue').textContent=String(state.capacity);if(state.localCount>state.capacity){state.localCount=state.capacity;$('localCount').value=String(state.localCount);updateCount();}}
function updateCount(){state.localCount=+$('localCount').value;$('nick2wrap').hidden=state.localCount!==2;if(state.localCount>state.capacity){state.capacity=state.localCount;$('capacity').value=String(state.capacity);$('capacityValue').textContent=String(state.capacity);}}
function updateMode(){const online=state.mode==='online';$('tabLocal').classList.toggle('active',!online);$('tabOnline').classList.toggle('active',online);$('tabLocal').setAttribute('aria-pressed',String(!online));$('tabOnline').setAttribute('aria-pressed',String(online));$('localConfig').classList.toggle('hide',online);$('onlineConfig').classList.toggle('hide',!online);$('roomName').disabled=online && state.onlineAction==='join';$('capacity').disabled=online && state.onlineAction==='join';$('createBtn').firstChild.textContent=online?(state.onlineAction==='join'?'UNIRSE A SALA ':'CREAR SALA ONLINE '):'CREAR SALA LOCAL ';setStatus('');}
function updateAction(){const join=state.onlineAction==='join';$('modeCreate').classList.toggle('active',!join);$('modeJoin').classList.toggle('active',join);$('joinCodeWrap').hidden=!join;updateMode();}
$('capacity').addEventListener('input',updateCapacity);$('localCount').addEventListener('change',updateCount);
$('tabLocal').onclick=()=>{state.mode='local';updateMode();};$('tabOnline').onclick=()=>{state.mode='online';updateMode();};$('modeCreate').onclick=()=>{state.onlineAction='create';updateAction();};$('modeJoin').onclick=()=>{state.onlineAction='join';updateAction();};
$('btnHelp').onclick=()=>{$('helpModal').classList.remove('hide');};$('closeHelp').onclick=$('helpOk').onclick=()=>{$('helpModal').classList.add('hide');};$('helpModal').addEventListener('click',e=>{if(e.target===$('helpModal'))$('helpModal').classList.add('hide');});
$('logo').onclick=e=>{e.preventDefault();leave();};
function createLocal(){
 const names=namesFromForm();if(names.some(n=>!n)){setStatus('Ingresá un apodo para cada jugador.');return;}
 state.remote=false;state.connectionReady=false;state.room={code:'LOCAL',name:$('roomName').value.trim()||'Circuito Neón',capacity:state.capacity};
 state.players=names.map((name,i)=>({id:i+1,name,char:null,local:true}));
 state.ownIds=state.players.map(p=>p.id);state.slot=0;state.finished=false;
 state.lobbyCode='LOCAL';enterLobby();
}
function startSocket(callback){
 if(location.protocol==='file:'){setStatus('Abrí la versión publicada en un servidor para jugar online. Este archivo permite jugar localmente.');return;}
 if(state.ws){try{state.ws.close();}catch{}}
 const scheme=location.protocol==='https:'?'wss:':'ws:';
 const ws=new WebSocket(scheme+'//'+location.host);
 state.ws=ws;let connected=false;
 ws.onopen=()=>{if(state.ws!==ws)return;connected=true;state.connectionReady=true;$('conn').innerHTML='<i></i> CONECTADO ONLINE';$('conn').classList.add('online');callback(ws);};
 ws.onerror=()=>{if(!connected)setStatus('No se pudo conectar con el servidor online.');};
 ws.onclose=()=>{if(state.ws!==ws)return;state.connectionReady=false;$('conn').innerHTML='<i></i> DESCONECTADO';$('conn').classList.remove('online');if(state.remote){if(state.playing){state.playing=false;cancelAnimationFrame(state.raf);}state.remote=false;state.room=null;show('Menu');setStatus('Se perdió la conexión con el servidor.');}};
 ws.onmessage=e=>{let msg;try{msg=JSON.parse(e.data);}catch{return;}onMessage(msg);};
}
function serverSend(obj){if(state.ws?.readyState===WebSocket.OPEN)state.ws.send(JSON.stringify(obj));}
function createOnline(){
 const names=namesFromForm();if(names.some(n=>!n)){setStatus('Ingresá apodos antes de entrar.');return;}
 const join=state.onlineAction==='join';const code=$('joinCode').value.trim().toUpperCase();if(join&&code.length!==5){setStatus('Ingresá el código de cinco caracteres de la sala.');return;}
 setStatus('Conectando con el servidor...');$('createBtn').disabled=true;
 startSocket(ws=>{const msg={type:join?'join':'create',names,capacity:state.capacity,roomName:$('roomName').value.trim(),code};ws.send(JSON.stringify(msg));$('createBtn').disabled=false;});
 setTimeout(()=>{$('createBtn').disabled=false;},5000);
}
$('createBtn').onclick=()=>state.mode==='local'?createLocal():createOnline();
function onMessage(msg){
 switch(msg.type){
  case 'error':setStatus(msg.message);$('lobbyHint').textContent=msg.message;break;
  case 'joined':state.remote=true;state.lobbyCode=msg.code;state.ownIds=msg.ids;state.slot=0;state.finished=false;enterLobby();break;
  case 'lobby':
   if(!state.remote)return;
   state.room={code:msg.code,name:msg.name,capacity:msg.capacity};state.players=msg.players;state.hostId=msg.hostId;
   if(msg.state==='lobby'){if(state.playing){state.playing=false;cancelAnimationFrame(state.raf);state.match=null;state.finished=false;}show('Lobby');renderLobby();}else if(msg.state==='ended'){renderLobby();}
   break;
  case 'start':
   state.players=msg.players;state.match=E.createMatch(msg.players,msg.seed);state.finished=false;state.resultShown=false;
   beginRace(true);break;
  case 'snapshot':
   if(!state.match||!state.remote)return;
   state.match.camera=msg.camera;state.match.time=msg.time;state.match.ended=msg.ended;state.match.score=msg.score;
   for(const data of msg.players){const r=state.match.players.find(p=>p.id===data.id);if(r)Object.assign(r,data);}
   if(msg.ended && !state.finished){state.finished=true;displayResults();}
   break;
  case 'ended':state.finished=true;state.rankings=msg.ranking;displayResults();break;
 }
}
function enterLobby(){state.playing=false;cancelAnimationFrame(state.raf);$('screenGame').classList.remove('on');$('lobbyName').textContent=state.room.name.toUpperCase();$('lobbyCode').textContent=state.room.code;renderLobby();show('Lobby');}
function renderLobby(){
 if(!state.room)return;
 $('lobbyName').textContent=state.room.name.toUpperCase();$('lobbyCode').textContent=state.room.code;
 $('lobbyCount').textContent=state.players.length+' / '+state.room.capacity;
 const own=ownPlayer(),owns=state.players.filter(p=>localIds().includes(p.id));
 $('slotPicker').innerHTML=owns.map((p,i)=>`<button class="${state.slot===i?'active':''}" data-slot="${i}">P${i+1} · ${htmlSafe(p.name)}</button>`).join('');
 $('slotPicker').querySelectorAll('[data-slot]').forEach(btn=>btn.onclick=()=>{state.slot=+btn.dataset.slot;renderLobby();});
 $('characters').innerHTML=E.NAMES.map((name,i)=>{
  const owner=state.players.find(p=>p.char===i),selected=own?.char===i,locked=!!owner&&!selected;
  return `<button class="character ${selected?'chosen':''} ${locked?'taken':''}" data-char="${i}" ${locked?'disabled':''} aria-label="${htmlSafe(name)}, ${locked?'no disponible':selected?'seleccionado':'disponible'}"><span class="serial">${String(i+1).padStart(2,'0')}</span><img src="${asset('/assets/pilot_'+String(i+1).padStart(2,'0')+'.webp')}" alt="" loading="lazy"><span class="name">${htmlSafe(name)}</span>${locked?'<span class="lock">OCUPADO</span>':''}</button>`;
 }).join('');
 $('characters').querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>selectChar(+b.dataset.char));
 $('playerList').innerHTML=state.players.map(p=>`<div class="playerRow"><span class="avatar" style="--avatar:${p.char===null?'#53718e':E.COLORS[p.char]}"></span><span class="playerName">${htmlSafe(p.name)} ${state.remote&&p.id===state.hostId?'★':''}</span><span class="playerChar">${p.char===null?'SIN ELEGIR':htmlSafe(E.NAMES[p.char])}</span></div>`).join('');
 $('selectedStatus').textContent=own?(own.char===null?own.name+': pendiente de elección':own.name+': '+E.NAMES[own.char]+' reservado'):'Esperando jugadores...';
 const isHost=!state.remote||state.ownIds.includes(state.hostId);$('startBtn').disabled=!isHost;
 $('lobbyHint').textContent=state.remote?(isHost?'Sos el anfitrión. Podés iniciar sin llenar la sala.':'Esperando a que el anfitrión inicie la carrera.'):'Podés comenzar solo o rellenar con rivales de entrenamiento.';
}
function selectChar(i){const p=ownPlayer();if(!p)return;if(state.remote){serverSend({type:'pick',id:p.id,char:i});return;}const used=state.players.some(q=>q.char===i&&q!==p);if(used)return;p.char=i;renderLobby();}
$('release').onclick=()=>{const p=ownPlayer();if(!p)return;if(state.remote)serverSend({type:'pick',id:p.id,char:null});else {p.char=null;renderLobby();}};
$('random').onclick=()=>{const free=availableChars();if(!free.length)return;selectChar(free[Math.floor(Math.random()*free.length)]);};
$('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(state.room?.code||'LOCAL');$('copyCode').textContent='¡COPIADO!';setTimeout(()=>$('copyCode').textContent='COPIAR',1300);}catch{$('copyCode').textContent='COPIÁ EL CÓDIGO';}};
function assignRemaining(){const used=new Set(state.players.map(p=>p.char).filter(v=>v!==null));const free=E.NAMES.map((_,i)=>i).filter(i=>!used.has(i));for(const p of state.players)if(p.char===null){const i=Math.floor(Math.random()*free.length);p.char=free.splice(i,1)[0];}}
function startLocal(){
 const existing=state.players.filter(p=>state.ownIds.includes(p.id));state.players=existing;
 if($('fillBots').checked){while(state.players.length<state.room.capacity){const i=state.players.length;state.players.push({id:100+i,name:'Rival '+(i+1),char:null,bot:true});}}
 assignRemaining();state.match=E.createMatch(state.players,7);state.finished=false;state.resultShown=false;beginRace(false);
}
$('startBtn').onclick=()=>state.remote?serverSend({type:'start'}):startLocal();
function leave(){
 if(state.ws){serverSend({type:'leave'});const socket=state.ws;state.ws=null;try{socket.close();}catch{}}
 state.remote=false;state.room=null;state.players=[];state.ownIds=[];state.match=null;state.playing=false;state.finished=false;cancelAnimationFrame(state.raf);state.last=0;show('Menu');
 $('conn').innerHTML='<i></i> DEMO LOCAL';$('conn').classList.remove('online');setStatus('');
}
$('leaveLobby').onclick=leave;$('exitGame').onclick=leave;$('menuBtn').onclick=leave;
function beginRace(remote){
 state.remote=remote;state.playing=true;state.last=0;state.resultShown=false;$('gameOverlay').classList.add('hide');$('raceStatus').textContent='CORRIENDO';
 $('touchOverlay').querySelector('span:last-child').style.display=state.ownIds.length>1?'':'none';show('Game');cancelAnimationFrame(state.raf);state.raf=requestAnimationFrame(tick);
}
function localAgain(){const own=state.players.filter(p=>state.ownIds.includes(p.id));
 if(state.remote){if(state.ownIds.includes(state.hostId)){serverSend({type:'lobbyAgain'});state.playing=false;cancelAnimationFrame(state.raf);show('Lobby');}else {$('resultReason').textContent='Esperando al anfitrión para iniciar otra carrera.';}return;}
 state.players=own;startLocal();}
$('againBtn').onclick=localAgain;
function queueFlip(index){if(!state.playing||state.finished)return;const id=state.ownIds[index];if(id==null)return;if(state.remote)serverSend({type:'flip',id});else E.flip(state.match,id);}
document.addEventListener('keydown',e=>{
 if(e.code==='KeyH'&&!e.repeat){state.showHitboxes=!state.showHitboxes;$('hitboxBtn').textContent=state.showHitboxes?'HITBOXES: ON':'HITBOXES: OFF';}
 if(!state.playing||e.repeat||!['Space','KeyL'].includes(e.code))return;
 if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
 e.preventDefault();queueFlip(e.code==='Space'?0:1);
});
can.addEventListener('pointerdown',e=>{e.preventDefault();const r=can.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;queueFlip(state.ownIds.length===2&&x>.5?1:0);},{passive:false});
$('hitboxBtn').onclick=()=>{state.showHitboxes=!state.showHitboxes;$('hitboxBtn').textContent=state.showHitboxes?'HITBOXES: ON':'HITBOXES: OFF';};
function displayResults(){
 if(state.resultShown)return;state.resultShown=true;
 const all=state.match?.players||[],mine=all.filter(p=>state.ownIds.includes(p.id));
 const survived=mine.some(p=>p.alive);
 $('resultTitle').textContent=survived?'¡CARRERA TERMINADA!':'¡ELIMINADO!';
 $('resultReason').textContent=mine.map(p=>p.name+': '+(reason[p.reason]||'Carrera terminada.')).join(' · ');
 const ranking=(state.rankings||all.map(p=>({id:p.id,name:p.name,char:p.char,score:p.score})).sort((a,b)=>b.score-a.score));
 $('rankings').innerHTML=ranking.slice(0,12).map((p,i)=>`<div class="rankline"><span>#${i+1} ${htmlSafe(p.name)}</span><b>${Math.round(p.score||0)} m</b></div>`).join('');
 $('againBtn').textContent=state.remote?'VOLVER A SALA':'REINTENTAR';
 if(state.remote&&!state.ownIds.includes(state.hostId))$('againBtn').disabled=true;else $('againBtn').disabled=false;
 $('raceStatus').textContent='FINALIZADO';$('gameOverlay').classList.remove('hide');
}
function tick(t){if(!state.playing)return;
 const dt=Math.min(.04,((t-state.last)||0)/1000);state.last=t;
 if(state.match && !state.remote)E.step(state.match,dt);
 if(state.match){drawGame(state.match);renderRaceHUD();}
 if(!state.remote&&state.match&&!state.resultShown && state.match.players.filter(p=>state.ownIds.includes(p.id)).every(p=>!p.alive)){state.finished=true;displayResults();}
 state.raf=requestAnimationFrame(tick); // keep camera animation alive after local elimination
}
function rounded(x,y,w,h,r,fill,stroke){if(w<1||h<1)return;ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function skyline(camera){
 const g=ctx.createLinearGradient(0,0,0,E.H);g.addColorStop(0,'#07152b');g.addColorStop(.52,'#241643');g.addColorStop(1,'#07152a');ctx.fillStyle=g;ctx.fillRect(0,0,E.W,E.H);
 ctx.fillStyle='#8d59e4';ctx.shadowColor='#d670ff';ctx.shadowBlur=55;ctx.beginPath();ctx.arc(710,206,67,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#ff8cbb';ctx.beginPath();ctx.arc(710,206,51,0,7);ctx.fill();
 for(let layer=0;layer<3;layer++){
  const speed=[.08,.18,.32][layer];let off=camera*speed;
  for(let i=-3;i<32;i++){
   let x=i*64-(off%64),h=45+((i*127+layer*89+1100)%170),w=30+(i%3+3)%3*11;
   if(x+w<0||x>E.W)continue;
   ctx.fillStyle=['#1b2046','#161d43','#101d38'][layer];ctx.fillRect(x,E.H-h,w,h);
   ctx.fillStyle=['#8a59ff26','#50afff30','#2fe9ff44'][layer];for(let y=E.H-h+9;y<E.H-7;y+=17)ctx.fillRect(x+8,y,3,5);
  }
 }
 ctx.strokeStyle='#42b7fb0f';ctx.lineWidth=1;for(let y=25;y<E.H;y+=37){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(E.W,y);ctx.stroke();}
}
function paintBlock(b,cam){const x=b.x-cam;if(x+b.w<-20||x>E.W+20)return;
 ctx.save();ctx.shadowColor=b.kind==='rail'?'#31ebff':'#658dfb';ctx.shadowBlur=15;
 const grad=ctx.createLinearGradient(x,b.y,x+b.w,b.y+b.h);grad.addColorStop(0,'#162d4d');grad.addColorStop(1,'#0a1c34');rounded(x,b.y,b.w,b.h,3,grad,'#49cef9');ctx.shadowBlur=0;
 if(b.kind==='rail'){const yy=b.y===0?b.y+b.h-4:b.y+1;ctx.fillStyle='#64f1ff';ctx.fillRect(x,yy,b.w,3);}
 else{ctx.strokeStyle='#58d6ff79';ctx.beginPath();for(let y=b.y+11;y<b.y+b.h-5;y+=15){ctx.moveTo(x+5,y);ctx.lineTo(x+b.w-5,y);}ctx.stroke();}
 ctx.fillStyle='#2d5271';for(let dx=7;dx<b.w-7;dx+=25)ctx.fillRect(x+dx,b.y+b.h/2-1,9,3);
 if(state.showHitboxes){ctx.strokeStyle='#5cff9f';ctx.lineWidth=1.2;ctx.strokeRect(x,b.y,b.w,b.h);}ctx.restore();}
function paintSaw(h,cam,time){const x=h.x-cam;if(x+h.w<-35||x>E.W+30)return;const cx=x+h.w/2,cy=h.y+h.h/2;
 ctx.save();ctx.translate(cx,cy);ctx.rotate(time*5);ctx.fillStyle='#ff5385';ctx.shadowColor='#ff4177';ctx.shadowBlur=20;
 for(let i=0;i<12;i++){ctx.rotate(Math.PI/6);ctx.beginPath();ctx.moveTo(-4,-12);ctx.lineTo(0,-24);ctx.lineTo(4,-12);ctx.fill();}
 ctx.beginPath();ctx.arc(0,0,14,0,7);ctx.fill();ctx.fillStyle='#24182e';ctx.beginPath();ctx.arc(0,0,9,0,7);ctx.fill();ctx.fillStyle='#fff2b9';ctx.beginPath();ctx.arc(0,0,3,0,7);ctx.fill();ctx.shadowBlur=0;ctx.restore();
 if(state.showHitboxes){ctx.strokeStyle='#ff5575';ctx.strokeRect(x,h.y,h.w,h.h);}}
function paintRunner(p,cam,time){if(!p.alive)return;const x=p.x-cam;if(x<-110||x>E.W+110)return;
 const col=E.COLORS[p.char??0],sprite=sprites[p.char??0],stride=Math.sin(time*17+p.id);
 ctx.save();ctx.translate(x+E.PW/2,p.g===1?p.y+E.PH:p.y);if(p.g<0)ctx.rotate(Math.PI);ctx.rotate(.04*Math.sin(time*12+p.id));
 for(let i=0;i<3;i++){ctx.fillStyle=col+'25';ctx.fillRect(-26-i*12,-20+stride*2,16,6);}
 if(sprite.complete&&sprite.naturalWidth){ctx.shadowColor=col;ctx.shadowBlur=14;ctx.drawImage(sprite,-30,-68+stride*1.5,60,68);}
 else{rounded(-14,-48,28,45,8,col,'#d2eaff');}
 ctx.restore();
 ctx.fillStyle='#05101de0';ctx.fillRect(x-16,p.y-19,Math.max(45,p.name.length*7),17);
 ctx.fillStyle=col;ctx.font='800 13px Rajdhani, sans-serif';ctx.fillText(p.name,x-12,p.y-6);
 if(state.showHitboxes){ctx.strokeStyle=col;ctx.lineWidth=2;ctx.strokeRect(x,p.y,E.PW,E.PH);}
}
function drawGame(m){
 const cam=m.camera;skyline(cam);
 for(const b of m.level.solids)if(b.x+b.w>cam-30&&b.x<cam+E.W+30)paintBlock(b,cam);
 for(const h of m.level.hazards)if(h.x+h.w>cam-40&&h.x<cam+E.W+40)paintSaw(h,cam,m.time);
 const ordered=[...m.players].sort((a,b)=>Number(a.local)-Number(b.local));for(const p of ordered)paintRunner(p,cam,m.time);
 rounded(13,13,225,48,8,'#06152de8','#3a8eb5');ctx.font='900 18px Barlow Condensed';ctx.fillStyle='#8af4ff';ctx.fillText('CIRCUITO NEÓN',26,35);ctx.font='12px Rajdhani';ctx.fillStyle='#adc9e0';ctx.fillText('La pista no se detiene',26,51);
 rounded(E.W-218,13,203,48,8,'#06152de8','#449876');ctx.fillStyle='#8dffc2';ctx.font='900 18px Barlow Condensed';ctx.fillText('◆ DESPLAZAMIENTO',E.W-201,35);ctx.font='12px Rajdhani';ctx.fillText('Constante · '+E.SCROLL+' px/s',E.W-201,51);
 // Deliberately no red elimination line. Viewport edges alone are the boundaries.
}
function renderRaceHUD(){const m=state.match;if(!m)return;$('distance').textContent=Math.floor(m.camera/12)+' m';$('aliveCount').textContent=m.players.filter(p=>p.alive).length+' / '+m.players.length;
 const current=m.players.map(p=>`${p.id}|${p.alive?'1':'0'}`).join(',');if(renderRaceHUD.last===current)return;renderRaceHUD.last=current;
 $('runnerHUD').innerHTML=m.players.map(p=>`<div class="runnerPill ${p.alive?'':'dead'}" style="--col:${E.COLORS[p.char??0]}"><i></i>${htmlSafe(p.name)} ${p.alive?'✓':'×'}</div>`).join('');}
// Expose limited debug hooks only for repeatable automated smoke tests.
window.GravityPreview={state,engine:E,createLocal,startLocal,selectChar,leave,drawGame,queueFlip};
updateCapacity();updateCount();updateMode();
})();
