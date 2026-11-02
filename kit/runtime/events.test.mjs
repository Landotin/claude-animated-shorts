import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync(new URL('./events.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const a=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('contacts are exact and backward seeking is deterministic',()=>{
 const first=a.strike(44,44);a.strike(200,44);a.strike(0,44);assert.deepEqual(a.strike(44,44),first);assert.equal(first.swing,1);assert.equal(first.fall,0);assert.equal(first.burst,true);assert.equal(a.strike(59,44).fall,1);
});
test('props arrive at contact and stay attached after transfer',()=>{
 assert.deepEqual(a.throwAt(39,24,39,[0,2,0],[3,0,1]),[3,Math.sin(Math.PI)*.35,1]);
 assert.equal(a.carryTransfer(18,8,18,27).attached,true);assert.equal(a.carryTransfer(27,8,18,27).depart,1);
});
test('reaction and uniform change preserve causal order',()=>{
 assert.equal(a.drinkReactDrop(17,11,17,29).sick,true);assert.equal(a.promotion(3,1,4).uniform,false);assert.equal(a.promotion(4,1,4).uniform,true);assert.throws(()=>a.promotion(0,4,1));
});
test('one global blink clock generates sound on the visible closure',()=>{
 for(const f of a.blinkFrames(180,240,1))assert.equal(a.blinkAt(f,1),true);assert.deepEqual(a.blinkFrames(180,240,1),[219]);
});
test('released cup reaches the floor at contact and never follows a later actor pose',()=>{
 const anchor=[.3,1.8,.2],release=196,contact=261,halfHeight=.1;
 assert.deepEqual(a.dropToGround(release-1,release,contact,anchor,halfHeight),anchor);
 const landed=a.dropToGround(contact,release,contact,anchor,halfHeight);
 assert.deepEqual(landed,[anchor[0],halfHeight,anchor[2]]);
 assert.equal(landed[1]-halfHeight,0);
 assert.deepEqual(a.dropToGround(contact+100,release,contact,anchor,halfHeight),landed);
 for(let f=release;f<=contact;f++)assert.ok(a.dropToGround(f,release,contact,anchor,halfHeight)[1]>=halfHeight);
 a.dropToGround(999,release,contact,anchor,halfHeight);
 assert.deepEqual(a.dropToGround(release,release,contact,anchor,halfHeight),anchor);
 assert.throws(()=>a.dropToGround(0,5,5,anchor));
});
