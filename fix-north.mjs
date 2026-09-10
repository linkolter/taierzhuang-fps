import fs from 'node:fs';let s=fs.readFileSync('src/map/MapLayout.ts','utf8').replace("width:2.8,from:6,to:29","width:2.8,from:-3,to:29");fs.writeFileSync('src/map/MapLayout.ts',s);
