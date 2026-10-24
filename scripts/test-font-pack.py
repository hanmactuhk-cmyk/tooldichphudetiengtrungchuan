import json,hashlib,unicodedata
from pathlib import Path
from fontTools.ttLib import TTFont
root=Path(__file__).resolve().parents[1];folder=root/'public/fonts';manifest=json.loads((folder/'manifest.json').read_text('utf-8'));assert len(manifest)>=30
sample='ĂăÂâĐđÊêÔôƠơƯư'+''.join(chr(c) for c in range(0x1ea0,0x1efa))+'ÀÁÃÈÉÌÍÒÓÕÙÚÝàáãèéìíòóõùúý'
count=0
for family in manifest:
 assert (folder/(family['key']+'-OFL.txt')).is_file()
 for face in family['files']:
  file=folder/face['file'];assert hashlib.sha256(file.read_bytes()).hexdigest()==face['sha256'],file
  font=TTFont(file);missing=set(map(ord,sample))-set(font.getBestCmap());assert not missing,(file,missing)
  assert font['OS/2'].usWeightClass==face['weight'];count+=1
print(f'VIETNAMESE FONT PACK: {len(manifest)} families, {count} faces, full tone glyphs / licenses / hashes passed')
