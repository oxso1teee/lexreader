# Usage: python3 sheets.py <shotsDir> <theme> [cols rows width] -> contact sheets in <shotsDir>/sheets-<theme>/
import sys,os,json,re
from PIL import Image,ImageDraw
d,theme=sys.argv[1],sys.argv[2]
cols,rows,w=(int(x) for x in (sys.argv[3:6] if len(sys.argv)>5 else (5,2,312)))
_cats=os.path.join(os.path.dirname(__file__),'..','cats.json')
order=[n for c,ns in json.load(open(_cats)) for n in ns] if os.path.exists(_cats) else None
src=os.path.join(d,theme)
names=[n for n in (order or sorted(f[:-4] for f in os.listdir(src))) if os.path.exists(os.path.join(src,n+'.png'))]
if len(sys.argv)>6: names=sys.argv[6].split(',')
h=int(w*844/390); out=os.path.join(d,'sheets-'+theme); os.makedirs(out,exist_ok=True)
per=cols*rows
for i in range(0,len(names),per):
    im=Image.new('RGB',(cols*(w+8)+8,rows*(h+22)+8),(120,120,120)); dr=ImageDraw.Draw(im)
    for j,n in enumerate(names[i:i+per]):
        x=8+(j%cols)*(w+8); y=8+(j//cols)*(h+22)
        s=Image.open(os.path.join(src,n+'.png')).convert('RGB').resize((w,h),Image.LANCZOS); im.paste(s,(x,y+14))
        dr.text((x+2,y+1),f'{i+j} {n}',fill=(255,255,255))
    im.save(os.path.join(out,f'sheet-{i//per:02d}.png'))
print(len(names),'screens ->',out)
