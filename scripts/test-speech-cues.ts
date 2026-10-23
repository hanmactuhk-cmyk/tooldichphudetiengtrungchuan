import assert from 'node:assert/strict';
import {captionSpeechCues} from '../src/lib/speech-cues';
import {Subtitle} from '../src/types';
const cues=[
 {id:'a',startTime:1,endTime:8,viStartTime:2,viEndTime:5,dubStartTime:20,dubEndTime:25,textVi:'Xin chào.'},
 {id:'b',startTime:7,endTime:9,viStartTime:4,viEndTime:6,textVi:'Câu sau.'},
 {id:'hidden',startTime:2.5,endTime:3,hiddenVi:true,textVi:'Đã xóa.'},
] as Subtitle[];
const one=captionSpeechCues(cues,new Set(['a']),[]);
assert.equal(one.length,1);assert.equal(one[0].startTime,2);assert.equal(one[0].endTime,4);
assert.equal(one[0].voiceId,'Hải Đăng');assert.equal(cues[0].endTime,8);
const all=captionSpeechCues(cues,new Set(cues.map(c=>c.id)),[]);
assert.deepEqual(all.map(c=>[c.startTime,c.endTime]),[[2,4],[4,6]]);
console.log('SPEECH CUES: VI TIMES / NO LEGACY AUDIO SHIFT / NEXT UNSELECTED CUE / HIDDEN CAPTIONS PASSED');
