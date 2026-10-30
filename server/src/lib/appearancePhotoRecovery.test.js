const test = require('node:test')
const assert = require('node:assert/strict')
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports } }
stub('../db', {})
stub('../supabase', { getSupabase: () => null })
const { imageForScan } = require('./coachScanContext')
function context(download, path='scan/alice/original.jpg') { return { latest: { imagePath: path }, imageConsent: true, supabase: { storage: { from: name => { assert.equal(name, 'scan-images'); return { download } } } } } }
const blob = new Blob(['test image'], { type: 'image/jpeg' })
test('unsupported image transforms retry the exact same owned original', async () => {
 const calls=[]
 const result=await imageForScan(context(async (...args)=>{calls.push(args);return args.length===2?{error:new Error('transform unavailable')}:{data:blob}}),'alice')
 assert.equal(calls.length,2);assert.equal(calls[0][0],calls[1][0]);assert.equal(calls[1].length,1);assert.equal(result.source.media_type,'image/jpeg')
})
test('another owner and arbitrary remote URLs are never downloaded', async()=>{
 for(const path of ['scan/bob/original.jpg','https://example.com/photo.jpg'])assert.equal(await imageForScan(context(()=>{throw new Error('must not download')},path),'alice'),null)
})
test('fallback originals still enforce size and type',async()=>{
 for(const data of [new Blob(['x'],{type:'text/html'}),new Blob([new Uint8Array(2*1024*1024+1)],{type:'image/jpeg'})]){
  await assert.rejects(imageForScan(context(async(_,options)=>options?{error:true}:{data}),'alice'),/unavailable/)
 }
})
