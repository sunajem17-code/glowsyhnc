import { useEffect, useRef } from 'react'
import { StreakView } from '../pages/Streak'
const noop=()=>{}
const streak={current:5,longest:5,face:{current:5,longest:5}}
const checkinDates=new Set(['2026-11-06','2026-11-07','2026-11-08','2026-11-09','2026-11-10'])
const monthDate=new Date('2026-11-01T12:00:00')

// Illustrative scan-day history only; no account state or check-in writes.
export default function StreakShowcase({showGoals=false,fillProgress=1}) {
  const root=useRef(null)
  useEffect(()=>{
    const page=root.current?.querySelector('.page-scroll')
    const goals=page?.querySelector('[aria-labelledby="streak-goals-title"]')
    if(!page||!goals)return
    if(showGoals)page.scrollTo({top:page.scrollTop+goals.getBoundingClientRect().top-page.getBoundingClientRect().top-35,behavior:'smooth'})
    else page.scrollTo({top:0,behavior:'instant'})
  },[showGoals])
  return <div ref={root} className="h-full" aria-label="Illustrative five-day scan streak"><StreakView navigate={noop} current={5} faceCurrent={5} streak={streak} checkinDates={checkinDates} monthDate={monthDate} flameFill={fillProgress}/></div>
}
