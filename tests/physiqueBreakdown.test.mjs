import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require('../client/node_modules/esbuild')
const root=fileURLToPath(new URL('../client',import.meta.url))
const output=await build({stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import Breakdown from './src/components/PhysiqueBreakdown';export const render=scan=>renderToStaticMarkup(<Breakdown scan={scan} showCoach={false}/>);`,resolveDir:root,loader:'jsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'router',setup(b){b.onResolve({filter:/^react-router-dom$/},()=>({path:'router',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useNavigate=()=>()=>{}'}))}}]})
const mod=new Module('physique-breakdown');mod._compile(output.outputFiles[0].text,'physique-breakdown.cjs')
test('phone-saved positive findings below eight remain visible without ratings',()=>{
 const html=mod.exports.render({physiqueScore:{frame_width:6.5,physique_strengths:['Broad shoulders — Your shoulders appear broad in this photo.']}})
 assert.match(html,/Broad shoulders/)
 assert.doesNotMatch(html,/No saved|6\.5|\/10/)
})
test('partial native scan preserves legacy findings instead of hiding them',()=>{
 const html=mod.exports.render({physiqueScore:{},aiScore:{physiqueResult:{physique_strengths:['Balanced torso proportions — Your torso proportions look balanced.']}}})
 assert.match(html,/Balanced torso proportions/)
})
test('six-range saved scan renders two positive findings without requiring elite ratings',()=>{
 const html=mod.exports.render({physiqueScore:{muscle_mass:6,body_fat_score:5.8,v_taper:6.3,frame_width:6.2}})
 assert.equal((html.match(/class="physique-analysis-item"/g)||[]).length,2)
 assert.match(html,/relative strength/)
 assert.doesNotMatch(html,/did not identify|\/10|6\.3/)
})
