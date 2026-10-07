const http=require('http'),fs=require('fs'),path=require('path');const {WebSocketServer}=require('ws');
const HTML=()=>fs.readFileSync(path.join(__dirname,'public','index.html'));
const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(HTML())});
const wss=new WebSocketServer({server});
const MAP={AREAS:[{n:'School 1',x:40,y:40,w:320,h:240,c:'#c9a27a'},{n:'School 2',x:440,y:40,w:320,h:240,c:'#b98f8f'},{n:'School 3',x:40,y:360,w:320,h:240,c:'#8fa9b9'},{n:'Football Field',x:40,y:900,w:720,h:260,c:'#3f8f4a'},{n:'Entrance',x:260,y:1240,w:280,h:140,c:'#b8b08a'}],
PATHS:[[[200,280],[200,330],[560,330],[560,400]],[[600,280],[600,330]],[[360,480],[480,480]],[[560,560],[560,900]],[[400,1160],[400,1240]]],DOME:{x:560,y:480,r:80}};
const Q=[['Organize books',100,100],['Clean the classroom',250,200],['Arrange desks',300,100],['Turn on lights',120,230],['Repair computer',500,100],['Organize documents',700,200],['Organize science equipment',650,100],['Repair lights',480,230],['Collect trash',100,420],['Clean whiteboard',250,540],['Organize lab shelf',300,420],['Repair projector',110,540],['Collect footballs',150,980],['Fix goal net',700,1030],['Clean the field',400,1030],['Repair equipment',600,950],['Mark field lines',250,1120],['Check entrance gate',400,1300],['Sweep front yard',300,1350],['Water the plants',500,1330]];
const TEAM={pigeon:'Pigeon Team',eater:'Neutral',gunman:'Good Team',seller:'Good Team',normal:'Good Team'};
const rooms={},CD=20000,SPD=5,sh=a=>a.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),send=(p,o)=>{if(p.ws.readyState==1)p.ws.send(JSON.stringify(o))};
const all=r=>[...r.ps.values()],alive=r=>all(r).filter(p=>p.alive);
const mkcode=()=>{let c;do c=Array.from({length:6},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random()*32|0]).join('');while(rooms[c]);return c};
function fix(r){const c=r.cfg;c.normal=Math.max(0,r.ps.size-c.pigeon-c.eater-c.gunman-c.seller)}
function lobby(r){for(const p of all(r))send(p,{t:'L',code:r.code,host:r.host,me:p.id,n:r.ps.size,cfg:r.cfg,players:all(r).map(x=>({id:x.id,name:x.name}))})}
function bcast(r){const now=Date.now(),pl=alive(r).map(p=>({id:p.id,name:p.name,x:p.x|0,y:p.y|0,v:p.vote?1:0}));
for(const p of all(r)){if(!p.conn)continue;send(p,{t:'S',st:r.state,pl,bodies:r.bodies.map(b=>({id:b.id,x:b.x,y:b.y})),left:r.state=='meeting'?Math.max(0,r.mEnd-now)/1000|0:0,
me:{id:p.id,role:p.role,alive:p.alive,k:Math.max(0,p.k-now)/1000|0,shot:p.shot,rev:p.revived,em:p.emer,vote:p.vote||null,q:p.q.map(i=>({id:i,n:Q[i][0],x:Q[i][1],y:Q[i][2],d:p.done.has(i)}))}})}}
function start(r){const n=r.ps.size,c=r.cfg,s=c.pigeon+c.eater+c.gunman+c.seller+c.normal;
if(n<6||n>15)return 'Need 6-15 players';if(s!=n)return 'Roles must total '+n;if(c.pigeon+c.eater<1)return 'Need a Pigeon or Big Eater';
const roles=sh(Object.entries(c).flatMap(([k,v])=>Array(v).fill(k)));let i=0;
for(const p of all(r)){Object.assign(p,{role:roles[i++],alive:true,x:300+Math.random()*200,y:1260+Math.random()*100,dx:0,dy:0,k:Date.now()+12000,shot:false,revived:false,emer:false,vote:null,done:new Set(),q:sh([...Q.keys()]).slice(0,3+(Math.random()*2|0))});
send(p,{t:'start',role:p.role,map:MAP})}
r.state='play';r.bodies=[];r.winner=null}
function end(r,w){r.state='over';r.winner=w;for(const p of all(r))send(p,{t:'O',winner:w,host:r.host,me:p.id,reveal:all(r).map(x=>({name:x.name,role:x.role,team:TEAM[x.role],alive:x.alive}))})}
function win(r){if(r.state=='over'||r.state=='lobby')return;const a=alive(r),P=a.filter(p=>p.role=='pigeon').length,E=a.filter(p=>p.role=='eater').length,G=a.length-P-E;
if(!P&&!E)end(r,'Good Team');else if(!E&&P>=G)end(r,'Pigeon Team');else if(!P&&G<=1)end(r,'Big Eater')}
function meet(r){if(r.state!='play')return;r.state='meeting';r.bodies=[];r.mEnd=Date.now()+60000;const a=alive(r);
a.forEach((p,i)=>{p.vote=null;p.dx=p.dy=0;const g=i/a.length*6.283;p.x=MAP.DOME.x+Math.cos(g)*45;p.y=MAP.DOME.y+Math.sin(g)*45});}
function endMeet(r){const t={};let ej=null;for(const p of alive(r))if(p.vote)t[p.vote]=(t[p.vote]||0)+1;
const e=Object.entries(t).sort((a,b)=>b[1]-a[1]);let txt='Nobody was ejected.';
if(e.length&&e[0][0]!='skip'&&(!e[1]||e[1][1]<e[0][1])){const v=r.ps.get(e[0][0]);if(v){v.alive=false;txt=v.name+' was ejected.'}}
for(const p of all(r)){p.vote=null;p.k=Math.max(p.k,Date.now()+10000);send(p,{t:'R',m:txt})}r.state='play';win(r)}
function chat(r,p,text){if(r.state!='meeting'||!text)return;const m={t:'C',from:p.name,m:String(text).slice(0,120),dead:!p.alive};
for(const q of all(r))if(q.conn&&q.alive==p.alive)send(q,m)}
function near(r,p,rng,f=()=>true){let b=null,bd=rng;for(const q of alive(r)){if(q==p||!f(q))continue;const x=d(p,q);if(x<=bd){bd=x;b=q}}return b}
function nearBody(r,p,rng=90){return r.bodies.find(b=>d(b,p)<=rng)}
function msg(p,m){const r=rooms[p.room];if(!r)return;
if(m.t=='cfg'){if(p.id!=r.host||r.state!='lobby')return;for(const k of ['pigeon','eater','gunman','seller','normal'])if(Number.isInteger(m.cfg?.[k]))r.cfg[k]=Math.max(0,Math.min(15,m.cfg[k]));return lobby(r)}
if(m.t=='start'){if(p.id!=r.host||r.state!='lobby')return;const e=start(r);if(e)send(p,{t:'err',m:e});return}
if(m.t=='lobby'||m.t=='again'){if(p.id!=r.host||r.state!='over')return;r.state='lobby';fix(r);for(const q of all(r))q.role=null;
if(m.t=='again'){const e=start(r);if(e){r.state='lobby';send(p,{t:'err',m:e})}else return}return lobby(r)}
if(m.t=='chat')return chat(r,p,m.m);
if(!p.alive)return;
if(m.t=='mv'){if(r.state=='play'){const x=+m.dx||0,y=+m.dy||0,l=Math.hypot(x,y);p.dx=l>1?x/l:x;p.dy=l>1?y/l:y}return}
if(r.state=='meeting'){if(m.t=='vote'&&!p.vote&&(m.id=='skip'||(r.ps.get(m.id)?.alive))){p.vote=m.id;if(alive(r).filter(q=>q.conn).every(q=>q.vote))endMeet(r)}return}
if(r.state!='play')return;const now=Date.now();
if(m.t=='kill'&&p.role=='pigeon'&&now>=p.k){const v=near(r,p,70);if(!v)return;v.alive=false;v.bid=Math.random().toString(36).slice(2);r.bodies.push({id:v.bid,x:v.x,y:v.y});p.k=now+CD;win(r)}
else if(m.t=='eat'&&p.role=='eater'&&now>=p.k){const v=near(r,p,70);if(!v)return;v.alive=false;p.k=now+CD;win(r)}
else if(m.t=='shoot'&&p.role=='gunman'&&!p.shot){const v=near(r,p,200);if(!v)return;p.shot=true;v.alive=false;if(TEAM[v.role]=='Good Team')p.alive=false;win(r)}
else if(m.t=='report'){if(nearBody(r,p))meet(r)}
else if(m.t=='emergency'){if(!p.emer&&Math.hypot(p.x-MAP.DOME.x,p.y-MAP.DOME.y)<MAP.DOME.r+40){p.emer=true;meet(r)}}
else if(m.t=='revive'&&p.role=='seller'&&!p.revived){const b=nearBody(r,p);if(!b)return;const v=[...r.ps.values()].find(q=>!q.alive&&q.conn&&q.bid==b.id);if(!v)return;p.revived=true;v.alive=true;v.x=b.x;v.y=b.y;r.bodies=r.bodies.filter(x=>x!=b)}
else if(m.t=='task'){const i=p.q.find(i=>!p.done.has(i)&&Math.hypot(Q[i][1]-p.x,Q[i][2]-p.y)<70);if(i==null)return;p.done.add(i);
const g=all(r).filter(q=>TEAM[q.role]=='Good Team'&&q.alive);if(g.length&&g.every(q=>q.q.every(i=>q.done.has(i))))end(r,'Good Team')}}
wss.on('connection',ws=>{let p=null;
ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}if(!m||typeof m!='object')return;
if(!p){const name=String(m.name||'').trim().slice(0,12);if(!name)return ws.send(JSON.stringify({t:'err',m:'Enter a name'}));let r;
if(m.t=='create'){const c=mkcode();r=rooms[c]={code:c,ps:new Map(),state:'lobby',bodies:[],cfg:{pigeon:1,eater:1,gunman:1,seller:1,normal:2}}}
else if(m.t=='join'){r=rooms[String(m.code||'').toUpperCase().trim()];if(!r)return ws.send(JSON.stringify({t:'err',m:'Room not found'}));
if(r.state!='lobby')return ws.send(JSON.stringify({t:'err',m:'Game already started'}));if(r.ps.size>=15)return ws.send(JSON.stringify({t:'err',m:'Room full'}))}else return;
p={id:Math.random().toString(36).slice(2,10),name,ws,room:r.code,conn:true,alive:false,q:[],done:new Set(),x:0,y:0,k:0};r.ps.set(p.id,p);if(!r.host)r.host=p.id;fix(r);return lobby(r)}
try{msg(p,m)}catch(e){console.error(e)}});
ws.on('close',()=>{if(!p)return;const r=rooms[p.room];if(!r)return;p.conn=false;
if(r.state=='lobby'){r.ps.delete(p.id);fix(r)}else{if(p.alive){p.alive=false}}
const live=all(r).filter(q=>q.conn);if(!live.length){delete rooms[r.code];return}
if(r.host==p.id)r.host=live[0].id;
if(r.state=='lobby')lobby(r);else{win(r);if(r.state=='meeting'&&alive(r).filter(q=>q.conn).every(q=>q.vote))endMeet(r)}})});
let tk=0;setInterval(()=>{tk++;for(const r of Object.values(rooms)){if(r.state=='play')for(const p of alive(r)){p.x=Math.max(0,Math.min(800,p.x+p.dx*SPD));p.y=Math.max(0,Math.min(1400,p.y+p.dy*SPD))}
if(r.state=='meeting'&&Date.now()>r.mEnd)endMeet(r);if((r.state=='play'||r.state=='meeting')&&tk%2==0)bcast(r)}},50);
server.listen(process.env.PORT||3000,()=>console.log('Listening'));
