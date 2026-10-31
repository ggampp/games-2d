import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELD,makeBodies,impulse,step,moving,chooseAI} from '../src/physics.js';

test('formation has seven discs on each side and one centered ball, with no overlaps',()=>{
  for(const kickoff of [0,1]){
    const b=makeBodies(kickoff);assert.equal(b.length,15);assert.equal(b.filter(p=>p.team===0).length,7);assert.equal(b.filter(p=>p.team===1).length,7);
    assert.equal(b.at(-1).x,600);assert.equal(b.at(-1).y,390);
    for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++)assert.ok(Math.hypot(b[i].x-b[j].x,b[i].y-b[j].y)>=b[i].r+b[j].r);
  }
});
test('slingshot power is capped and friction brings discs to rest',()=>{
  const a=makeBodies()[0],b={...a};impulse(a,150,0);impulse(b,2000,0);assert.equal(a.vx,b.vx);
  const bodies=makeBodies();impulse(bodies[5],-100,0);for(let i=0;i<1500;i++)step(bodies,1/120);assert.equal(moving(bodies),false);
});
test('the kickoff flick transfers momentum to the ball',()=>{
  const bodies=makeBodies();let contacted=false;impulse(bodies[5],70,0);
  for(let i=0;i<60;i++)step(bodies,1/120,{contact:(i,j)=>{if(i===5&&j===14)contacted=true}});
  assert.equal(contacted,true);assert.ok(bodies.at(-1).x>650);
});
test('both goals are detected, with the correct scorer',()=>{
  const b=makeBodies().at(-1);assert.equal(step([{...b,x:FIELD.right+17,y:390}],1/120),0);assert.equal(step([{...b,x:FIELD.left-17,y:390}],1/120),1);
});
test('outside the goal mouth the end line bounces the ball back',()=>{
  const b={...makeBodies().at(-1),x:FIELD.right-9,y:100,vx:300};assert.equal(step([b],1/120),-1);assert.ok(b.vx<0);assert.ok(b.x<=FIELD.right-b.r);
});
test('goalposts stop near-edge shots',()=>{
  const b={...makeBodies().at(-1),x:FIELD.right-8,y:FIELD.goalTop+5,vx:250};assert.equal(step([b],1/120),-1);assert.ok(Number.isFinite(b.x));assert.ok(b.x<FIELD.right);
});
test('AI chooses its own disc and makes a valid, ball-contacting shot',()=>{
  const bodies=makeBodies(1),ai=chooseAI(bodies,1,'hard',()=>.5);assert.ok(ai.i>=7&&ai.i<=13);assert.ok(Number.isFinite(ai.dx));assert.ok(Math.hypot(ai.dx,ai.dy)<=150.001);
  let hit=false;impulse(bodies[ai.i],ai.dx,ai.dy);for(let t=0;t<800;t++){const goal=step(bodies,1/120,{contact:(i,j)=>{if(i===ai.i&&j===14)hit=true}});if(goal!==-1)break}assert.equal(hit,true);
});
test('extended collision simulations stay finite and settle without tunneling out of the table',()=>{
  const bodies=makeBodies();for(let shot=0;shot<12;shot++){const i=shot%14;impulse(bodies[i],Math.cos(shot)*150,Math.sin(shot)*150);for(let f=0;f<1000;f++){const goal=step(bodies,1/120);if(goal!==-1){bodies.splice(0,bodies.length,...makeBodies(1-goal));break;}bodies.forEach(b=>{assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));assert.ok(b.y>=FIELD.top-b.r&&b.y<=FIELD.bottom+b.r);});}}
});
