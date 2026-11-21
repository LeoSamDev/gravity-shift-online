'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('../public/engine');
function match(n=1){return E.createMatch(Array.from({length:n},(_,i)=>({id:i+1,name:'P'+(i+1),char:i,local:true})),7);}
test('camera continues even when player is blocked or eliminated',()=>{
 const m=match();const p=m.players[0];m.level.solids=[{x:0,y:E.H-49,w:2000,h:49,kind:'rail'},{x:200,y:400,w:30,h:120,kind:'block'}];m.level.hazards=[];
 const before=m.camera;for(let i=0;i<110;i++)E.step(m,1/60);
 assert.ok(m.camera>before+400);assert.equal(p.reason,'left');assert.equal(p.alive,false);
 const cam=m.camera;E.step(m,.25);assert.ok(m.camera>cam);
});
test('left limit: exactly when full hitbox leaves the visible screen',()=>{
 const m=match();m.level.solids=[];m.level.hazards=[];const p=m.players[0];
 m.camera=200;p.x=m.camera-E.PW-1; // entire hitbox outside the left edge
 E.step(m,.001);assert.equal(p.alive,false);assert.equal(p.reason,'left');
});
test('upper limit: immediate elimination when hitbox fully above viewport',()=>{
 const m=match();m.level.solids=[];m.level.hazards=[];const p=m.players[0];
 p.y=-E.PH;p.vy=-50;p.g=-1;E.step(m,.001);assert.equal(p.alive,false);assert.equal(p.reason,'top');
});
test('lower limit: immediate elimination when hitbox fully below viewport',()=>{
 const m=match();m.level.solids=[];m.level.hazards=[];const p=m.players[0];
 p.y=E.H;p.vy=50;p.g=1;E.step(m,.001);assert.equal(p.alive,false);assert.equal(p.reason,'bottom');
});
test('solid wall blocks non-lethally; no lethal boundary drawn by engine',()=>{
 const m=match();m.level.solids=[{x:200,y:400,w:35,h:120,kind:'block'}];m.level.hazards=[];
 for(let i=0;i<10;i++)E.step(m,1/60);assert.equal(m.players[0].alive,true);assert.ok(m.players[0].x<=200-E.PW+.01);
});
test('saws are lethal on contact',()=>{
 const m=match();const p=m.players[0];m.level.solids=[];m.level.hazards=[{x:135,y:p.y,w:35,h:35,kind:'saw'}];
 E.step(m,.001);assert.equal(p.alive,false);assert.equal(p.reason,'hazard');
});
test('players have non-lethal physical collisions',()=>{
 const m=match(2);m.level.solids=[];m.level.hazards=[];m.players[1].x=m.players[0].x;m.players[1].y=m.players[0].y;m.players[1].g=m.players[0].g;
 E.step(m,.001);const [a,b]=m.players;
 assert.equal(a.alive,true);assert.equal(b.alive,true);
 assert.ok(a.x+E.PW<=b.x+0.2 || b.x+E.PW<=a.x+0.2);
});
test('12 distinct character indices available',()=>{
 assert.equal(E.NAMES.length,12);assert.equal(E.COLORS.length,12);assert.equal(new Set(E.NAMES).size,12);
});
