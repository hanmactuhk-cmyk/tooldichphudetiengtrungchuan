import assert from 'node:assert/strict';
import {deleteTimelineSelection,editTimeline,projectClips,timelineSubtitles,validateTimeline} from '../src/lib/timeline-engine';
import {ProjectData} from '../src/types';
const p={duration:10,subtitles:[{id:'s',startTime:1,endTime:5,textZh:'你好，今天天气很好。',textVi:'Xin chào, hôm nay trời đẹp.',ttsAudioUrl:'/cache/a.wav',ttsDuration:4,dubStartTime:2,dubEndTime:6}],audioClips:undefined,dubAudioUrl:'/cache/mix.wav'} as unknown as ProjectData;
const original=JSON.stringify(p);
let moved=editTimeline(p,{track:'voice',id:'voice-s',kind:'move',time:3,linked:true});assert.equal(moved.subtitles[0].startTime,3);assert.equal(projectClips(moved)[0].startTime,3);assert.equal(JSON.stringify(p),original);
const cut=editTimeline(moved,{track:'voice',id:'voice-s',kind:'split',time:5,linked:true});assert.equal(cut.subtitles.length,2);assert.equal(projectClips(cut).length,2);const [a,b]=projectClips(cut);assert.equal(a.trimEnd,b.trimStart);assert.equal(a.audioUrl,b.audioUrl);assert.equal(b.startTime,5);assert.equal(a.trimEnd-a.trimStart+b.trimEnd-b.trimStart,4);
const trim=editTimeline(cut,{track:'voice',id:a.id,kind:'left',time:3.5,linked:false});assert.equal(projectClips(trim)[0].trimStart,.5);assert.equal(trim.subtitles[0].startTime,3);
assert.throws(()=>editTimeline(cut,{track:'voice',id:b.id,kind:'move',time:4,linked:false}),/trùng/);
const deleted=editTimeline(cut,{track:'voice',id:a.id,kind:'delete',time:0,linked:true});assert.equal(deleted.subtitles.length,1);assert.equal(projectClips(deleted).length,1);
const silent=editTimeline(cut,{track:'voice',id:a.id,kind:'mute',time:0,linked:false});assert.equal(projectClips(silent)[0].muted,true);
for(let i=1;i<99;i++){const t=2+4*i/100;const r=editTimeline(p,{track:'voice',id:'voice-s',kind:'split',time:t,linked:true});validateTimeline(r);const [x,y]=projectClips(r);assert(Math.abs(x.trimEnd-y.trimStart)<.001);assert.equal(new Set(r.subtitles.map(s=>s.id)).size,2);}
const subTrim=editTimeline(p,{track:'subtitle',id:'s',kind:'left',time:3,linked:true});assert.equal(projectClips(subTrim)[0].trimStart,1);assert.equal(timelineSubtitles(subTrim)[0].startTime,3);
console.log('TIMELINE MOVE / LINK / SPLIT / TRIM / DELETE / MUTE / COLLISION TESTS PASSED');

const batch=deleteTimelineSelection(cut,[{track:'subtitle',id:cut.subtitles[0].id},{track:'voice',id:b.id}],false);assert.equal(batch.subtitles.length,1);assert.equal(projectClips(batch).length,1);
const linkedBatch=deleteTimelineSelection(cut,[{track:'subtitle',id:cut.subtitles[0].id},{track:'voice',id:b.id}],true);assert.equal(linkedBatch.subtitles.length,0);assert.equal(projectClips(linkedBatch).length,0);
