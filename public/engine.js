(function(root,make){
  const engine=make();
  if(typeof module==='object' && module.exports)module.exports=engine;
  root.GravityEngine=engine;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const W=960,H=520,PW=46,PH=59,SPEED=258,SCROLL=256,GRAVITY=1500,FLIP_V=580;
const NAMES=['Courier','Racer','Astronauta','Scout','Ninja','Engineer','Android','Biker','Pilot','Diver','Stealth','Retrobot'];
const COLORS=['#38e7ff','#ff5faf','#ffd05c','#a1ff56','#af79ff','#ff9a4b','#e5f9ff','#ff4c6c','#448fff','#41e8ce','#d17bff','#a9cdfd'];
function rand(seed){let a=seed>>>0;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296;};}
function buildLevel(seed=7){
 const r=rand(seed),solids=[],hazards=[];
 // Solid rails have gaps in both orientations. No invisible floor or ceiling.
 const length=38000;
 for(let i=0;i<76;i++){
   const x=i*520;
   const gapB=i===0?0:i%3===2?108: i%7===4?80:0;
   const gapT=i===0?0:i%4===3?118:i%9===5?80:0;
   if(gapB===0)solids.push({x,y:H-49,w:520,h:49,kind:'rail'});
   else {solids.push({x,y:H-49,w:260,h:49,kind:'rail'});solids.push({x:x+260+gapB,y:H-49,w:260-gapB,h:49,kind:'rail'});}
   if(gapT===0)solids.push({x,y:0,w:520,h:49,kind:'rail'});
   else {solids.push({x,y:0,w:194,h:49,kind:'rail'});solids.push({x:x+194+gapT,y:0,w:326-gapT,h:49,kind:'rail'});}
 }
 // Majority of obstacles are non-fatal blocks and grilles, including midway platforms.
 for(let i=0;i<150;i++){
   const x=620+i*247;
   const placement=i%9;
   if(placement===8 || placement===5 && i>10){
     const top=placement===8;
     hazards.push({x:x+8,y:top?50:H-88,w:35,h:35,kind:'saw'});
   } else if(placement===3){
     solids.push({x,y:196+(i%3)*25,w:68,h:18,kind:'bridge'});
   } else if(placement===6){
     solids.push({x,y:198,w:25,h:110,kind:'grille'});
   } else {
     const top=(placement%2===1);
     const h=56+Math.floor(r()*3)*20;
     solids.push({x,y:top?49:H-49-h,w:30+Math.floor(r()*3)*10,h,kind:'block'});
   }
 }
 solids.sort((a,b)=>a.x-b.x);hazards.sort((a,b)=>a.x-b.x);
 return {length,solids,hazards,seed};
}
function createPlayer(id,name,char,local=false){return {id,name,char,local,x:134,y:H-49-PH,vy:0,g:1,alive:true,score:0,reason:'',grounded:true,flipQueued:false,bot:false,blocked:0};}
function createMatch(players,seed=7){return {camera:0,time:0,seed,level:buildLevel(seed),players:players.map((p,i)=>({...createPlayer(p.id,p.name,p.char,p.local),bot:!!p.bot,x:145+Math.floor(i/2)*52,y:i%2===1?49:H-49-PH,g:i%2===1?-1:1})),ended:false,contactCount:0,score:0};}
function aabb(a,b){return a.x<b.x+b.w&&a.x+PW>b.x&&a.y<b.y+b.h&&a.y+PH>b.y;}
function touchHazard(p,h){const cx=h.x+h.w/2,cy=h.y+h.h/2, px=Math.max(p.x,Math.min(cx,p.x+PW)),py=Math.max(p.y,Math.min(cy,p.y+PH));return (px-cx)**2+(py-cy)**2<(h.w*.43)**2;}
function localSolids(level,x){return level.solids.filter(s=>s.x<x+PW+70 && s.x+s.w>x-70);}
function eliminate(p,why){if(!p.alive)return;p.alive=false;p.reason=why;}
function flip(match,id){const p=match.players.find(p=>p.id===id);if(p?.alive)p.flipQueued=true;}
function simulate(match,dt){
 if(!(dt>0))return;
 dt=Math.min(dt,1/30);
 match.time+=dt;
 // Camera advances regardless of player collisions or elimination.
 match.camera+=SCROLL*dt;
 const m=match;
 for(const p of m.players){
  if(!p.alive)continue;
  if(p.bot && (p.blocked>.12 || (Math.floor((m.time+p.id*.71)/1.52)>Math.floor((m.time-dt+p.id*.71)/1.52)))) p.flipQueued=true;
  if(p.flipQueued){p.g*=-1;p.vy=p.g*FLIP_V;p.grounded=false;p.flipQueued=false;p.blocked=0;}
  const near=localSolids(m.level,p.x);
  let nx=p.x+SPEED*dt;let hitWall=false;
  for(const s of near){
   if(p.y+PH<=s.y+.1 || p.y>=s.y+s.h-.1)continue;
   if(p.x+PW<=s.x+.15 && nx+PW>s.x){nx=Math.min(nx,s.x-PW);hitWall=true;}
  }
  p.x=nx;
  p.blocked=hitWall?p.blocked+dt:0;
  const oldY=p.y;
  p.vy=Math.min(1000,Math.max(-1000,p.vy+p.g*GRAVITY*dt));
  let ny=p.y+p.vy*dt;
  p.grounded=false;
  for(const s of localSolids(m.level,p.x)){
   if(p.x+PW<=s.x+.1 || p.x>=s.x+s.w-.1)continue;
   if(oldY+PH<=s.y+.1 && ny+PH>=s.y){ny=Math.min(ny,s.y-PH);p.vy=0;p.grounded=true;}
   else if(oldY>=s.y+s.h-.1 && ny<=s.y+s.h){ny=Math.max(ny,s.y+s.h);p.vy=0;p.grounded=true;}
  }
  p.y=ny;
  // Visible viewport limits. Die the instant the ENTIRE hitbox leaves left, top or bottom.
  if(p.x+PW<=m.camera)eliminate(p,'left');
  else if(p.y+PH<=0)eliminate(p,'top');
  else if(p.y>=H)eliminate(p,'bottom');
  if(!p.alive)continue;
  for(const h of m.level.hazards){if(h.x>p.x+PW+40)break;if(h.x+h.w<p.x-40)continue;if(touchHazard(p,h)){eliminate(p,'hazard');break;}}
  p.score=Math.max(0,Math.round((p.x-134)/12));
 }
 // Physical, nonlethal character-to-character hitboxes (no pass-through).
 for(let pass=0;pass<5;pass++){
  for(let i=0;i<m.players.length;i++)for(let j=i+1;j<m.players.length;j++){
   const a=m.players[i],b=m.players[j];if(!a.alive||!b.alive||!aabb(a,{x:b.x,y:b.y,w:PW,h:PH}))continue;
   m.contactCount++;
   const overlapX=Math.min(a.x+PW-b.x,b.x+PW-a.x),overlapY=Math.min(a.y+PH-b.y,b.y+PH-a.y);
   if(overlapX<=0||overlapY<=0)continue;
   // X separation allows runners to obstruct one another like solid obstacles.
   const left=a.x+PW/2<=b.x+PW/2 || Math.abs(a.x-b.x)<.01&&a.id<b.id;
   const adjust=(overlapX+.04)/2;
   if(left){a.x-=adjust;b.x+=adjust;}else{a.x+=adjust;b.x-=adjust;}
  }
 }
 // Re-evaluate boundary after hitbox separation.
 for(const p of m.players)if(p.alive){
  if(p.x+PW<=m.camera)eliminate(p,'left');
  else if(p.y+PH<=0)eliminate(p,'top');
  else if(p.y>=H)eliminate(p,'bottom');
 }
 m.score=Math.floor(m.camera/12);
 if(!m.ended && m.players.every(p=>!p.alive)){m.ended=true;m.endedAt=m.time;}
}
function step(match,dt){let t=Math.min(dt,.2);while(t>0){const d=Math.min(1/120,t);simulate(match,d);t-=d;}}
function snapshot(m){return {camera:m.camera,time:m.time,ended:m.ended,score:m.score,players:m.players.map(p=>({id:p.id,x:p.x,y:p.y,g:p.g,alive:p.alive,char:p.char,name:p.name,score:p.score,reason:p.reason,grounded:p.grounded}))};}
return {W,H,PW,PH,SPEED,SCROLL,GRAVITY,FLIP_V,NAMES,COLORS,buildLevel,createPlayer,createMatch,flip,simulate,step,snapshot,eliminate,aabb};
});
