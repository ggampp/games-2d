export const FIELD = { w: 1200, h: 780, left: 80, right: 1120, top: 68, bottom: 712, goalTop: 296, goalBottom: 484 };
export const SPEED = 1050;
export function makeBodies(kickoff = 0) {
  const positions = [[135,390],[300,235],[300,545],[435,135],[435,645],[496,298],[496,482]];
  const bodies = [];
  for (let team=0;team<2;team++) positions.forEach(([x,y],i)=> bodies.push({x:team ? 1200-x : x,y,r:i===0?25:23,m:3.6,vx:0,vy:0,team,number:i===0?1:i+3,goalie:i===0}));
  // Move the kickoff player behind the ball so the first flick is immediately useful.
  bodies[kickoff*7+5].x = kickoff ? 678 : 522;
  bodies[kickoff*7+5].y = 390;
  bodies.push({x:600,y:390,r:10,m:0.85,vx:0,vy:0,team:-1,number:0});
  return bodies;
}
export function moving(bodies) { return bodies.some(b=>Math.hypot(b.vx,b.vy)>4); }
export function impulse(body,dx,dy) {
  const len=Math.hypot(dx,dy); const factor=Math.min(len,150)/150*SPEED/(len||1);
  body.vx=dx*factor; body.vy=dy*factor;
}
export function step(bodies,dt,events={}) {
  const f=FIELD;
  for (const b of bodies) {
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    const drag=Math.exp(-(b.team===-1 ? 0.92 : 1.65)*dt);
    b.vx*=drag; b.vy*=drag;
    if(Math.hypot(b.vx,b.vy)<4){b.vx=0;b.vy=0;}
    if(b.y-b.r<f.top){b.y=f.top+b.r;b.vy=Math.abs(b.vy)*0.7;}
    if(b.y+b.r>f.bottom){b.y=f.bottom-b.r;b.vy=-Math.abs(b.vy)*0.7;}
    const inGoal=b.team===-1 && b.y>f.goalTop+b.r && b.y<f.goalBottom-b.r;
    if(inGoal && b.x<f.left-16) return 1;
    if(inGoal && b.x>f.right+16) return 0;
    if(!inGoal){
      if(b.x-b.r<f.left){b.x=f.left+b.r;b.vx=Math.abs(b.vx)*0.7;}
      if(b.x+b.r>f.right){b.x=f.right-b.r;b.vx=-Math.abs(b.vx)*0.7;}
    }
    if(b.team===-1) for(const x of [f.left,f.right]) for(const y of [f.goalTop,f.goalBottom]) {
      let dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy),r=b.r+5;
      if(d<r){dx/=d||1;dy/=d||1;b.x=x+dx*r;b.y=y+dy*r;const v=b.vx*dx+b.vy*dy;if(v<0){b.vx-=1.7*v*dx;b.vy-=1.7*v*dy;}}
    }
  }
  for(let i=0;i<bodies.length;i++) for(let j=i+1;j<bodies.length;j++) {
    const a=bodies[i],b=bodies[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),r=a.r+b.r;
    if(d>=r)continue;
    if(d<0.001){dx=1;dy=0;d=1;}
    const nx=dx/d,ny=dy/d,overlap=r-d;
    a.x-=nx*overlap*b.m/(a.m+b.m);a.y-=ny*overlap*b.m/(a.m+b.m);
    b.x+=nx*overlap*a.m/(a.m+b.m);b.y+=ny*overlap*a.m/(a.m+b.m);
    const v=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
    if(v>=0)continue;
    const force=-(1+0.83)*v/(1/a.m+1/b.m);
    a.vx-=force/a.m*nx;a.vy-=force/a.m*ny;b.vx+=force/b.m*nx;b.vy+=force/b.m*ny;
    events.contact?.(i,j,Math.abs(v));
  }
  return -1;
}
export function chooseAI(bodies,team,difficulty='normal',random=Math.random) {
  const ball=bodies.at(-1),targetX=team===0?1145:55;
  let best=null;
  // Evaluate real physics, including deflections and blocked shots.
  for(let i=team*7;i<team*7+7;i++) for(const goalY of [340,390,440]) {
    const player=bodies[i], gx=targetX-ball.x,gy=goalY-ball.y,len=Math.hypot(gx,gy);
    const aimX=ball.x-gx/len*(player.r+ball.r-3),aimY=ball.y-gy/len*(player.r+ball.r-3);
    const dx=aimX-player.x,dy=aimY-player.y,dist=Math.hypot(dx,dy);
    const power=Math.min(150,45+dist*0.32);
    const copy=bodies.map(b=>({...b}));impulse(copy[i],dx/(dist||1)*power,dy/(dist||1)*power);
    let score=-1e6,touched=false;
    for(let t=0;t<260;t++) {
      const goal=step(copy,1/90,{contact:(a,b)=>{if(a===i&&b===14)touched=true;}});
      if(goal!==-1){score=goal===team?1e6:-1e6;break;}
      if(t===259){const c=copy.at(-1);score=(team===0?c.x-ball.x:ball.x-c.x)*2-Math.abs(c.y-390)*0.15+(touched?180:0)-dist*0.03;}
    }
    if(!best||score>best.score)best={i,dx:dx/(dist||1)*power,dy:dy/(dist||1)*power,score};
  }
  const error=difficulty==='easy'?0.17:difficulty==='hard'?0.015:0.065;
  const angle=(random()-.5)*error,cos=Math.cos(angle),sin=Math.sin(angle);
  return {...best,dx:best.dx*cos-best.dy*sin,dy:best.dx*sin+best.dy*cos};
}
