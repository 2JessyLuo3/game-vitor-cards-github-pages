// Castle: movable objects, quaternion card rotation and geometric wood cuts.
(() => {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const normalize = q => { const n = Math.hypot(...q); return n ? q.map(v => v / n) : [0, 0, 0, 1]; };
  const multiply = (a, b) => {
    const [x,y,z,w] = a, [u,v,s,t] = b;
    return normalize([w*u+x*t+y*s-z*v, w*v-x*s+y*t+z*u, w*s+x*v-y*u+z*t, w*t-x*u-y*v-z*s]);
  };
  const matrix = q => { const [x,y,z,w] = q; return [1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0,0,0,0,1]; };
  const normalZ = q => 1 - 2 * (q[0] ** 2 + q[1] ** 2);
  function rotate(q, vector) {
    const angle = Math.hypot(...vector); if (!angle) return q;
    const k = Math.sin(angle / 2) / angle;
    return multiply([vector[0]*k, vector[1]*k, vector[2]*k, Math.cos(angle/2)], q);
  }
  function releaseVelocity(samples, now, leverage) {
    const recent = samples.filter(s => now - s.at < 120);
    if (!recent.length) return [0,0,0];
    const age = Math.max(0, now - recent.at(-1).at), velocity = [0,0,0]; let weight = 0;
    for (const s of recent) {
      const w = Math.min(s.dt, .05) * Math.exp(-(now - s.at) / 90); weight += w;
      velocity.forEach((_,i) => velocity[i] += s.v[i] * w);
    }
    if (!weight) return [0,0,0];
    const v = velocity.map(n => n / weight * (.5 + .5 * leverage) * Math.exp(-age / 70));
    const k = Math.min(1, 18 / (Math.hypot(...v) || 1)); return v.map(n => n * k);
  }
  // Intersection of the swept knife tip with the cylinder axis, in local wood coordinates.
  // Only a crossing through the body creates a cut; hovering and end grazes do not.
  function cutPosition(from, to, wood) {
    const c = Math.cos(wood.angle), s = Math.sin(wood.angle);
    const local = p => ({x:(p.x-wood.x)*c+(p.y-wood.y)*s, y:-(p.x-wood.x)*s+(p.y-wood.y)*c});
    const a = local(from), b = local(to), dy = b.y - a.y;
    if (Math.abs(dy) < 1 || a.y * b.y > 0) return null;
    const t = -a.y / dy; if (t < 0 || t > 1) return null;
    const x = a.x + (b.x - a.x) * t, margin = 18;
    if (Math.abs(x) > wood.length / 2 - margin) return null;
    return x + wood.length / 2;
  }
  // Draw the physical cylinder: shaded barrel, grain and circular end faces.
  // The same length and diameter drive rendering, bounds and cutting.
  function drawWood(canvas, length, diameter, seed = 1, cutLeft = false, cutRight = false) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    const scale = Math.min((w-18)/(length+diameter*.55), (h-12)/(diameter+12));
    ctx.save(); ctx.translate(w/2,h/2); ctx.scale(scale,scale);
    const l = -length/2, r = length/2, radius = diameter/2, cap = diameter*.22;
    ctx.shadowColor = '#0007'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 7;
    const gradient = ctx.createLinearGradient(0,-radius,0,radius);
    for (const [stop,color] of [[0,'#664023'],[.24,'#bd8750'],[.47,'#9e6738'],[.82,'#57371e'],[1,'#352617']]) gradient.addColorStop(stop,color);
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.moveTo(l,-radius);ctx.lineTo(r,-radius);ctx.ellipse(r,0,cap,radius,0,-Math.PI/2,Math.PI/2);ctx.lineTo(l,radius);ctx.ellipse(l,0,cap,radius,0,Math.PI/2,Math.PI*1.5);ctx.fill();
    ctx.shadowColor = 'transparent';
    // Deterministic bark marks retain continuity as a piece is shortened.
    for(let i=0;i<11;i++) {
      const y=-radius+(i+.5)/11*diameter;
      ctx.strokeStyle=i%3?'#30201555':'#e2b88355';ctx.lineWidth=i%3?.6:1;
      ctx.beginPath();ctx.moveTo(l+4,y);ctx.bezierCurveTo(l+length*.3,y+Math.sin(i+seed)*1.4,r-length*.25,y-1.2,r-3,y+.8);ctx.stroke();
    }
    for(const [x,cut] of [[l,cutLeft],[r,cutRight]]) {
      ctx.fillStyle=cut?'#d4ae75':'#b58a55';ctx.strokeStyle='#65431f';ctx.lineWidth=.8;
      ctx.beginPath();ctx.ellipse(x,0,cap,radius,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#79532e88';ctx.lineWidth=.7;
      for(const f of [.35,.68]) {ctx.beginPath();ctx.ellipse(x,0,cap*f,radius*f,0,0,Math.PI*2);ctx.stroke();}
    }
    ctx.restore();
  }
  class CastleTable {
    constructor({scene,announce,changed,motion = () => 'normal'}) {
      Object.assign(this,{scene,announce,changed,motion});
      this.workspace=document.getElementById('castle-workspace');this.pieces=document.getElementById('castle-pieces');
      this.toggle=document.getElementById('items-toggle');this.drawer=document.getElementById('items-drawer');this.trash=document.getElementById('castle-trash');
      this.enabled=false;this.open=window.innerWidth>700;this.serial=0;this.cardSerial=0;this.zOrder=0;this.pointer=null;
      drawWood(document.getElementById('wood-preview'),180,30);
      this.toggle.addEventListener('click',()=>this.setOpen(!this.open));
      this.drawer.querySelectorAll('[data-item]').forEach(b=>b.addEventListener('click',()=>this.add(b.dataset.item)));
      document.addEventListener('keydown',e=>{
        if(!this.enabled||this.scene.inert) return;
        if(e.key==='Escape') {this.cancelDrag();if(this.open){this.setOpen(false);this.toggle.focus();}}
      });
      window.addEventListener('resize',()=>this.all().forEach(p=>this.position(p,Number(p.dataset.x),Number(p.dataset.y))));
      window.addEventListener('blur',()=>this.pause());
      document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
    }
    all() {return [...this.pieces.children];}
    setEnabled(value) {
      this.pause();this.enabled=value;this.workspace.hidden=!value;this.toggle.hidden=!value;this.drawer.hidden=!value;this.setOpen(this.open,false);
    }
    setOpen(value,focus=true) {
      const inside=this.drawer.contains(document.activeElement);this.open=value;
      this.scene.classList.toggle('items-open',value&&this.enabled);
      this.toggle.setAttribute('aria-expanded',String(value&&this.enabled));this.toggle.setAttribute('aria-label',value?'Fechar objetos':'Abrir objetos');
      this.drawer.setAttribute('aria-hidden',String(!value||!this.enabled));this.drawer.inert=!value||!this.enabled;
      if(focus&&!value&&inside)this.toggle.focus({preventScroll:true});
      this.all().forEach(p=>this.position(p,Number(p.dataset.x),Number(p.dataset.y)));
    }
    pause() {this.cancelDrag();this.all().forEach(p=>this.stop(p));}
    motionChanged() {if(this.motion()==='reduced')this.pause();}
    reset() {this.pause();this.pieces.replaceChildren();this.serial=0;this.cardSerial=0;this.zOrder=0;this.updateHint();this.changed();}
    count() {return this.pieces.children.length;}
    updateHint() {document.getElementById('castle-hint').textContent=this.count()?'Carta: centro move, bordas giram, toque vira. Ponta da faca corta. Solte na lixeira para descartar.':'Escolha um objeto para colocar na mesa.';}
    add(type) {
      if(!this.enabled||this.scene.inert) return;
      const items={cards:['Carta',null],wood:['Madeira',null],knife:['Faca','knife'],glue:['Cola','glue'],dryer:['Secador','dryer']};
      const item=items[type];if(!item)return;
      const piece=document.createElement('button');piece.type='button';piece.className='castle-piece';piece.dataset.item=type;
      piece.model={id:++this.serial,q:[0,0,0,1],angle:0,length:window.innerWidth<=700?165:220,diameter:28,frame:null,suppress:false,front:true};
      piece.setAttribute('aria-label',`${item[0]} ${this.serial}. Arraste para mover. Delete para descartar.`);
      if(type==='cards')this.makeCard(piece);
      else if(type==='wood')this.makeWood(piece);
      else {const img=document.createElement('img');img.src=`./assets/${item[1]}.webp`;img.alt='';img.draggable=false;piece.append(img);}
      piece.style.zIndex=String(++this.zOrder);this.pieces.append(piece);this.bind(piece);
      // Keep newly created tools away from the working cylinder and cards.
      const locations={wood:[.39,.53],knife:[.62,.40],cards:[.37,.44],glue:[.52,.63],dryer:[.64,.63]};
      const [x,y]=locations[type],offset=(this.serial-1)%3*.035;
      if(window.innerWidth<=700&&this.open)this.setOpen(false,false);
      this.position(piece,x+offset,y+offset);piece.focus({preventScroll:true});
      this.announce(`${item[0]} na mesa.`);this.updateHint();this.changed();return piece;
    }
    makeCard(piece) {
      const suits=['♠','♥','♣','♦'],values=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
      const n=this.cardSerial++,suit=suits[n%4],rank=values[Math.floor(n/4)%13];piece.classList.add('playing-card');
      const rotor=document.createElement('span');rotor.className='playing-rotor';
      const front=document.createElement('span');front.className='playing-face playing-front';if(n%2)front.classList.add('red-suit');
      for(const cls of ['playing-index','playing-suit','playing-index bottom-index']) {const span=document.createElement('span');span.className=cls;span.textContent=cls==='playing-suit'?suit:`${rank}\n${suit}`;front.append(span);}
      const back=document.createElement('span');back.className='playing-face playing-back';
      const mark=document.createElement('span');mark.className='playing-back-mark';mark.textContent='SF';back.append(mark);
      rotor.append(front,back);
      for(const side of ['left','right','top','bottom']) {const e=document.createElement('span');e.className=`playing-edge playing-edge-${side}`;rotor.append(e);}
      piece.append(rotor);piece.model.rotor=rotor;piece.model.label=`Carta ${rank} de ${['espadas','copas','paus','ouros'][n%4]}`;this.apply(piece);
    }
    makeWood(piece) {
      piece.classList.add('wood-piece');const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');piece.append(canvas);piece.model.canvas=canvas;this.renderWood(piece);
    }
    renderWood(piece) {
      const m=piece.model;piece.style.width=`${m.length+m.diameter*.55+18}px`;piece.style.height=`${m.diameter+30}px`;
      m.canvas.width=Math.ceil((m.length+m.diameter*.55+18)*2);m.canvas.height=(m.diameter+30)*2;
      drawWood(m.canvas,m.length,m.diameter,m.seed??m.id,m.cutLeft,m.cutRight);
      piece.style.transform=`translate(-50%, -50%) rotate(${m.angle}rad)`;
    }
    bind(piece) {
      piece.addEventListener('pointerdown',e=>this.down(piece,e));piece.addEventListener('pointermove',e=>this.move(e));
      for(const type of ['pointerup','pointercancel','lostpointercapture'])piece.addEventListener(type,e=>this.end(e));
      piece.addEventListener('click',e=>{
        if(piece.dataset.item!=='cards'||!this.enabled||this.scene.inert)return;
        if(piece.model.suppress){piece.model.suppress=false;return;}
        this.flip(piece);
      });
      piece.addEventListener('keydown',e=>{
        if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();this.discard(piece);return;}
        const steps={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]};
        if(!steps[e.key])return;e.preventDefault();const [x,y]=steps[e.key];this.position(piece,Number(piece.dataset.x)+x,Number(piece.dataset.y)+y);
      });
    }
    position(piece,x,y) {
      const w=this.scene.clientWidth,h=this.scene.clientHeight;if(!w||!h)return;
      const half=piece.offsetWidth/2+8,halfY=piece.offsetHeight/2+8,right=this.open?this.drawer.offsetWidth+25:12;
      const px=clamp(x*w,Math.min(half,w/2),Math.max(half,w-right-half));
      const py=clamp(y*h,Math.min(90+halfY,h/2),Math.max(90+halfY,h-20-halfY));
      piece.dataset.x=String(px/w);piece.dataset.y=String(py/h);piece.style.left=`${px}px`;piece.style.top=`${py}px`;
    }
    center(piece) {return {x:Number(piece.dataset.x)*this.scene.clientWidth,y:Number(piece.dataset.y)*this.scene.clientHeight};}
    knifeTip(piece) {const c=this.center(piece);return {x:c.x-piece.offsetWidth*.4,y:c.y-piece.offsetHeight*.405};}
    down(piece,e) {
      if(!this.enabled||this.scene.inert||this.pointer||!e.isPrimary||e.button!==0)return;
      e.preventDefault();this.stop(piece);piece.model.suppress=false;
      const bounds=this.scene.getBoundingClientRect(),c=this.center(piece),x=e.clientX-bounds.left,y=e.clientY-bounds.top;
      const gx=clamp((x-c.x)/(piece.offsetWidth/2),-1,1),gy=clamp((y-c.y)/(piece.offsetHeight/2),-1,1);
      const mode=piece.dataset.item==='cards'&&(Math.abs(gx)>.55||Math.abs(gy)>.58)?'rotate':'move';
      this.pointer={id:e.pointerId,piece,mode,dx:x-c.x,dy:y-c.y,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,gx,gy,leverage:Math.min(1,Math.hypot(gx,gy)),gain:Math.PI*1.25/piece.offsetWidth,moved:false,samples:[],at:performance.now(),cut:new Set()};
      // Reparenting on pointerdown makes browsers cancel the eventual click.
      piece.style.zIndex=String(++this.zOrder);piece.classList.add('is-grabbed');piece.setPointerCapture(e.pointerId);piece.focus({preventScroll:true});
    }
    move(e) {
      const p=this.pointer;if(!p||p.id!==e.pointerId)return;e.preventDefault();
      if(!p.moved&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<6)return;
      p.moved=true;p.piece.model.suppress=true;
      const now=performance.now(),dx=e.clientX-p.x,dy=e.clientY-p.y;
      if(p.mode==='rotate') {
        const v=[-dy*p.gain,dx*p.gain,(p.gx*dy-p.gy*dx)*p.gain*.9];
        p.piece.model.q=rotate(p.piece.model.q,v);this.apply(p.piece);
        const dt=Math.max(1/240,(now-p.at)/1000);p.samples.push({at:now,dt,v:v.map(n=>n/dt)});if(p.samples.length>6)p.samples.shift();
      } else {
        const b=this.scene.getBoundingClientRect(),old=p.piece.dataset.item==='knife'?this.knifeTip(p.piece):null;
        this.position(p.piece,(e.clientX-b.left-p.dx)/b.width,(e.clientY-b.top-p.dy)/b.height);
        if(old)this.cutSweep(old,this.knifeTip(p.piece),p);
        this.trash.classList.toggle('is-over',this.overTrash(p.piece,e));
      }
      p.x=e.clientX;p.y=e.clientY;p.at=now;
    }
    overTrash(piece,e) {
      const b=this.trash.getBoundingClientRect(),r=piece.getBoundingClientRect(),c={x:r.left+r.width/2,y:r.top+r.height/2};
      const inside=p=>p.x>=b.left-8&&p.x<=b.right+8&&p.y>=b.top-8&&p.y<=b.bottom+8;
      return inside(c)||Boolean(e&&inside({x:e.clientX,y:e.clientY}));
    }
    end(e) {
      const p=this.pointer;if(!p||p.id!==e.pointerId)return;
      const dropped=e.type==='pointerup'&&p.moved&&p.mode==='move'&&this.overTrash(p.piece,e);
      const velocity=e.type==='pointerup'&&p.moved&&p.mode==='rotate'?releaseVelocity(p.samples,performance.now(),p.leverage):[0,0,0];
      if(e.type!=='pointerup')p.piece.model.suppress=true;
      this.cancelDrag(false);
      if(dropped)this.discard(p.piece);else if(p.mode==='rotate')this.spin(p.piece,velocity);
    }
    cancelDrag(cancelled=true) {
      const p=this.pointer;this.pointer=null;this.trash.classList.remove('is-over');
      if(p){if(cancelled)p.piece.model.suppress=true;p.piece.classList.remove('is-grabbed');if(p.piece.hasPointerCapture(p.id))p.piece.releasePointerCapture(p.id);}
    }
    discard(piece) {
      if(this.pointer?.piece===piece)this.cancelDrag();this.stop(piece);piece.remove();this.announce('Peça descartada.');this.updateHint();this.changed();this.toggle.focus({preventScroll:true});
    }
    apply(piece) {
      const m=piece.model,mat=matrix(m.q);m.rotor.style.transform=`matrix3d(${mat.join(',')})`;
      if(Math.abs(mat[10])>1e-6)m.front=mat[10]>0;
      m.rotor.querySelector('.playing-front').setAttribute('aria-hidden',String(!m.front));m.rotor.querySelector('.playing-back').setAttribute('aria-hidden',String(m.front));
      piece.setAttribute('aria-label',`${m.label}. ${m.front?'Frente':'Verso'}. Centro move, bordas giram, toque vira. Delete descarta.`);
    }
    stop(piece) {
      cancelAnimationFrame(piece.model.frame);piece.model.frame=null;piece.classList.remove('is-spinning');
      // A click's upright target survives blur, menu opening and mode changes.
      if(piece.model.flipTarget) {piece.model.q=piece.model.flipTarget;piece.model.flipTarget=null;this.apply(piece);}
    }
    spin(piece,v) {
      this.stop(piece);if(this.motion()==='reduced'||Math.hypot(...v)<.045)return;
      let last=performance.now();piece.classList.add('is-spinning');
      const frame=now=>{
        piece.model.frame=null;
        if(!this.enabled||this.scene.inert||!this.pieces.contains(piece)||this.motion()==='reduced'){this.stop(piece);return;}
        const dt=Math.max(0,(now-last)/1000);last=now;const friction=this.motion()==='fast'?5.8:3.7,decay=Math.exp(-friction*dt);
        let travel=(1-decay)/friction;if(dt>.1)travel=Math.min(travel,.35/(Math.hypot(...v)||1));
        piece.model.q=rotate(piece.model.q,v.map(n=>n*travel));this.apply(piece);v=v.map(n=>n*decay);
        if(Math.hypot(...v)>.045)piece.model.frame=requestAnimationFrame(frame);else this.stop(piece);
      };piece.model.frame=requestAnimationFrame(frame);
    }
    flip(piece) {
      this.stop(piece);const from=piece.model.q,visible=Math.abs(normalZ(from))<1e-6?piece.model.front:normalZ(from)>0;
      const to=visible?[0,1,0,0]:[0,0,0,1],duration=this.motion()==='reduced'?0:this.motion()==='fast'?380:650;
      if(!duration){piece.model.q=to;this.apply(piece);return;}
      let target=to;if(from.reduce((s,v,i)=>s+v*to[i],0)<0)target=to.map(v=>-v);
      piece.model.flipTarget=to;
      const start=performance.now();
      const frame=now=>{
        piece.model.frame=null;if(!this.enabled||this.scene.inert||!this.pieces.contains(piece)){this.stop(piece);return;}
        const t=clamp((now-start)/duration,0,1),k=t*t*(3-2*t);
        piece.model.q=normalize(from.map((v,i)=>v*(1-k)+target[i]*k));this.apply(piece);
        if(t<1)piece.model.frame=requestAnimationFrame(frame);else {piece.model.flipTarget=null;piece.model.q=to;this.apply(piece);}
      };piece.model.frame=requestAnimationFrame(frame);
    }
    cutSweep(from,to,pointer) {
      for(const piece of this.all()) {
        if(piece.dataset.item!=='wood'||pointer.cut.has(piece.model.id))continue;
        const m=piece.model,c=this.center(piece),at=cutPosition(from,to,{...c,length:m.length,angle:m.angle});
        if(at===null)continue;
        const oldRight=m.cutRight,oldLength=m.length,leftLength=at,rightLength=oldLength-at,direction={x:Math.cos(m.angle),y:Math.sin(m.angle)};
        const originalAngle=m.angle,seed=m.seed??m.id;
        m.length=leftLength;m.cutRight=true;this.renderWood(piece);
        this.position(piece,(c.x-direction.x*rightLength/2)/this.scene.clientWidth,(c.y-direction.y*rightLength/2)/this.scene.clientHeight);
        const offcut=document.createElement('button');offcut.type='button';offcut.className='castle-piece';offcut.dataset.item='wood';
        offcut.model={...m,id:++this.serial,length:rightLength,angle:originalAngle+.18,seed,cutLeft:true,cutRight:Boolean(oldRight),frame:null,canvas:null};
        offcut.setAttribute('aria-label',`Madeira ${this.serial}. Pedaço cortado. Arraste para mover. Delete para descartar.`);
        this.makeWood(offcut);offcut.style.zIndex=String(++this.zOrder);this.pieces.append(offcut);this.bind(offcut);
        const separation=m.diameter*1.5;
        this.position(offcut,(c.x+direction.x*leftLength/2-direction.y*separation)/this.scene.clientWidth,(c.y+direction.y*leftLength/2+direction.x*separation)/this.scene.clientHeight);
        pointer.cut.add(m.id);pointer.cut.add(offcut.model.id);
        this.announce('Madeira cortada em dois pedaços.');this.updateHint();this.changed();
      }
    }
  }
  window.VitorCastle={CastleTable,cutPosition,releaseVelocity,normalize,multiply,rotate,normalZ,drawWood};
})();
