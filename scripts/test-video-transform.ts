import assert from 'node:assert/strict';
import {cropBox,cropPlacement,zoomGeometry} from '../src/lib/video-transform';
const c:any={nativeWidth:400,nativeHeight:200,fit:'contain',crop:{x:.25,y:0,width:.5,height:1}};
assert.deepEqual(cropPlacement(c,400,200),{crop:c.crop,x:100,y:0,width:200,height:200});
assert.deepEqual(zoomGeometry({x:0,y:0,width:1,height:1},2),{x:-.5,y:-.5,width:2,height:2});
assert.deepEqual(zoomGeometry({x:-.5,y:-.5,width:2,height:2},.5),{x:.25,y:.25,width:.5,height:.5});
assert.equal(cropBox({crop:{x:.99,y:0,width:1,height:1}}).x,.95);
console.log('CROP PLACEMENT / CENTERED ZOOM / NEGATIVE POSITION / CROP LIMITS PASSED');
