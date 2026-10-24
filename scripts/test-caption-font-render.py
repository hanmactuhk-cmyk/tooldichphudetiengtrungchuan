"""Prove libass selects bundled Vietnamese fonts instead of silently falling back."""
import json,os,subprocess,tempfile,re
from pathlib import Path
import imageio_ffmpeg
from fontTools.ttLib import TTFont
root=Path(__file__).resolve().parents[1];fonts=Path(os.environ.get('HN_TEST_FONTDIR',root/'dist/fonts')).resolve();manifest=json.loads((fonts/'manifest.json').read_text('utf-8'))
out=Path(os.environ.get('HN_TEST_OUT',root/'test-results/font-render'));out.mkdir(parents=True,exist_ok=True)
header='[Script Info]\nScriptType: v4.00+\nPlayResX: 720\nPlayResY: 1280\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV\n'
styles=[];events=[];expected={}
for i,family in enumerate(manifest):
 for j,weight in enumerate([400,700]):
  name=family['name'];styles.append(f'Style: f{i}-{j},{name},22,&H00FFFFFF,{"-1" if weight==700 else "0"},0,1,0,0,7,0,0,0')
  events.append(f'Dialogue: 0,0:00:00.00,0:00:01.00,f{i}-{j},,0,0,0,,{{\\pos({10+j*350},{10+i*37})}}Đặng Thị Hằng Ắ Ặ Ễ Ỡ Ữ Ỵ')
  expected[name]=[TTFont(fonts/f['file'])['name'].getDebugName(6) for f in family['files']]
ass=out/'font-test.ass';ass.write_text(header+'\n'.join(styles)+'\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'+'\n'.join(events),'utf-8')
fontdir=str(fonts).replace('\\','/').replace(':','\\:');exe=imageio_ffmpeg.get_ffmpeg_exe();command=[exe,'-v','verbose','-f','lavfi','-i','color=black:s=720x1280:d=0.1','-vf',"ass=font-test.ass:fontsdir='"+fontdir+"'",'-frames:v','1','-y','font-test.png'];r=subprocess.run(command,cwd=out,capture_output=True,creationflags=0x08000000 if os.name=='nt' else 0);log=r.stderr.decode('utf-8',errors='replace');(out/'font-render.log').write_text(log,'utf-8');assert r.returncode==0,log[-1500:]
for family,psnames in expected.items():
 selected=[line for line in log.splitlines() if 'fontselect: ('+family+',' in line]
 assert selected,(family,'not selected');assert all(any(ps in line.split(' -> ')[-1] for ps in psnames) for line in selected),(family,selected)
(out/'report.json').write_text(json.dumps({'families':len(expected),'verifiedBundledFontSelection':True},indent=2));print('MP4 LIBASS BUNDLED FONT SELECTION PASSED:',len(expected),'families')
