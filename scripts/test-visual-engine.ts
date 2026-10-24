import assert from 'node:assert/strict';
import {geometry,moveVisual,splitVisual,orderedVisuals,visualTracks,sourceRectangle} from '../src/lib/visual-engine';import {VisualClip} from '../src/types';
const c:VisualClip={id:'a',kind:'video',name:'x',startTime:2,endTime:6,sourceStart:1,sourceDuration:10,x:0,y:0,width:1,height:1,opacity:1,enabled:true,keyframes:[{time:2,x:0,y:0,width:1,height:1,opacity:1},{time:6,x:.6,y:.2,width:.5,height:.5,opacity:.5}]};
assert.equal(geometry(c,4).x,.3);assert.equal(geometry(c,4).opacity,.75);assert.equal(geometry(c,1).x,0);assert.equal(geometry(c,9).x,.6);
const moved=moveVisual(c,4);assert.equal(moved.endTime,8);assert.deepEqual(moved.keyframes.map(k=>k.time),[4,8]);assert.equal(c.startTime,2);
const [a,b]=splitVisual(c,4);assert.equal(a.endTime,4);assert.equal(b.startTime,4);assert.equal(b.sourceStart,3);assert.equal(geometry(a,4).x,geometry(b,4).x);assert.throws(()=>splitVisual(c,9));console.log('VISUAL INTERPOLATION / MOVE / SPLIT SOURCE OFFSET / KEYFRAME CONTINUITY PASSED');

const fast={...c,rate:2};assert.equal(splitVisual(fast,4)[1].sourceStart,5);
const rows=[{id:"top",name:"Top",enabled:true},{id:"bottom",name:"Bottom",enabled:false},{id:"empty",name:"Empty",enabled:true}];
const stacked=[{...c,id:"bottom",trackId:"bottom"},{...c,id:"top",kind:"blur" as const,trackId:"top"}];assert.deepEqual(orderedVisuals(stacked,rows).map(v=>v.id),["top","bottom"]);assert.equal(orderedVisuals(stacked,rows)[1].enabled,false);assert.equal(visualTracks(stacked,rows).length,3);
assert.deepEqual(sourceRectangle({...c,keyframes:[],nativeWidth:200,nativeHeight:100},2,100,100),{x:0,y:.25,width:1,height:.5});console.log("LAYER ORDER / HIDDEN ROW / EMPTY ROW / RETIMED SPLIT / CONTAIN GEOMETRY PASSED");
