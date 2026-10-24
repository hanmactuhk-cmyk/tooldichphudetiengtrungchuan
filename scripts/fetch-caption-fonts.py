"""Build the bundled Vietnamese font pack from Google Fonts (OFL). Requires fonttools."""
import json,re,urllib.request,urllib.parse,io,hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'public/fonts';out.mkdir(parents=True,exist_ok=True)
families=['bevietnampro','roboto','robotocondensed','opensans','notosans','notoserif','montserrat','inter','manrope','oswald','anton','bangers','barlow','barlowcondensed','chakrapetch','dosis','exo2','josefinsans','merriweather','playfairdisplay','quicksand','lexend','archivo','archivoblack','asap','bitter','comfortaa','lobster','pacifico','patrickhand','dancingscript','caveat','baloo2','sairacondensed','teko','nunito']
# All precomposed Vietnamese tone letters, plus base letters and accents.
sample='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzĂăÂâĐđÊêÔôƠơƯưÀÁẢÃẠằắẳẵặẦẤẨẪẬèéẻẽẹỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌỒỐỔỖỘỜỚỞỠỢÙÚỦŨỤỪỨỬỮỰỲÝỶỸỴàáảãạầấẩẫậÈÉẺẼẸềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ'
def get(url):
 with urllib.request.urlopen(url,timeout=60) as r:return r.read()
def download(key):
 try:
  base='https://raw.githubusercontent.com/google/fonts/main/ofl/'+key+'/'
  meta=get(base+'METADATA.pb').decode();name=re.search(r'^name: "([^"]+)"',meta).group(1)
  entries=re.findall(r'fonts \{(.*?)\n\}',meta,re.S);picked=[]
  for style,weight in [('normal',400),('normal',700),('italic',400),('italic',700)]:
   candidates=[]
   for e in entries:
    fn=re.search(r'filename: "([^"]+)"',e);es=re.search(r'style: "([^"]+)"',e);ew=re.search(r'weight: (\d+)',e)
    if fn and es and es.group(1)==style:candidates.append((fn.group(1),int(ew.group(1)) if ew else 400))
   if not candidates:continue
   variable=next((v for v in candidates if '[' in v[0]),None);filename=(variable or min(candidates,key=lambda v:abs(v[1]-weight)))[0]
   if not variable and min(abs(v[1]-weight) for v in candidates)>0:continue
   raw=get(base+urllib.parse.quote(filename));font=TTFont(io.BytesIO(raw));cmap=font.getBestCmap();missing=[c for c in sample if ord(c) not in cmap]
   if missing:raise ValueError('Missing Vietnamese: '+''.join(missing))
   if 'fvar' in font:
    axes={a.axisTag:a.defaultValue for a in font['fvar'].axes};axes.update({'wght':weight} if 'wght' in axes else {});font=instantiateVariableFont(font,axes,inplace=False)
   # Static family naming prevents variable / typographic family aliases in libass.
   sub=('Bold' if weight==700 else 'Regular')+(' Italic' if style=='italic' else '')
   for n in font['name'].names:
    if n.nameID in [1,2,4,6,16,17]:
     val={1:name,2:sub,4:name+' '+sub,6:key+'-'+sub.replace(' ',''),16:name,17:sub}[n.nameID];n.string=val.encode(n.getEncoding(),errors='replace')
   font['OS/2'].usWeightClass=weight
   font['OS/2'].fsSelection=(font['OS/2'].fsSelection&~(1|32|64))|(1 if style=='italic' else 0)|(32 if weight==700 else 0)|(64 if weight!=700 and style!='italic' else 0)
   font['head'].macStyle=(font['head'].macStyle&~3)|(1 if weight==700 else 0)|(2 if style=='italic' else 0)
   target=out/(key+'-'+str(weight)+('-italic' if style=='italic' else '')+'.ttf');font.save(target)
   picked.append({'file':target.name,'weight':weight,'style':style,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
  if not picked:raise ValueError('No suitable font')
  license=get(base+'OFL.txt');(out/(key+'-OFL.txt')).write_bytes(license)
  print('OK',name,flush=True);return {'name':name,'key':key,'files':picked,'source':base}
 except Exception as e:print('SKIP',key,str(e),flush=True);return None
with ThreadPoolExecutor(max_workers=5) as pool:records=[v for v in pool.map(download,families) if v]
(out/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),'utf-8')
css=[]
for family in records:
 for f in family['files']:css.append('@font-face{font-family:"'+family['name']+'";src:url("/fonts/'+f['file']+'") format("truetype");font-weight:'+str(f['weight'])+';font-style:'+f['style']+';font-display:block;}')
(out/'fonts.css').write_text('\n'.join(css),'utf-8')
(ROOT/'src/lib/bundled-fonts.json').write_text(json.dumps([r['name'] for r in records],ensure_ascii=False),'utf-8')
print('BUNDLED FAMILIES',len(records),flush=True)
