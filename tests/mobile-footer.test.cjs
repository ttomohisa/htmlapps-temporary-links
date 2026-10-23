'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../temporary-links.html'),'utf8');
test('hide only the informational footer in the existing phone layout',()=>{
  assert.ok(source.includes('@media (max-width: 560px) { body > .footer { display: none; } }'));
  assert.equal((source.match(/<footer\b/g)||[]).length,1);
});
