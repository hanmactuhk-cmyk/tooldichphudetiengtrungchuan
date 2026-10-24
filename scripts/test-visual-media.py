import cv2,numpy as np,requests,time,json,os,subprocess,imageio_ffmpeg
from pathlib import Path
out=Path(os.environ.get('HN_TEST_OUT','test-results/visual-media'));out.mkdir(parents=True,exist_ok=True);base=os.environ.get('HN_TEST_URL','http://127.0.0.1:8013')
f=out/'motion.mp4';w,h=320,180;writer=cv2.VideoWriter(str(f),cv2.VideoWriter_fourcc(*'mp4v'),20,(w,h))
rng=np.random.default_rng(1);texture=rng.integers(30,100,(h,w,3),dtype=np.uint8);target=rng.integers(150,255,(30,50,3),dtype=np.uint8)
for i in range(60):
 frame=texture.copy();frame[50:80,30+i*2:80+i*2]=target;writer.write(frame)
writer.release();web=out/'motion-web.mp4';subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(f),'-c:v','libx264','-preset','ultrafast','-crf','20',str(web)],check=True);f=web;img=np.zeros((40,40,4),np.uint8);img[:,:,:3]=(0,0,255);img[:,:,3]=255;cv2.imwrite(str(out/'red.png'),img)
def upload(p):
 with p.open('rb') as file:r=requests.post(base+'/api/media/import',files={'file':(p.name,file)},timeout=60)
 r.raise_for_status();return r.json()
def poll(r):
 r.raise_for_status();key=r.json()['jobId'];limit=time.time()+180
 while time.time()<limit:
  j=requests.get(base+'/api/jobs/'+key,timeout=20).json()
  if j['state']=='done':return j['result']
  if j['state']=='error':raise RuntimeError(j)
  time.sleep(.2)
 raise TimeoutError(key)
v=upload(f);im=upload(out/'red.png');common=dict(sourceStart=0,sourceDuration=3,x=0,y=0,width=1,height=1,opacity=1,enabled=True,keyframes=[])
video={**common,'id':'v','kind':'video','name':'Cut video','url':v['url'],'startTime':0,'endTime':2,'sourceStart':.5}
image={**common,'id':'i','kind':'image','name':'Moving red','url':im['url'],'startTime':.2,'endTime':1.8,'x':.1,'y':.7,'width':.15,'height':.2,'keyframes':[dict(time=.2,x=.1,y=.7,width=.15,height=.2,opacity=1),dict(time=1.7,x=.7,y=.7,width=.15,height=.2,opacity=1)]}
blur={**common,'id':'b','kind':'blur','name':'Blur','startTime':0,'endTime':1,'x':.5,'y':.1,'width':.3,'height':.3,'strength':15,'radius':.25}
track=poll(requests.post(base+'/api/media/track',json={'url':v['url'],'start':0,'end':2,'region':dict(x=30/w,y=50/h,width=50/w,height=30/h,opacity=1)},timeout=30));assert len(track['keyframes'])>5;assert track['keyframes'][-1]['x']>.2,track
video['endTime']=1
second={**video,'id':'v2','startTime':1,'endTime':2,'sourceStart':1.5}
opts={'timelineDuration':2,'visuals':[video,second,image,blur,{**blur,'id':'b2','startTime':1,'endTime':2,'x':.05,'y':.1}], 'videoEdited':True,'originalMuted':True}
with f.open('rb') as file:r=requests.post(base+'/api/video/export',files={'file':('motion.mp4',file)},data={'options':json.dumps(opts)},timeout=30)
result=poll(r);output=out/'scene.mp4';output.write_bytes(requests.get(base+result['url']).content);cap=cv2.VideoCapture(str(output));assert abs(cap.get(7)/cap.get(5)-2)<.1
frames=[]
for t in [.4,1.6]:cap.set(0 if False else cv2.CAP_PROP_POS_MSEC,t*1000);ok,frame=cap.read();assert ok;frames.append(frame)
cap.release();red=[]
for frame in frames:
 mask=(frame[:,:,2]>180)&(frame[:,:,0]<60)&(frame[:,:,1]<60);ys,xs=np.where(mask);assert len(xs)>100;red.append(float(xs.mean()))
assert red[1]-red[0]>100,red
cv2.imwrite(str(out/'export-early.png'),frames[0]);cv2.imwrite(str(out/'export-late.png'),frames[1]);(out/'visual-report.json').write_text(json.dumps({'track':track,'export':result,'redCenters':red},indent=2));print('REAL MP4: VIDEO TRIM / IMAGE KEYFRAME / TWO TIMED BLURS / OBJECT TRACKING PASSED')
