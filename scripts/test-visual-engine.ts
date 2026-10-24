import assert from 'node:assert/strict';
import {geometry,moveVisual,splitVisual} from '../src/lib/visual-engine';import {VisualClip} from '../src/types';
const c:VisualClip={id:'a',kind:'video',name:'x',startTime:2,endTime:6,sourceStart:1,sourceDuration:10,x:0,y:0,width:1,height:1,opacity:1,enabled:true,keyframes:[{time:2,x:0,y:0,width:1,height:1,opacity:1},{time:6,x:.6,y:.2,width:.5,height:.5,opacity:.5}]};
assert.equal(geometry(c,4).x,.3);assert.equal(geometry(c,4).opacity,.75);assert.equal(geometry(c,1).x,0);assert.equal(geometry(c,9).x,.6);
const moved=moveVisual(c,4);assert.equal(moved.endTime,8);assert.deepEqual(moved.keyframes.map(k=>k.time),[4,8]);assert.equal(c.startTime,2);
const [a,b]=splitVisual(c,4);assert.equal(a.endTime,4);assert.equal(b.startTime,4);assert.equal(b.sourceStart,3);assert.equal(geometry(a,4).x,geometry(b,4).x);assert.throws(()=>splitVisual(c,9));console.log('VISUAL INTERPOLATION / MOVE / SPLIT SOURCE OFFSET / KEYFRAME CONTINUITY PASSED');
