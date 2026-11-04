import test from 'node:test'
import assert from 'node:assert/strict'
function fixture({fail=false}={}){
 const values=new Map([['ascendus_pending_media_cleanup','1']]),calls=[]
 globalThis.localStorage={getItem:key=>values.get(key),removeItem:key=>values.delete(key)}
 const database={transaction(){
  const tx={objectStore:()=>({clear(){calls.push('clear');queueMicrotask(()=>fail?tx.onerror():tx.oncomplete())},put(){calls.push('put');queueMicrotask(()=>tx.oncomplete())},get(){calls.push('get');return {}}})}
  return tx
 }}
 globalThis.indexedDB={open(){const request={};queueMicrotask(()=>request.onsuccess({target:{result:database}}));return request}}
 return {values,calls}
}
test('deleted-account media cannot be read while cleanup is pending',async()=>{
 const f=fixture();const media=await import('./scanPhotoDb.js?blocked')
 assert.equal(await media.loadScanMedia('old-scan'),null);assert.deepEqual(f.calls,[])
})
test('failed cleanup keeps the marker and never claims transaction success',async()=>{
 const f=fixture({fail:true});const media=await import('./scanPhotoDb.js?failure')
 await assert.rejects(media.clearAllScanMedia({strict:true}),/cleanup/)
 assert.equal(f.values.get('ascendus_pending_media_cleanup'),'1')
 assert.equal(await media.loadScanMedia('old-scan'),null)
})
test('a new photo is written only after pending deleted-account media clears',async()=>{
 const f=fixture();const media=await import('./scanPhotoDb.js?retry')
 await media.saveScanMedia('new-scan',{photo:'fixture'})
 assert.deepEqual(f.calls,['clear','put']);assert.equal(f.values.has('ascendus_pending_media_cleanup'),false)
})
