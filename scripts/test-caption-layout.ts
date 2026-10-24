import {captionBox,FONTS,roundedRectPath} from '../src/lib/styled-caption';
import assert from 'node:assert/strict';
import {splitCue,splitText,generateAss,DEFAULT_CAPTION_LAYOUT} from '../src/lib/caption-layout';
import type {ProjectData,Subtitle} from '../src/types';
for(let i=2;i<150;i++){
 const text=Array.from({length:i},(_,j)=>j%2?'xin chào':'朋友').join(' ');const [a,b]=splitText(text);assert(a&&b);assert.equal((a+b).replace(/\s/g,''),text.replace(/\s/g,''));
 const cue={id:'a',textZh:'你好朋友，我们一起走吧',textVi:text,startTime:1,endTime:5,characterId:'a',speed:1,pitch:0,volume:1,status:'synced',ttsAudioUrl:'/cache/old.wav',dubStartTime:9,dubEndTime:12} as Subtitle;
 const parts=splitCue(cue);assert.equal(parts.length,2);assert.equal(parts[0].endTime,parts[1].startTime);assert.equal(parts[0].startTime,1);assert.equal(parts[1].endTime,5);assert(parts.every(p=>!p.ttsAudioUrl&&p.dubStartTime===undefined));assert.notEqual(parts[0].id,parts[1].id);
}
const project={videoWidth:360,videoHeight:640,captionLayout:{...DEFAULT_CAPTION_LAYOUT,position:{x:.25,y:.3}},subtitles:[{id:'a',startTime:1,endTime:2,textZh:'你好',textVi:'Xin chào',dubStartTime:3,dubEndTime:4}],dubAudioUrl:'/cache/mix.wav'} as ProjectData;
const ass=generateAss(project);assert(ass.includes('PlayResX: 360'));assert(ass.includes('PlayResY: 640'));assert(ass.includes('\\pos(90.00,192.00)'));assert(!ass.includes('\\\\an5'));assert(ass.includes('0:00:03.00,0:00:04.00'));console.log('CAPTION SPLIT / ASS TESTS PASSED');

const styled=generateAss({...project,captionLayout:{...DEFAULT_CAPTION_LAYOUT,textColor:'#ff0000',backgroundColor:'#00ff00',backgroundOpacity:1,fontFamily:'Georgia'}});assert(styled.includes('\\fnGeorgia'));assert(styled.includes('\\p1'));assert(styled.includes('&H000000ff&'));assert(styled.includes('&H0000ff00&'));
const transparent=generateAss({...project,captionLayout:{...DEFAULT_CAPTION_LAYOUT,backgroundOpacity:0}});assert(!transparent.includes('\\p1'));

assert(FONTS.length>=50);assert(FONTS.includes('Be Vietnam Pro')&&FONTS.includes('Dancing Script'));assert.equal(new Set(FONTS).size,FONTS.length);const originalWords='Xin chào những người bạn Việt Nam thân mến';const wrapped=captionBox(originalWords,320,{...DEFAULT_CAPTION_LAYOUT,width:55,fontSize:6});assert.deepEqual(wrapped.lines.join(' ').split(/\s+/),originalWords.split(/\s+/));const longWord='chữkhôngcókhoảngtrắngrấtdài';assert.equal(captionBox(longWord,100,{...DEFAULT_CAPTION_LAYOUT,width:50,fontSize:10}).lines.length,1);assert(roundedRectPath(100,40,.3).includes(' b '));const decorated=generateAss({...project,subtitles:project.subtitles.map(c=>({...c,captionStyle:{bold:false,italic:true,cornerRadius:.4,characterColors:{0:'#00ffff'}}}))});assert(decorated.includes('\\b0\\i1'));assert(decorated.includes('&H00ffff00&'));

const aligned=generateAss({...project,captionLayout:{...DEFAULT_CAPTION_LAYOUT,align:"right"}});assert(aligned.includes("\\an6"));console.log("BUNDLED FONT CHOICES / RIGHT ALIGNMENT PASSED");
