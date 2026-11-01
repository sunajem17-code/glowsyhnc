import { getPhysiqueMetricScore } from './physiqueResults.js'
const AREAS = [
  {key:'muscle_mass',label:'Muscle development'},
  {key:'body_fat_score',label:'Visible definition'},
  {key:'v_taper',label:'Shoulder-to-waist proportions'},
  {key:'frame_width',label:'Upper-body frame'},
]
// Rank within this scan: a relative strength does not require an elite rating.
export function balancedPhysiqueAreas(scan) {
  const areas=AREAS.map(area=>({...area,score:getPhysiqueMetricScore(scan,area.key)}))
    .filter(area=>area.score!=null).sort((a,b)=>b.score-a.score)
  if(areas.length===1) return {pros:areas,cons:[]}
  const count=Math.min(2,Math.floor(areas.length/2))
  return {pros:areas.slice(0,count),cons:areas.slice(-count).reverse()}
}
