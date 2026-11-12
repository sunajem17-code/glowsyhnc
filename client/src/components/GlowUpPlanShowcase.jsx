import { useEffect, useMemo, useRef } from 'react'
import MotionPage from './MotionPage'
import { getRoutinePreviewForWeek, getRoutineShowcaseWeeklyTotal, RoutineSectionTabs, RoutineProgressHeader, RoutineFaceChecklist, RoutineBodyChecklist } from '../pages/FaceBodyRoutine'

const noop=()=>{}
const facePreview=getRoutinePreviewForWeek('face',1)
const bodyPreview=getRoutinePreviewForWeek('body',1)
const sectionSteps=facePreview.routines.map((routine,i)=>({id:i?'evening':'morning',icon:routine.icon,title:routine.title,steps:routine.tasks.map(task=>task.title),stepKeys:routine.tasks.map((_,index)=>`${i?'evening':'morning'}-${index}`),stepDetails:Object.fromEntries(routine.tasks.map((task,index)=>[`${i?'evening':'morning'}-${index}`,task.reps]).filter(([,reps])=>reps))}))
const order=sectionSteps.flatMap(step=>[...Array.from({length:4},(_,i)=>`${step.id}-water-${i}`),...step.steps.map((_,i)=>`${step.id}-task-${i}`)])
export const SHOWCASE_FACE_CHECKS=order.length
export const SHOWCASE_MORNING_CHECKS=order.filter(key=>key.startsWith('morning-')).length
export const SHOWCASE_NIGHT_CHECKS=order.length-SHOWCASE_MORNING_CHECKS
export const SHOWCASE_BODY_CHECKS=bodyPreview.tasks.length
const weekTotal=getRoutineShowcaseWeeklyTotal()

// This uses the app's shared rendering and routine data, with local, controlled
// presentation state. No store, API, localStorage or real task mutations.
export default function GlowUpPlanShowcase({section='face',completedCount=0,period='all',completedFaceCount=SHOWCASE_FACE_CHECKS,priorBodyCount=0}) {
  const root=useRef(null)
  const completed=useMemo(()=>new Set(order.slice(0,completedCount)),[completedCount])
  const visibleSteps=sectionSteps.filter(step=>period==='all'||step.id===period)
  const visibleCompletedCount=period==='evening'?Math.max(0,completedCount-SHOWCASE_MORNING_CHECKS):completedCount
  const faceTaskCount=section==='body'?order.slice(0,completedFaceCount).filter(key=>key.includes('-task-')).length:order.slice(0,completedCount).filter(key=>key.includes('-task-')).length
  const bodyCount=section==='body'?completedCount:priorBodyCount
  const weeklyTaskProgress={total:weekTotal,completed:faceTaskCount+bodyCount,percent:Math.round((faceTaskCount+bodyCount)/weekTotal*100)}
  const isRoutineStepChecked=(step,index)=>completed.has(`${step.id}-task-${index}`)
  const isHydrationGlassChecked=(period,index)=>completed.has(`${period==='Morning'?'morning':'evening'}-water-${index}`)
  const hydrationCount=period=>Array.from({length:4},(_,i)=>isHydrationGlassChecked(period,i)).filter(Boolean).length
  useEffect(()=>{
    const container=root.current?.querySelector('.page-scroll')
    if(!container)return
    if(visibleCompletedCount===0){container.scrollTop=0;return}
    const target=container.querySelectorAll('button[aria-pressed]')[visibleCompletedCount-1]
    if(!target)return
    target.setAttribute('data-showcase-tap','true')
    const tapTimer=setTimeout(()=>target.removeAttribute('data-showcase-tap'),200)
    const a=container.getBoundingClientRect(),b=target.getBoundingClientRect()
    if(b.bottom<=a.top+610&&b.top>=a.top+145)return ()=>{clearTimeout(tapTimer);target.removeAttribute('data-showcase-tap')}
    const from=container.scrollTop
    const to=Math.max(0,Math.min(container.scrollHeight-container.clientHeight,from+b.top-a.top-290))
    if(Math.abs(to-from)<1)return ()=>{clearTimeout(tapTimer);target.removeAttribute('data-showcase-tap')}
    container.style.scrollBehavior='auto'
    let id;const start=performance.now()
    const tick=now=>{const p=Math.min(1,(now-start)/110);const eased=p*p*(3-2*p);container.scrollTop=from+(to-from)*eased;if(p<1)id=requestAnimationFrame(tick)}
    id=requestAnimationFrame(tick)
    return()=>{cancelAnimationFrame(id);clearTimeout(tapTimer);target.removeAttribute('data-showcase-tap')}
  },[visibleCompletedCount,section,period])
  return <div ref={root} className="h-full showcase-routine-content">
    <MotionPage>
      <main className="space-y-3 px-4 pb-28 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
        <RoutineSectionTabs routineSection={section} setRoutineSection={noop}/>
        <RoutineProgressHeader selectedRoutineWeek={1} selectedRoutineWeekLocked={false} showWeekCalendar={false} setShowWeekCalendar={noop} selectRoutineWeek={noop} weeklyTaskProgress={weeklyTaskProgress} isPremium routineSection={section}/>
        <div role="tabpanel" id={`routine-panel-${section}`} aria-labelledby={`routine-tab-${section}`} className="space-y-3">
          {section==='face'?<RoutineFaceChecklist sectionSteps={visibleSteps} isRoutineStepChecked={isRoutineStepChecked} progress={{daily:{}}} selectedFaceDayLocked={false} isHydrationGlassChecked={isHydrationGlassChecked} toggleHydrationGlass={noop} isPremium routineDayIsPast={false} hydrationCount={hydrationCount} routineStepKey={(step,index)=>step.stepKeys[index]} toggleRoutineStep={noop} toggleStep={noop}/>:<RoutineBodyChecklist selectedPlanDayDone={completedCount===SHOWCASE_BODY_CHECKS} todaysSession={{name:bodyPreview.title}} selectedBodyWeekLocked={false} viewingCurrentDay planDayDone={completedCount===SHOWCASE_BODY_CHECKS} activeMissionSteps={bodyPreview.tasks} checkedPlanSteps={completedCount} routineDayIsPast={false} selectedPlanDayChecks={Object.fromEntries(bodyPreview.tasks.slice(0,completedCount).map((_,i)=>[`1-${i}`,true]))} selectedPlanDay={1} isPremium togglePlanStep={noop} routineDayIsLocked={false}/>}
        </div>
      </main>
    </MotionPage>
  </div>
}
