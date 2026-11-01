import test from 'node:test'
import assert from 'node:assert/strict'
import {loadScreen} from './screenLoader.js'
test('screen loads pass their module through',async()=>{const module={default:()=>null};assert.equal(await loadScreen(()=>Promise.resolve(module)),module)})
test('stalled screens time out instead of leaving the fallback forever',async()=>{await assert.rejects(loadScreen(()=>new Promise(()=>{}),10),/could not finish loading/)})
test('module failures reach the recovery screen',async()=>{await assert.rejects(loadScreen(()=>Promise.reject(new Error('network failed'))),/network failed/)})
