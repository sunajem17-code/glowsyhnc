const test = require('node:test')
const assert = require('node:assert/strict')
const {persistCompletedScan}=require('./durableScan')
test('completed scan is saved with its authenticated owner and model findings before completion',async()=>{
 let stored;const sb={from:table=>{assert.equal(table,'scans');return {upsert:row=>{stored=row;return {select:()=>({single:async()=>({data:{id:row.id}})})}}}}}
 await persistCompletedScan(sb,{id:'scan',userId:'owner',completedAt:'2026-11-01',result:{overallScore:6,keyStrengths:['Broad shoulders']},clean:value=>value})
 assert.equal(stored.user_id,'owner');assert.deepEqual(stored.extended_metrics.serverAnalysis.result.keyStrengths,['Broad shoulders'])
})
test('failed durable save cannot report a completed scan to the phone',async()=>{
 const sb={from:()=>({upsert:()=>({select:()=>({single:async()=>({error:{message:'unavailable'}})})})})}
 await assert.rejects(persistCompletedScan(sb,{id:'scan',userId:'owner',result:{overallScore:6},clean:value=>value}),error=>error.code==='scan_save_failed' && error.status===503)
})
