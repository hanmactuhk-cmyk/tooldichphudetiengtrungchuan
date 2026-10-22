import assert from 'node:assert/strict';
import {splitCue,splitText,generateAss,DEFAULT_CAPTION_LAYOUT} from '../src/lib/caption-layout';
import type {ProjectData,Subtitle} from '../src/types';
for(let i=2;i<150;i++){
 const text=Array.from({length:i},(_,j)=>j%2?'xin chào':'朋友').join(' ');const [a,b]=splitText(text);assert(a&&b);assert.equal((a+b).replace(/\s/g,''),text.replace(/\s/g,''));
 const cue={id:'a',textZh:'你好朋友，我们一起走吧',textVi:text,startTime:1,endTime:5,characterId:'a',speed:1,pitch:0,volume:1,status:'synced',ttsAudioUrl:'/cache/old.wav',dubStartTime:9,dubEndTime:12} as Subtitle;
 const parts=splitCue(cue);assert.equal(parts.length,2);assert.equal(parts[0].endTime,parts[1].startTime);assert.equal(parts[0].startTime,1);assert.equal(parts[1].endTime,5);assert(parts.every(p=>!p.ttsAudioUrl&&p.dubStartTime===undefined));assert.notEqual(parts[0].id,parts[1].id);
}
const project={videoWidth:360,videoHeight:640,captionLayout:{...DEFAULT_CAPTION_LAYOUT,position:{x:.25,y:.3}},subtitles:[{id:'a',startTime:1,endTime:2,textZh:'你好',textVi:'Xin chào',dubStartTime:3,dubEndTime:4}],dubAudioUrl:'/cache/mix.wav'} as ProjectData;
const ass=generateAss(project);assert(ass.includes('PlayResX: 360'));assert(ass.includes('PlayResY: 640'));assert(ass.includes('{\\an5\\pos(90,192)}'));assert(!ass.includes('\\\\an5'));assert(ass.includes('0:00:03.00,0:00:04.00'));console.log('CAPTION SPLIT / ASS TESTS PASSED');
