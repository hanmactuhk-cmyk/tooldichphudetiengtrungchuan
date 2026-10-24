import assert from 'node:assert/strict';
import {exportGeometry} from '../src/lib/export-geometry';
const p:any={videoWidth:576,videoHeight:1024,captionLayout:{aspect:'9:16'}};
assert.deepEqual(exportGeometry(p),{w:576,h:1024,ow:576,oh:1024});
p.exportSettings={resolution:'1080p',quality:'fast'};assert.deepEqual(exportGeometry(p),{w:608,h:1080,ow:1920,oh:1080});
p.exportSettings.resolution='1080p-portrait';assert.deepEqual(exportGeometry(p),{w:1080,h:1920,ow:1080,oh:1920});
console.log('FULL HD LANDSCAPE / PORTRAIT / ORIGINAL GEOMETRY PASSED');
