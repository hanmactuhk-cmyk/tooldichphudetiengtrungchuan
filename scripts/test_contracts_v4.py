from pathlib import Path
import json,sys
sys.path.insert(0,str(Path('resources/backend').resolve()))
from subtitle_contract import from_srt,json_translation,to_srt,parse_srt
from dubbing import tempo_filters
cues=[{'id':'a','startTime':.6,'endTime':1.1,'textZh':'你好'}]
text='Đoạn mã\n1\n00:00:00,600 --> 00:00:01,100\nXin chào.\n'
assert from_srt(text,cues)[0]['viFull']=='Xin chào.'
for text in ['1\n00:00:00,600 --> 00:00:01,200\nXin chào.','1\n00:00:00,600 --> 00:00:01,100\n你好']:
 try:from_srt(text,cues);raise AssertionError('Accepted invalid translation')
 except ValueError:pass
assert 'atempo=0.5' in tempo_filters(.28)
assert len(parse_srt(to_srt(cues)))==1
Path('../../outputs/v4-tests/packaged/contracts.json').write_text(json.dumps({'prefixedCodeHeader':True,'rejectChangedTime':True,'rejectUntranslated':True,'extremePitchTempoChain':True},indent=2));print('Contract checks passed.')
