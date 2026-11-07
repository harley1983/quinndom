// Pixel woodland scene generator: returns an SVG string drawn on a W x H grid (1 cell = 1 pixel-art pixel).
const fs=require('fs');global.window=global;
eval(fs.readFileSync(require('path').join(__dirname,'../../js/art.js'),'utf8')+';global.AR=Art');
const CATROWS=eval(fs.readFileSync(require('path').join(__dirname,'../../js/art.js'),'utf8').match(/cat: (\[[^\]]*\])/)[1]);
const INK='#5C4A55', INKF='#8FA6A2';
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
const PAL={
 day:{bands:['#9CC9E6','#B4D8EA','#CBE3E6','#E0EADA'],cl:['#F6F2E3','#E5E8D9','#D6DFD2','#FBF8EC','#CBD8CD','#EBEBDC'],hills:['#BBD2C8','#AEC8BE','#A2BEB5'],far:['#CFE0CC','#B7CDBC','#A0BAB3'],farOut:'#8FA6A2'},
 dawn:{bands:['#8A8FC0','#B7A0C4','#E3AFB6','#F6CBA8'],cl:['#FCE9DC','#F1D3CE','#E2BBC0','#FFF4E8','#D5A9B8','#F6DCD0'],hills:['#C9B3BE','#BBA6B6','#A99AAE'],far:['#D8CBCB','#C6BCC2','#B2AEB9'],farOut:'#9C8FA3'},
 night:{bands:['#0A1330','#0F1D45','#17295A','#213A70'],cl:['#46598A','#3C4E7D','#324370','#5F74A6','#2A3A66','#40528A'],hills:['#2F4A6E','#283F62','#223657'],far:['#36527A','#2D4668','#263B5C'],farOut:'#1E2F50'}
};
function mix(a,b,t){const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const A=p(a),B=p(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('')}
function scene(W,H,L,seed,mode){
  const FRONT=mode==='front'||mode==='frontnight',PM=PAL[FRONT?'day':mode],R=rng(seed+(FRONT?991:0)),g=Array.from({length:H},()=>Array(W).fill(null));
  const px=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<W&&y<H)g[y][x]=c};
  const rect=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)px(x+i,y+j,c)};
  // ---- sky: flat bands with a dithered seam
  if(!FRONT){const bands=[[0,PM.bands[0]],[H*.30,PM.bands[1]],[H*.52,PM.bands[2]],[H*.72,PM.bands[3]]];
  for(let y=0;y<H;y++){let c=bands[0][1];bands.forEach(b=>{if(y>=b[0])c=b[1]});for(let x=0;x<W;x++)px(x,y,c);}
  bands.slice(1).forEach(b=>{const y=Math.round(b[0]);const prev=bands[bands.indexOf(b)-1][1];for(let x=0;x<W;x++){if((x+y)%2===0)px(x,y-1,b[1]);if((x+y)%2===1)px(x,y,prev)}});
  if(mode==='night'){const Rn=rng(seed+5);for(let i=0;i<L.stars;i++){const x=Math.floor(Rn()*W),y=Math.floor(Rn()*L.ground*.62),c=Rn()<.12?'#8EF9F3':Rn()<.1?'#FFAFCC':'#EEEEEE';px(x,y,c);if(Rn()<.28){px(x-1,y,'#9AA9CC');px(x+1,y,'#9AA9CC');px(x,y-1,'#9AA9CC');px(x,y+1,'#9AA9CC')}}
    const [mx,my,mr]=L.moon;for(let r=mr+5;r>mr;r--)for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r&&(r-mr)%2===1&&(x+y)%2===0)px(mx+x,my+y,'#2C4A82');
    for(let y=-mr;y<=mr;y++)for(let x=-mr;x<=mr;x++)if(x*x+y*y<=mr*mr){let c=x+y<-mr*.5?'#F7F7EF':'#EEEEEE';if((x*x+y*y)>(mr-1.5)*(mr-1.5))c='#D5DCE2';px(mx+x,my+y,c)}
    [[-3,-3,2],[2,-1,3],[-2,3,2],[4,4,1],[0,-6,1]].forEach(([a,b,r])=>{for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r*.8)px(mx+a+x,my+b+y,'#CBD3DA')});}
  if(mode==='dawn'){const [sx,sy,sr]=L.sun;for(let r=sr+7;r>sr;r--)for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r&&(r-sr)%3===0&&(x+y)%2===0)px(sx+x,sy+y,'#F7C9A4');
    for(let y=-sr;y<=sr;y++)for(let x=-sr;x<=sr;x++)if(x*x+y*y<=sr*sr)px(sx+x,sy+y,y<-sr*.3?'#FFE7B0':'#FFD08A')}}
  // ---- clouds
  function cloud(cx,cy,rx,ry,puffs){
    const cells=new Set(),key=(x,y)=>x+','+y;
    const blobs=[];for(let i=0;i<puffs;i++){const a=(i/(puffs-1))*2-1;blobs.push([cx+a*rx*.8,cy-Math.abs(Math.cos(a*1.3))*ry*.35+(R()-.5)*ry*.3,ry*(.55+R()*.45)*(1-Math.abs(a)*.35)])}
    blobs.push([cx,cy,rx*.62]);
    let minY=1e9,maxY=-1e9;
    blobs.forEach(([bx,by,br])=>{for(let y=Math.floor(by-br);y<=by+br;y++)for(let x=Math.floor(bx-br*1.25);x<=bx+br*1.25;x++){const dx=(x-bx)/1.25,dy=y-by;if(dx*dx+dy*dy<=br*br&&y<=cy+ry*.55){cells.add(key(x,y));minY=Math.min(minY,y);maxY=Math.max(maxY,y)}}});
    cells.forEach(k=>{const [x,y]=k.split(',').map(Number);const t=(y-minY)/(maxY-minY+1);const K=PM.cl;let c=K[0];
      if(t>.72)c=K[1];if(t>.88)c=K[2];if(t<.22&&(x+y)%3===0)c=K[3];if(t>.5&&t<=.72&&R()<.08)c=K[5];
      if(!cells.has(key(x,y+1))&&t>.6)c=K[4];px(x,y,c)});
  }
  if(!FRONT)L.clouds.forEach(c=>cloud(...c));
  // ---- distant hills + far pale trees
  const hy=L.ground-L.hillH;
  for(let x=0;x<W;x++){const h=Math.round(L.hillH*.55+Math.sin(x/(W/9))*L.hillH*.25+Math.sin(x/(W/23)+2)*L.hillH*.15);for(let y=L.ground-h;y<L.ground+4;y++){const t=y-(L.ground-h);if(!FRONT)px(x,y,t<2?PM.hills[0]:t<5?PM.hills[1]:PM.hills[2])}}
  // ---- tree factory
  function pine(cx,top,h,wmax,tone,opts){opts=opts||{};
    const lw=wmax+6,lh=h+2,tg=Array.from({length:lh},()=>Array(lw).fill(null)),ox=Math.round(cx-lw/2);
    const trunkH=opts.trunk||9,body=h-trunkH,n=Math.max(3,Math.round(body/13)),th=Math.ceil(body/n*1.55);
    const [L1,M1,D1]=tone;
    for(let i=0;i<n;i++){const y0=Math.round(i*(body-th)/(n-1||1)),wi=3+(wmax-3)*((i+1)/n)**.85;
      for(let r=0;r<th;r++){const hw=Math.max(0,Math.round((wi/2)*((r+1)/th)**.9+(R()<.35?(R()<.5?-1:1):0)));const y=y0+r;if(y>=body+2)continue;
        for(let x=-hw;x<=hw;x++){let c=x<-hw*.15?L1:x>hw*.35?D1:M1;if(r>=th-2)c=D1;else if(r<2&&x<0)c=L1;if(R()<.1)c=c===L1?M1:c===D1?M1:(R()<.5?L1:D1);tg[y][Math.round(lw/2)+x]=c}}}
    // trunk
    const tw=opts.tw||3;for(let y=body;y<h;y++)for(let x=0;x<tw;x++){const c=x===0?'#9A7A6C':x===tw-1?'#6E5249':'#86675B';tg[y][Math.round(lw/2)-1+x]=c}
    // outline
    const out=opts.far?PM.farOut:INK;const og=tg.map(r=>r.slice());
    for(let y=0;y<lh;y++)for(let x=0;x<lw;x++){if(tg[y][x])continue;const nb=[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>tg[y+b]&&tg[y+b][x+a]);if(nb)og[y][x]=out}
    for(let y=0;y<lh;y++)for(let x=0;x<lw;x++)if(og[y][x])px(ox+x,top+y,og[y][x]);
  }
  const T=(t)=>t==='f'?PM.far:t==='a'?['#C4D8BC','#A7C0AA','#88A8A4']:t==='b'?['#B7CFB8','#9AB7A8','#7D9FA0']:['#CFE0CC','#B7CDBC','#A0BAB3'];
  // far pale trees
  if(!FRONT)L.far.forEach(([x,h,w])=>pine(x,L.ground-h-2,h,w,T('f'),{far:1,trunk:4,tw:2}));
  // ---- banks
  function bank(x0,x1,y){
    for(let x=x0;x<=x1;x++){const e=Math.min(x-x0,x1-x);const yy=y+(e<2?2-e:0);
      px(x,yy,'#86A383');px(x,yy+1,x%7===0?'#6F8F78':'#7E9C7F');
      for(let j=2;j<=5;j++){px(x,yy+j,j<4?'#B28F87':'#A47F7A');if(R()<.18)px(x,yy+j,'#C4A39A');if(R()<.1)px(x,yy+j,'#8E6A68')}
      px(x,yy+6,INK)}
    for(let j=0;j<7;j++){px(x0-1,y+j+1,INK);px(x1+1,y+j+1,INK)}
  }
  // bushes behind banks
  if(FRONT)L.banks.forEach(([x0,x1])=>{for(let x=x0;x<=x1;x++){const h=2+Math.round(Math.abs(Math.sin(x*.7))*3+R()*2);for(let j=0;j<h;j++)px(x,L.ground-1-j,j===h-1?'#8DAA8A':'#7B9B82')}});
  // trees (back to front)
  if(FRONT)L.trees.forEach(([x,h,w,t])=>pine(x,L.ground-h+1,h,w,T(t)));
  if(FRONT)L.banks.forEach(([x0,x1])=>bank(x0,x1,L.ground));
  // ---- lake
  const wy=L.ground+7;
  if(FRONT)for(let y=wy;y<H;y++)for(let x=0;x<W;x++){const t=(y-wy)/(H-wy);px(x,y,t<.3?'#92B7B1':t<.7?'#8AAFAA':'#82A8A4')}
  if(FRONT){for(let x=0;x<W;x++)px(x,wy,INK);
  for(let i=0;i<W*1.1;i++){const x=Math.floor(R()*W),y=wy+2+Math.floor(R()*(H-wy-2)),l=2+Math.floor(R()*6);for(let k=0;k<l;k++)px(x+k,y,'#B6D3CC');}
  for(let i=0;i<W*.4;i++){const x=Math.floor(R()*W),y=wy+3+Math.floor(R()*(H-wy-4));px(x,y,'#7A9F9B');px(x+1,y,'#7A9F9B')}
  L.banks.forEach(([x0,x1])=>{for(let x=x0+2;x<x1-2;x+=3){px(x,wy+2,'#7C9E96');px(x+1,wy+3,'#7C9E96')}});}
  // ---- grass tufts and flowers on banks
  if(FRONT)L.banks.forEach(([x0,x1])=>{for(let x=x0+2;x<x1-1;x+=2+Math.floor(R()*3)){const h=2+Math.floor(R()*4);for(let j=0;j<h;j++){px(x,L.ground-1-j,j<2?'#6E8F78':'#7DA083');if(j>=2)px(x+(R()<.5?-1:1),L.ground-1-j,'#7DA083')}}});
  if(FRONT)L.flowers.forEach(([x,h])=>{for(let j=0;j<h;j++)px(x,L.ground-1-j,'#5F8567');const y=L.ground-h-1;px(x,y,'#C65B53');px(x-1,y,'#E3766B');px(x+1,y,'#E3766B');px(x,y-1,'#EE8D80');px(x-1,y-1,'#E3766B');px(x+1,y-1,'#C65B53');px(x,y+1,'#C65B53')});
  // ---- sign post
  if(FRONT&&L.sign){const [sx,sy,sw]=L.sign;const mx=sx+Math.floor(sw/2)-1;rect(mx-1,sy+8,4,L.ground-sy-7,INK);rect(mx,sy+8,2,L.ground-sy-7,'#86675B');
    rect(sx,sy,sw,8,INK);rect(sx+1,sy+1,sw-2,6,'#D6B48F');for(let x=sx+1;x<sx+sw-1;x++){px(x,sy+1,'#E6C9A4');px(x,sy+6,'#B8946F')}px(sx+2,sy+3,'#9C7A5A');px(sx+sw-3,sy+3,'#9C7A5A')}
  // ---- cat fisher
  if(FRONT&&L.cat){const [cx,cy]=L.cat,P={o:'#3F3036',w:'#FFF8EE',g:'#F0A04B',k:'#4A4650',p:'#F4A9B8',e:'#3F3036',r:'#E3766B',R:'#C65B53',d:'#F4A9B8'};
    const head=CATROWS,body=['..orrrrrrrrrro..','.orrrrrrrrrrrro.','.orrrrrrrrrrrro.','.orrrRrrrrRrrro.','.orrrrrrrrrrrro.','.owwooooooooww o.'.replace(' ',''),'..oo........oo..'];
    [...head,...body].forEach((row,j)=>{for(let i=0;i<16;i++){const ch=row[i];if(ch&&ch!=='.'&&P[ch])px(cx+i,cy+j,P[ch])}});
    // tail
    [[ -1,17],[-2,16],[-2,15],[-1,14]].forEach(([a,b])=>px(cx+a,cy+b,'#F0A04B'));
    // rod + line
    const rx=cx+16,ry=cy+16,tx=rx+L.rod[0],ty=ry-L.rod[1];
    for(let t=0;t<=1;t+=1/60){px(rx+(tx-rx)*t,ry+(ty-ry)*t,'#7E6058')}
    const wy2=wy+9;for(let y=ty;y<wy2;y++)px(tx,y,'#F1EDE0');
    px(tx,wy2,'#E3766B');px(tx-1,wy2,'#E3766B');px(tx,wy2+1,'#C65B53');px(tx-1,wy2+1,'#C65B53');
    for(let k=-3;k<=3;k++)px(tx+k,wy2+3,'#B6D3CC');for(let k=-1;k<=1;k++)px(tx+k,wy2+5,'#B6D3CC');
  }
  // ---- little drifting specks
  if(!FRONT)for(let i=0;i<L.specks;i++){const x=Math.floor(R()*W),y=Math.floor(L.ground*.35+R()*L.ground*.6);if(!g[y][x]||g[y][x].toLowerCase()<'#e0')px(x,y,'#FBF8EC')}
  if(mode==='frontnight'){const f=[.30,.50,.80];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=g[y][x];if(!c)continue;const p=[1,3,5].map((i,k)=>Math.min(255,Math.round(parseInt(c.slice(i,i+2),16)*f[k]+(k===2?14:4))));g[y][x]='#'+p.map(v=>v.toString(16).padStart(2,'0')).join('')}}
  // ---- export: merge horizontal runs
  let out='';for(let y=0;y<H;y++){let x=0;while(x<W){const c=g[y][x];if(!c){x++;continue}let e=x+1;while(e<W&&g[y][e]===c)e++;out+=`<rect x="${x}" y="${y}" width="${e-x}" height="1" fill="${c}"/>`;x=e}}
  return out;
}
function extras(W,H,L){ // night only: moon on the lake and fireflies
  const wy=L.ground+7,[mx]=L.moon;let o='';const rc=(x,y,w,c,a)=>o+=`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}" opacity="${a}"/>`;
  for(let y=wy+3,i=0;y<H-2;y+=3,i++){const w=Math.max(2,9-i);rc(mx-Math.floor(w/2)+(i%2),y,w,'#EEEEEE',.55-i*.04)}
  const R=rng(31);for(let i=0;i<L.flies;i++){const x=Math.floor(R()*W),y=L.ground-8-Math.floor(R()*38);o+=`<rect class="ff" style="animation-delay:${(R()*4).toFixed(1)}s" x="${x}" y="${y}" width="1" height="1" fill="#F7C948"/>`}
  return o}
module.exports={scene,extras};
