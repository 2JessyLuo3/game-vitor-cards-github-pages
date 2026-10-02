/* D10: ten real kite faces, a local draw bag per level, and lightweight tabletop physics.
   No libraries, network access or external assets are needed. */
(() => {
  'use strict';
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  const unit = v => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  function multiply(a,b) {
    const [x,y,z,w]=a,[u,v,s,t]=b;
    return unit([w*u+x*t+y*s-z*v,w*v-x*s+y*t+z*u,w*s+x*v-y*u+z*t,w*t-x*u-y*v-z*s]);
  }
  function turn(q, vector) {
    const angle=Math.hypot(...vector);
    if(!angle) return q;
    const k=Math.sin(angle/2)/angle;
    return multiply([...vector.map(x=>x*k),Math.cos(angle/2)],q);
  }
  function rotate(v,q) {
    const t=cross(q.slice(0,3),v).map(x=>2*x), u=cross(q.slice(0,3),t);
    return v.map((x,i)=>x+q[3]*t[i]+u[i]);
  }
  function align(a,b) {
    const d=dot(a,b);
    if(d < -.99999) return [...unit(cross(a, Math.abs(a[0])<.8?[1,0,0]:[0,0,1])),0];
    return unit([...cross(a,b),1+d]);
  }
  function blend(a,b,t) {
    let d=dot(a,b);
    if(d<0) { b=b.map(x=>-x); d=-d; }
    if(d>.9995) return unit(a.map((x,i)=>x+(b[i]-x)*t));
    const angle=Math.acos(clamp(d,-1,1)), k=Math.sin(angle);
    return a.map((x,i)=>(x*Math.sin((1-t)*angle)+b[i]*Math.sin(t*angle))/k);
  }

  class DiceDeck {
    constructor(questions, random) {
      this.random=random;
      this.total=questions.length;
      this.used=0;
      this.levels=[1,2,3].map(level=>{
        const list=questions.filter(q=>q.level===level).map((q,i)=>({question:q,ordinal:i+1}));
        return {level,slots:Array.from({length:10},(_,i)=>list[i]??null),reserve:list.slice(10),reserveIndex:0};
      });
    }
    available(level) {
      return this.levels.find(b=>b.level===level)?.slots.flatMap((q,i)=>q?[i+1]:[])??[];
    }
    remaining() { return this.total-this.used; }
    draw() {
      const eligible=this.levels.filter(b=>b.slots.some(Boolean));
      if(!eligible.length) return null;
      const bag=eligible[this.random(eligible.length-1)];
      const numbers=this.available(bag.level);
      const number=numbers[this.random(numbers.length-1)];
      const entry=bag.slots[number-1];
      const replacement=bag.reserve[bag.reserveIndex++]??null;
      bag.slots[number-1]=replacement;
      this.used++;
      return {number,level:bag.level,...entry,replacement:replacement?.ordinal??null};
    }
  }

  // A pentagonal trapezohedron: 12 vertices and exactly 10 planar kite faces.
  const H=1.18, A=H*(1-Math.cos(Math.PI/5))/(1+Math.cos(Math.PI/5));
  const vertices=[[0,H,0],[0,-H,0],...Array.from({length:10},(_,i)=>[
    Math.cos(i*Math.PI/5),i%2?-A:A,Math.sin(i*Math.PI/5)
  ])];
  const faces=Array.from({length:10},(_,i)=>{
    const k=Math.floor(i/2)*2+(i%2), indexes=[i%2?1:0,2+k,2+(k+1)%10,2+(k+2)%10];
    const points=indexes.map(j=>vertices[j]);
    const center=points[0].map((_,j)=>points.reduce((s,p)=>s+p[j],0)/4);
    let normal=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
    if(dot(normal,center)<0) { normal=normal.map(x=>-x); indexes.reverse(); }
    const up=unit(sub(points[0],center));
    return {number:i+1,indexes,center,normal,up,right:unit(cross(normal,up))};
  });
  function facePose(number) {
    const face=faces[number-1];
    let q=align(face.normal,[0,1,0]);
    const axis=rotate(face.right,q);
    q=turn(q,[0,Math.atan2(axis[2],axis[0]),0]);
    return q;
  }

  // Resolve a circle against the visible card wall. The old point determines
  // which edge to reflect from; substeps avoid tunnelling at high throw speeds.
  function cardCollision(point, previous, velocity, rect, radius, depth) {
    if(!rect||Math.abs(depth)>radius*1.2) return null;
    const left=rect.left-radius,right=rect.right+radius,top=rect.top-radius,bottom=rect.bottom+radius;
    if(point.x<=left||point.x>=right||point.y<=top||point.y>=bottom) return null;
    const edges=[{axis:'x',value:left,d:Math.abs(point.x-left),sign:-1},
      {axis:'x',value:right,d:Math.abs(point.x-right),sign:1},
      {axis:'y',value:top,d:Math.abs(point.y-top),sign:-1},
      {axis:'y',value:bottom,d:Math.abs(point.y-bottom),sign:1}];
    const edge=edges.find(e=>e.axis==='x'?(e.sign<0?previous.x<=left:previous.x>=right):(e.sign<0?previous.y<=top:previous.y>=bottom))
      ??edges.reduce((a,b)=>a.d<b.d?a:b);
    return {axis:edge.axis,value:edge.value,velocity:edge.sign*Math.max(55,Math.abs(velocity[edge.axis])*.68)};
  }

  class D10Table {
    constructor({scene,canvas,button,floor,cardRect,canRoll,begin,complete,busy,motion,random}) {
      Object.assign(this,{scene,canvas,button,floor,cardRect,canRoll,begin,complete,busy,motion,random});
      this.ctx=canvas.getContext('2d');
      this.enabled=false; this.rolling=false; this.pointer=null; this.frame=null;
      this.q=facePose(1); this.radius=45; this.x=0; this.z=-25; this.h=0;
      this.vx=this.vy=this.vz=0; this.angular=[0,0,0]; this.width=this.height=0;
      button.addEventListener('pointerdown',e=>this.down(e));
      button.addEventListener('pointermove',e=>this.drag(e));
      button.addEventListener('pointerup',e=>this.up(e));
      button.addEventListener('pointercancel',e=>this.cancelPointer(e));
      button.addEventListener('lostpointercapture',e=>this.cancelPointer(e));
      button.addEventListener('click',e=>{
        if(this.suppressClick&&e.detail!==0) { this.suppressClick=false; return; }
        if(this.canRoll()) this.roll();
      });
      window.addEventListener('resize',()=>this.resize());
      window.addEventListener('blur',()=>this.interrupt());
      document.addEventListener('visibilitychange',()=>{if(document.hidden) this.interrupt();});
      if(window.ResizeObserver) { this.observer=new ResizeObserver(()=>this.resize()); this.observer.observe(scene); }
    }
    setEnabled(enabled) {
      this.stop(); this.enabled=enabled;
      for(const e of [this.canvas,this.button,this.floor]) e.hidden=!enabled;
      if(enabled) { this.resize(true); this.draw(); }
    }
    setDisabled(disabled) { this.button.disabled=disabled&&!this.pointer; }
    stop() {
      cancelAnimationFrame(this.frame); this.frame=null;
      this.rolling=false; this.result=null;
      this.releasePointer(); this.vx=this.vy=this.vz=0;
    }
    reset() {
      this.stop(); this.q=facePose(1); this.resize(true); this.draw();
      this.button.setAttribute('aria-label','Rolar dado de 10 lados');
    }
    homeX() { return this.width*(this.height<540&&this.width>this.height?.08:.29); }
    resize(home=false) {
      if(!this.enabled) return;
      const oldWidth=this.width||this.scene.clientWidth, oldHeight=this.height||this.scene.clientHeight;
      this.width=this.scene.clientWidth; this.height=this.scene.clientHeight;
      const layout=this.height<540&&this.width>this.height?'landscape':this.width<600?'mobile':'desktop';
      if(this.layout&&this.layout!==layout&&!this.rolling&&!this.pointer) home=true;
      this.layout=layout;
      this.radius=this.width<600?34:46;
      const bounds=this.scene.getBoundingClientRect(),actions=this.scene.querySelector('.card-actions')?.getBoundingClientRect();
      this.floorY=this.height*(this.height<540?.85:.81);
      if(actions&&this.width<=this.height) this.floorY=Math.min(this.floorY,actions.top-bounds.top-this.radius*1.2-12);
      this.floorY=Math.max(this.height*.6,this.floorY);
      const ratio=Math.min(window.devicePixelRatio||1,2);
      this.canvas.width=Math.round(this.width*ratio); this.canvas.height=Math.round(this.height*ratio);
      this.ctx.setTransform(ratio,0,0,ratio,0,0);
      this.floor.style.top=`${Math.max(0,this.floorY-this.height*.2)}px`;
      if(home) { this.x=this.homeX(); this.z=-28; this.h=this.support(); }
      else { this.x*=this.width/oldWidth; this.h=this.rolling||this.pointer?this.h*this.height/oldHeight:this.support(); }
      this.x=clamp(this.x,-this.width/2+this.radius*1.4,this.width/2-this.radius*1.4);
      this.draw();
    }
    support(q=this.q) { return Math.max(...vertices.map(v=>-rotate(v,q)[1]))*this.radius; }
    project(x,y,z) {
      const distance=Math.max(1100,this.height*1.5);
      const scale=distance/(distance+.84*z-.55*y);
      return {x:this.width/2+x*scale,y:this.floorY+(-.84*y-.55*z)*scale,scale};
    }
    heightAt(screenY,z=this.z) {
      const distance=Math.max(1100,this.height*1.5), delta=screenY-this.floorY;
      return (-delta*(distance+.84*z)-.55*distance*z)/(.84*distance-.55*delta);
    }
    center() { return this.project(this.x,this.h,this.z); }
    releasePointer() {
      const pointer=this.pointer; this.pointer=null;
      this.button.classList.remove('is-grabbed');
      if(pointer&&this.button.hasPointerCapture?.(pointer.id)) this.button.releasePointerCapture(pointer.id);
    }
    down(event) {
      if(!this.enabled||!this.canRoll()||this.pointer||!event.isPrimary||event.button!==0) return;
      const bounds=this.scene.getBoundingClientRect(), center=this.center();
      this.pointer={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,
        offsetX:event.clientX-bounds.left-center.x,offsetY:event.clientY-bounds.top-center.y,
        moved:false,time:performance.now(),samples:[]};
      this.suppressClick=false; this.button.setPointerCapture(event.pointerId);
      this.button.classList.add('is-grabbed'); this.busy(true);
    }
    drag(event) {
      const p=this.pointer;
      if(!p||p.id!==event.pointerId) return;
      if(!p.moved&&Math.hypot(event.clientX-p.startX,event.clientY-p.startY)<6) return;
      p.moved=true; this.suppressClick=true;
      const now=performance.now(), dt=Math.max((now-p.time)/1000,1/240);
      const dx=event.clientX-p.x,dy=event.clientY-p.y;
      this.q=turn(this.q,[-dy*.02,dx*.022,(dx+dy)*.006]);
      const bounds=this.scene.getBoundingClientRect(), before=this.center();
      const targetX=event.clientX-bounds.left-p.offsetX,targetY=event.clientY-bounds.top-p.offsetY;
      this.h=clamp(this.heightAt(targetY),this.support(),this.height*1.2);
      this.x=clamp((targetX-this.width/2)/this.center().scale,-this.width/2+this.radius*1.4,this.width/2-this.radius*1.4);
      this.resolveWall(before,{x:dx/dt,y:dy/dt});
      p.samples.push({at:now,dt,vx:clamp(dx/dt,-1400,1400),vy:clamp(-dy/dt,-1300,1300)});
      p.samples=p.samples.filter(s=>now-s.at<120).slice(-6);
      p.x=event.clientX; p.y=event.clientY; p.time=now;
      this.draw(); event.preventDefault();
    }
    up(event) {
      const p=this.pointer;
      if(!p||p.id!==event.pointerId) return;
      const samples=p.samples.filter(s=>performance.now()-s.at<120), total=samples.reduce((s,v)=>s+v.dt,0);
      const gesture=total?{vx:samples.reduce((s,v)=>s+v.vx*v.dt,0)/total,vy:samples.reduce((s,v)=>s+v.vy*v.dt,0)/total}:null;
      this.releasePointer(); this.busy(false);
      if(p.moved) this.roll(gesture??{vx:0,vy:0});
      // A tap is handled once by the native click (also supports keyboard).
    }
    cancelPointer(event) {
      if(!this.pointer||this.pointer.id!==event.pointerId) return;
      this.suppressClick=true; this.releasePointer(); this.h=this.support(); this.draw(); this.busy(false);
    }
    resolveWall(previous,velocity={x:this.vx,y:-this.vy*.84}) {
      const rect=this.cardRect(), point=this.center();
      const collision=cardCollision(point,previous,velocity,rect,this.radius*.85,this.z);
      if(!collision) return false;
      if(collision.axis==='x') { this.x=(collision.value-this.width/2)/point.scale; this.vx=collision.velocity; }
      else { this.h=this.heightAt(collision.value); this.vy=-collision.velocity/.84; }
      this.h=Math.max(this.support(),this.h);
      this.angular=this.angular.map(v=>-v*.7);
      return true;
    }
    roll(gesture=null) {
      if(!this.enabled||this.rolling||!this.canRoll()) return;
      const result=this.begin(); if(!result) return;
      this.result=result; this.rolling=true; this.busy(true);
      if(this.motion()==='reduced') { this.land(); return; }
      this.vx=gesture?clamp(gesture.vx,-1100,1100):(this.random(1)?1:-1)*(120+this.random(180));
      this.vy=gesture?clamp(gesture.vy*.8,-700,900):360+this.random(160);
      this.vz=(this.random(200)-100)*.7;
      this.h=Math.max(this.support()+8,this.h);
      this.angular=[(this.random(200)-100)*.10,9+this.random(7),(this.random(200)-100)*.09];
      this.started=performance.now(); this.last=this.started;
      this.duration=this.motion()==='fast'?1050:2250;
      this.settling=null;
      const tick=now=>{
        this.frame=null; if(!this.rolling) return;
        const dt=clamp((now-this.last)/1000,0,.05); this.last=now;
        const elapsed=now-this.started;
        if(elapsed>=this.duration-360) {
          if(!this.settling) this.settling={from:[...this.q],to:facePose(result.number),h:this.h};
          const t=clamp((elapsed-(this.duration-360))/360,0,1), ease=1-(1-t)**3;
          this.q=blend(this.settling.from,this.settling.to,ease);
          this.h=this.settling.h+(this.support()-this.settling.h)*ease;
          this.draw();
        } else {
          const steps=Math.max(1,Math.ceil(dt*120));
          for(let i=0;i<steps;i++) this.step(dt/steps);
          this.draw();
        }
        if(elapsed>=this.duration) this.land(); else this.frame=requestAnimationFrame(tick);
      };
      this.frame=requestAnimationFrame(tick);
    }
    step(dt) {
      const before=this.center();
      this.vy-=1450*dt;
      this.x+=this.vx*dt; this.h+=this.vy*dt; this.z+=this.vz*dt;
      this.q=turn(this.q,this.angular.map(v=>v*dt));
      const support=this.support();
      if(this.h<support) {
        this.h=support; if(this.vy<0) this.vy=-this.vy*.43;
        if(Math.abs(this.vy)<55) this.vy=0;
        this.vx*=Math.exp(-5*dt); this.vz*=Math.exp(-5*dt);
        this.angular=this.angular.map(v=>v*Math.exp(-4*dt));
      }
      this.vx*=Math.exp(-.6*dt); this.vz*=Math.exp(-.8*dt);
      this.angular=this.angular.map(v=>v*Math.exp(-.5*dt));
      const wall=this.width/2-this.radius*1.4;
      if(Math.abs(this.x)>wall) { this.x=clamp(this.x,-wall,wall); this.vx=-Math.sign(this.x)*Math.abs(this.vx)*.62; }
      const far=Math.min(150,this.height*.19), near=-Math.min(120,this.height*.12);
      if(this.z>far||this.z<near) { this.z=clamp(this.z,near,far); this.vz=-this.vz*.6; }
      this.resolveWall(before);
    }
    land() {
      if(!this.rolling) return;
      cancelAnimationFrame(this.frame); this.frame=null;
      const result=this.result; this.result=null; this.rolling=false;
      this.q=facePose(result.number); this.h=this.support(); this.vx=this.vy=this.vz=0;
      // Reduced animation still presents the final face, without a throw.
      if(this.motion()==='reduced') { this.x=this.homeX(); this.z=-28; }
      this.resolveWall(this.center()); this.draw();
      this.button.setAttribute('aria-label',`Dado: ${result.number}. Rolar novamente`);
      // Completion starts dealing the card before releasing the UI lock.
      this.complete(result); this.busy(false);
    }
    interrupt() {
      if(this.pointer) this.cancelPointer({pointerId:this.pointer.id});
      if(this.rolling) this.land();
    }
    motionChanged() { if(this.rolling&&this.motion()==='reduced') this.land(); }
    draw() {
      if(!this.enabled||!this.ctx) return;
      const ctx=this.ctx; ctx.clearRect(0,0,this.width,this.height);
      const center=this.center(),ground=this.project(this.x,0,this.z),radius=this.radius*center.scale;
      ctx.save(); ctx.translate(ground.x,ground.y); ctx.scale(1,.25);
      const shadow=ctx.createRadialGradient(0,0,1,0,0,this.radius*(1.3+this.h/300));
      shadow.addColorStop(0,`rgba(0,0,0,${clamp(.65-this.h/900,.16,.6)})`); shadow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=shadow; ctx.beginPath(); ctx.arc(0,0,this.radius*(1.3+this.h/300),0,Math.PI*2); ctx.fill(); ctx.restore();
      const transformed=vertices.map(v=>rotate(v,this.q));
      const projected=transformed.map(v=>this.project(this.x+v[0]*this.radius,this.h+v[1]*this.radius,this.z+v[2]*this.radius));
      const camera=[0,.55,-.84];
      const visible=faces.map(face=>({face,normal:rotate(face.normal,this.q),center:rotate(face.center,this.q)}))
        .filter(f=>dot(f.normal,camera)>.005).sort((a,b)=>dot(a.center,camera)-dot(b.center,camera));
      for(const {face,normal,center:fc} of visible) {
        const light=clamp(dot(normal,unit([-.5,.9,-.6])),0,1), tone=Math.round(36+light*65);
        ctx.beginPath(); face.indexes.forEach((index,i)=>{const p=projected[index]; if(!i) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);}); ctx.closePath();
        ctx.fillStyle=`rgb(${tone},${tone+3},${tone+6})`; ctx.fill();
        ctx.strokeStyle='#c8b997'; ctx.lineWidth=Math.max(.8,center.scale); ctx.stroke();
        const right=rotate(face.right,this.q),up=rotate(face.up,this.q);
        const origin=this.project(this.x+fc[0]*this.radius,this.h+fc[1]*this.radius,this.z+fc[2]*this.radius);
        const px=this.project(this.x+(fc[0]+right[0]*.32)*this.radius,this.h+(fc[1]+right[1]*.32)*this.radius,this.z+(fc[2]+right[2]*.32)*this.radius);
        const py=this.project(this.x+(fc[0]-up[0]*.32)*this.radius,this.h+(fc[1]-up[1]*.32)*this.radius,this.z+(fc[2]-up[2]*.32)*this.radius);
        ctx.save(); ctx.transform(px.x-origin.x,px.y-origin.y,py.x-origin.x,py.y-origin.y,origin.x,origin.y);
        ctx.fillStyle='#fff9e9'; ctx.font='600 1.25px Trebuchet MS, Segoe UI, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(String(face.number),0,0); if(face.number===6||face.number===9) {ctx.fillRect(-.3,.7,.6,.045);} ctx.restore();
      }
      this.canvas.style.zIndex=this.z>this.radius*.35?'4':'7';
      this.button.style.zIndex=this.z>this.radius*.35?'5':'8';
      this.button.style.left=`${center.x}px`; this.button.style.top=`${center.y}px`;
      this.button.style.width=`${Math.max(56,radius*2.5)}px`; this.button.style.height=`${Math.max(56,radius*2.5)}px`;
    }
  }
  window.VitorDice={DiceDeck,D10Table,geometry:{vertices,faces},cardCollision};
})();
