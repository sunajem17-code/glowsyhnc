const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
;(async () => {
 const db = new PGlite()
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE users(id uuid PRIMARY KEY);
 INSERT INTO users VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');`)
 const sql=fs.readFileSync(path.join(__dirname, '../migrations/007_personalization_and_checkins.sql'),'utf8')
 await db.exec(sql)
 await db.exec(sql) // safely rerunnable
 const user='00000000-0000-4000-8000-000000000001'
 const call=()=>db.query(`SELECT record_daily_checkin($1,8,5,true,false,true) result`,[user])
 assert.equal((await call()).rows[0].result.current_streak,1)
 await db.exec(`UPDATE streaks SET current_streak=7,longest_streak=9,last_checkin_date=(now() AT TIME ZONE 'UTC')::date-1`)
 assert.equal((await call()).rows[0].result.current_streak,8)
 const concurrent=await Promise.all([call(),call(),call()])
 for(const result of concurrent) assert.equal(result.rows[0].result.current_streak,8)
 assert.equal((await db.query('SELECT count(*)::integer n FROM daily_checkins')).rows[0].n,1)
 await db.exec(`UPDATE streaks SET last_checkin_date=(now() AT TIME ZONE 'UTC')::date-3`)
 const gap=(await call()).rows[0].result
 assert.equal(gap.current_streak,1);assert.equal(gap.longest_streak,9)
 await db.exec(`SET ROLE anon`)
 await assert.rejects(call(), /permission denied/)
 await db.exec(`RESET ROLE`)
 await db.query(`INSERT INTO personalized_recommendations(user_id,context_key,payload) VALUES ($1,'scan','{"routine":{"am":[]},"products":[]}')`,[user])
 await db.query('DELETE FROM users WHERE id=$1',[user])
 assert.equal((await db.query('SELECT count(*)::integer n FROM personalized_recommendations')).rows[0].n,0)
 console.log('PASS: PostgreSQL migration twice, first/repeat/concurrent/day-gap check-ins, role permissions, account cascade')
 await db.close()
})().catch(e=>{console.error(e);process.exitCode=1})
