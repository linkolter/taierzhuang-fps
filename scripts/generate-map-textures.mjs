import fs from 'node:fs';
let seed=1938;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const specs={earth:['#a28f6b','#81704f'],mud_wall:['#b3a17e','#968462'],stone:['#827e70','#56584f'],wood:['#65503a','#3d3025'],roof_tile:['#535953','#333d39'],farmland:['#77714d','#555332'],tunnel_earth:['#796448','#59432e']};
for(const [name,[base,ink]] of Object.entries(specs)){
 let art=`<rect width="256" height="256" fill="${base}"/>`;
 for(let i=0;i<380;i++){const x=random()*256,y=random()*256,r=.5+random()*2.4;art+=`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r*.6).toFixed(1)}" fill="${ink}" opacity="${(.08+random()*.18).toFixed(2)}"/>`;}
 if(name==='stone')for(let row=0;row<5;row++)for(let col=-1;col<5;col++){const x=col*64+(row%2)*32,y=row*52;art+=`<rect x="${x+2}" y="${y+2}" width="60" height="48" rx="7" fill="none" stroke="${ink}" stroke-width="3"/><path d="M${x+8} ${y+8}h43" stroke="#a29c88" opacity=".4"/>`;}
 if(name==='wood')for(let i=0;i<12;i++){const x=i*24;art+=`<path d="M${x} 0q10 64 0 128t0 128" fill="none" stroke="${ink}" stroke-width="${i%3?1:3}" opacity=".6"/>`;}
 if(name==='roof_tile')for(let row=0;row<8;row++)for(let col=0;col<8;col++){const x=col*32,y=row*32;art+=`<path d="M${x+2} ${y}v29q14 7 28 0V${y}" fill="none" stroke="${ink}" stroke-width="3"/><path d="M${x+7} ${y+2}v22" stroke="#81877b" opacity=".45"/>`;}
 if(name==='farmland')for(let x=0;x<256;x+=32)art+=`<path d="M${x} 0v256" stroke="${ink}" stroke-width="9" opacity=".4"/>`;
 if(name==='mud_wall'||name==='tunnel_earth')for(let i=0;i<15;i++){const x=random()*256,y=random()*256;art+=`<path d="M${x.toFixed(1)} ${y.toFixed(1)}l8 9 -4 9 7 6" fill="none" stroke="${ink}" opacity=".3"/>`;}
 fs.mkdirSync(`public/textures/map/${name}`,{recursive:true});fs.writeFileSync(`public/textures/map/${name}/tile.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${art}</svg>`);
}
