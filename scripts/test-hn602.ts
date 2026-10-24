import assert from 'node:assert/strict';
import {motionAt} from '../src/lib/text-motion';
import {placeAudioEdit,audioEnd,validateTimeline} from '../src/lib/timeline-engine';
const fade={enter:{effect:'fade',duration:1,intensity:1}};
const frames=Array.from({length:61},(_,i)=>motionAt(fade,i/60,0,5).opacity);
assert.equal(new Set(frames).size,61);assert(frames.every((v,i)=>i===0||v>=frames[i-1]));
for(const effect of ['left','right','up','down','bounce','zoom-in','zoom-out']){
 const m={enter:{effect,duration:1,intensity:1}};const end=motionAt(m,1,0,5);assert(Math.abs(end.x)+Math.abs(end.y)+Math.abs(1-end.scale)<.00001);
}
const c:any={id:'a',track:'voice',startTime:1,trimStart:0,trimEnd:1,sourceDuration:1,volume:1,audioUrl:'/cache/a.wav'},b={...c,id:'b',startTime:2.1};
const edited=placeAudioEdit([c,b],{...c,trimEnd:2,sourceDuration:2});assert(edited[0].laneId);assert.equal(edited[0].startTime,1);assert.equal(edited[1],b);assert.equal(audioEnd(edited[0]),3);validateTimeline({duration:5,subtitles:[],audioClips:edited} as any);
assert(!placeAudioEdit([c,b],{...c,trimEnd:.5})[0].laneId);
console.log('60 FRAME MOTION / EASE / AUDIO LIVE GEOMETRY / SAFE OVERLAP LANE PASSED');
