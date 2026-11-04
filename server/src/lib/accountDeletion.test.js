const test = require('node:test')
const assert = require('node:assert/strict')
const { deleteCloudAccountData } = require('./deleteAccountData')
function fixture(failure = null, retained = false) {
  const calls = []; let account = true, photos = [{name:'owned.jpg'}]
  const sb = { from(table) { return {
    delete() { return { eq: async (key,id) => { calls.push([table,key,id]); if (table === failure) return {error:{code:'42501'}}; if (table==='users' && !retained) account=false; return {error:null} } } },
    select() { return { eq: () => ({maybeSingle:async()=>({data:account?{id:'owner'}:null,error:null})}) } },
  } }, storage:{from:()=>({list:async prefix=>{assert.equal(prefix,'scan/owner');return {data:photos}},remove:async paths=>{assert.deepEqual(paths,['scan/owner/owned.jpg']);photos=[];return {error:null}}})} }
  return {sb,calls}
}
test('deletion removes only owned data/photos and verifies the auth row is gone',async()=>{
 const {sb,calls}=fixture();await deleteCloudAccountData(sb,'owner');assert.equal(calls.at(-1)[0],'users');assert.ok(calls.every(([,key,id])=>id==='owner'))
})
test('resolved Supabase errors cannot report successful deletion',async()=>{
 for(const table of ['scans','profiles','users']) {const {sb}=fixture(table);await assert.rejects(deleteCloudAccountData(sb,'owner'),/failed/)}
 const {sb}=fixture(null,true);await assert.rejects(deleteCloudAccountData(sb,'owner'),/confirmed/)
})
