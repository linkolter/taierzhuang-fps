"""Build web-ready copies; never rewrite the user's downloaded source files."""
from pathlib import Path
from PIL import Image
import hashlib,json,sys

source=Path(sys.argv[1] if len(sys.argv)>1 else r'D:\下载\材质贴图')
target=Path('public/textures/village');target.mkdir(parents=True,exist_ok=True)
records=[]
for folder in sorted(p for p in source.iterdir() if p.is_dir()):
 files=list(folder.rglob('*'))
 colors=[p for p in files if '_diff_' in p.name or '_albedo_' in p.name]
 if not colors:continue
 color=colors[0];asset=color.name.split('_diff_')[0].split('_albedo_')[0]
 inputs={'albedo':color,'normal':next(p for p in files if '_nor_gl_' in p.name),'arm':next(p for p in files if '_arm_' in p.name)}
 output=target/asset;output.mkdir(exist_ok=True);maps={}
 for channel,path in inputs.items():
  image=Image.open(path).convert('RGB');original=image.size
  size=1024 if channel=='albedo' else 512
  image=image.resize((size,size),Image.Resampling.LANCZOS)
  # Lossless WebP preserves data-map channels. Colour receives perceptual compression.
  dest=output/f'{channel}.webp'
  image.save(dest,'WEBP',lossless=channel!='albedo',quality=88,method=6)
  maps[channel]={'source':str(path.relative_to(source)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceSize':original,'size':[size,size],'bytes':dest.stat().st_size}
 records.append({'id':asset,'maps':maps})
(target/'manifest.json').write_text(json.dumps({'source':str(source),'normalConvention':'OpenGL','armChannels':'R=AO, G=roughness, B=metallic','assets':records},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'sets':len(records),'images':len(records)*3,'bytes':sum(m['bytes'] for r in records for m in r['maps'].values())}))
