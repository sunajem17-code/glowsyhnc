import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Bookmark, Check, ChevronLeft, ChevronRight, Heart, Scissors, Sparkles, X } from 'lucide-react'
import MotionPage from '../components/MotionPage'
import useStore from '../store/useStore'
import { api } from '../utils/api'
import { loadScanMedia } from '../utils/scanPhotoDb'
import { DENSITIES, HAIR_CATALOG_VERSION, HAIR_TYPES, HAIRSTYLE_CATALOG, LENGTHS, THICKNESSES } from '../utils/hairCatalog'
import { conciseReason, rankHairstyles, structureFromScan } from '../utils/hairMatching'
import { portableEvidence } from '../utils/productionAnalysis'
import { GOLD, GOLD_GRADIENT, SPRING_STANDARD } from '../utils/theme'
import { triggerHaptic } from '../utils/haptics'

const BG = '#080808'
const PANEL = 'rgba(255,255,255,0.045)'

function HairPattern({ type }) {
  const item = HAIR_TYPES.find(value => value.id === type)
  return <svg viewBox="0 0 32 24" className="w-12 h-9" aria-hidden="true">
    <path d={item?.pattern} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d={item?.pattern} transform="translate(0 6)" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".45" />
  </svg>
}

function Header({ title, onBack, right }) {
  return <div className="sticky top-0 z-30 flex items-center justify-between px-5 pb-3"
    style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', background: 'rgba(8,8,8,.94)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
    <button onClick={onBack} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center" aria-label="Back"><ChevronLeft size={22} color="rgba(255,255,255,.72)" /></button>
    <p className="font-heading font-bold text-[15px] text-white tracking-wide">{title}</p>
    <div className="w-10 flex justify-end">{right}</div>
  </div>
}

function ChoiceGrid({ title, subtitle, options, value, onChange, columns = 3, visual = false }) {
  return <div className="min-h-[64vh] flex flex-col justify-center">
    <p className="text-[10px] tracking-[.24em] uppercase mb-2" style={{ color: GOLD }}>HairMax</p>
    <h2 className="font-heading font-bold text-[29px] text-white leading-tight">{title}</h2>
    {subtitle && <p className="font-body text-[13px] text-secondary mt-2 mb-7">{subtitle}</p>}
    {!subtitle && <div className="h-7" />}
    <div className={`grid gap-3 ${columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {options.map(option => {
        const id = typeof option === 'string' ? option : option.id
        const label = typeof option === 'string' ? option : option.label
        const selected = value === id
        return <motion.button key={id} whileTap={{ scale: .96 }} onClick={() => { triggerHaptic(); onChange(id) }}
          className="min-h-[104px] rounded-2xl flex flex-col items-center justify-center gap-2 px-3 capitalize"
          style={{ background: selected ? 'rgba(198,168,92,.13)' : PANEL, border: `1.5px solid ${selected ? 'rgba(198,168,92,.7)' : 'rgba(255,255,255,.08)'}`, color: selected ? GOLD : 'rgba(255,255,255,.72)' }}>
          {visual && <HairPattern type={id} />}
          {!visual && id === 'low' && <div className="flex gap-1">{[1,2,3].map(i => <i key={i} className="block w-0.5 h-7 bg-current" style={{ opacity: .35 + i * .12 }} />)}</div>}
          {!visual && id === 'medium' && <div className="flex gap-1">{[1,2,3,4,5].map(i => <i key={i} className="block w-0.5 h-7 bg-current" />)}</div>}
          {!visual && id === 'high' && <div className="flex gap-[3px]">{[1,2,3,4,5,6,7].map(i => <i key={i} className="block w-0.5 h-7 bg-current" />)}</div>}
          <span className="font-heading font-bold text-[12px] uppercase tracking-wide">{label}</span>
        </motion.button>
      })}
    </div>
  </div>
}

function ConnectedIntro({ structure, scan, image, onContinue, onRescan }) {
  return <div className="px-5 pb-10">
    <div className="pt-7 mb-7">
      <p className="text-[10px] tracking-[.26em] uppercase mb-2" style={{ color: GOLD }}>HairMax</p>
      <h1 className="font-heading font-bold text-[34px] text-white leading-[1.05]">Find your best hairstyle.</h1>
    </div>
    <div className="relative rounded-[28px] overflow-hidden mb-5" style={{ aspectRatio: '4/5', background: PANEL, border: '1px solid rgba(198,168,92,.22)' }}>
      {image ? <img src={image} alt="Your Ascendus scan" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Scissors size={42} color={GOLD} /></div>}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 48%, rgba(0,0,0,.9))' }} />
      <div className="absolute left-5 right-5 bottom-5">
        <div className="flex items-center gap-2 mb-2"><span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: GOLD }}><Check size={12} color="#080808" /></span><span className="font-heading font-bold text-[11px] tracking-wide text-white uppercase">Face analysis connected</span></div>
        <p className="font-body text-[12px] text-white/60">Scan {scan?.id?.replace('scan-', '#') ?? ''}</p>
      </div>
    </div>
    <div className="rounded-2xl p-4 mb-6" style={{ background: PANEL, border: '1px solid rgba(255,255,255,.07)' }}>
      <p className="text-[9px] uppercase tracking-[.22em] mb-3" style={{ color: GOLD }}>Your structure</p>
      {structure.connected ? <div className="space-y-2">{structure.descriptors.map(text => <div key={text} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full" style={{ background: GOLD }} /><span className="font-body text-[13px] text-white/80">{text}</span></div>)}</div>
        : <p className="font-body text-[13px] text-white/65">This scan predates measured facial geometry. Take a new scan to enable structure-based matching.</p>}
    </div>
    {structure.connected && image ? <button onClick={onContinue} className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]" style={{ background: GOLD_GRADIENT, color: '#080808' }}>Continue</button>
      : <button onClick={onRescan} className="w-full py-4 rounded-2xl font-heading font-bold text-[15px]" style={{ background: GOLD_GRADIENT, color: '#080808' }}>Take a connected scan</button>}
  </div>
}

function Matching({ profile, structure }) {
  const [step, setStep] = useState(0)
  const steps = ['Matching styles', 'Ranking matches', 'Preparing slideshow']
  useEffect(() => {
    const timer = setInterval(() => setStep(value => Math.min(2, value + 1)), 700)
    return () => clearInterval(timer)
  }, [])
  return <div className="min-h-[78vh] px-6 flex flex-col items-center justify-center text-center">
    <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-20 h-20 rounded-[26px] flex items-center justify-center mb-7" style={{ background: 'rgba(198,168,92,.1)', border: '1px solid rgba(198,168,92,.35)', boxShadow: '0 0 50px rgba(198,168,92,.12)' }}><Scissors size={31} color={GOLD} /></motion.div>
    <p className="text-[10px] tracking-[.26em] uppercase mb-2" style={{ color: GOLD }}>Building your looks</p>
    <h2 className="font-heading font-bold text-[26px] text-white mb-7">Made for your face and hair.</h2>
    <div className="w-full max-w-xs space-y-3 text-left">
      {[`Face geometry${structure.connected ? '' : ' unavailable'}`, `${profile.hairType} hair`, `${profile.density} density`].map(text => <div key={text} className="flex items-center gap-3"><span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(198,168,92,.16)', color: GOLD }}><Check size={13} /></span><span className="text-[13px] text-white/65 capitalize">{text}</span></div>)}
    </div>
    <div className="mt-9 flex items-center gap-2">{steps.map((label, index) => <div key={label} className="flex items-center gap-2"><i className="block w-2 h-2 rounded-full" style={{ background: index <= step ? GOLD : 'rgba(255,255,255,.14)' }} />{index === step && <span className="text-[10px] uppercase tracking-wider text-white/45">{label}</span>}</div>)}</div>
  </div>
}

function CatalogModelImage({ recommendation, className = '' }) {
  const crop = recommendation.style.image
  const x = (crop.x / (crop.sheetWidth - crop.width)) * 100
  const y = (crop.y / (crop.sheetHeight - crop.height)) * 100
  return <div className={`relative overflow-hidden ${className}`} role="img" aria-label={`${recommendation.style.name} model reference`}
    style={{
      aspectRatio: `${crop.width}/${crop.height}`,
      backgroundColor: '#111',
      backgroundImage: `url(${crop.sheet})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${(crop.sheetWidth / crop.width) * 100}% ${(crop.sheetHeight / crop.height) * 100}%`,
      backgroundPosition: `${x}% ${y}%`,
      border: '1px solid rgba(255,255,255,.08)',
    }}>
    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent 68%, rgba(0,0,0,.36))' }} />
    {recommendation.rank === 1 && <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-[9px] font-heading font-bold uppercase tracking-wider" style={{ background: GOLD, color: '#080808' }}>Best match</div>}
  </div>
}

function DetailSheet({ recommendation, onClose, onBarber }) {
  const style = recommendation.style
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.78)' }} onClick={onClose}>
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={SPRING_STANDARD} className="w-full max-h-[88vh] overflow-y-auto rounded-t-[30px] p-5" style={{ background: '#111', borderTop: '1px solid rgba(255,255,255,.1)' }} onClick={event => event.stopPropagation()}>
      <div className="flex justify-between items-start mb-5"><div><p className="text-[9px] uppercase tracking-[.2em]" style={{ color: GOLD }}>Why it works</p><h3 className="font-heading font-bold text-[24px] text-white mt-1">{style.name}</h3></div><button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: PANEL }}><X size={16} color="white" /></button></div>
      <CatalogModelImage recommendation={recommendation} className="w-full rounded-2xl mb-5" />
      <div className="space-y-4">
        <section><p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">Why it fits you</p><p className="text-[13px] leading-relaxed text-white/80">{conciseReason(recommendation)}</p></section>
        <section><p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">Hair compatibility</p><p className="text-[13px] leading-relaxed text-white/80">{recommendation.compatibilityFactors?.length ? recommendation.compatibilityFactors.join(' · ') : 'Compatible with your selected hair type, density, and strand thickness.'}</p></section>
        <div className="grid grid-cols-2 gap-3"><section className="rounded-xl p-3" style={{ background: PANEL }}><p className="text-[9px] uppercase text-white/40">Maintenance</p><p className="text-[13px] capitalize text-white mt-1">{style.maintenance}</p></section><section className="rounded-xl p-3" style={{ background: PANEL }}><p className="text-[9px] uppercase text-white/40">Growth</p><p className="text-[13px] text-white mt-1">{style.growth}</p></section></div>
        <section><p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">Styling</p><p className="text-[13px] leading-relaxed text-white/80">{style.styling}</p></section>
      </div>
      <button onClick={onBarber} className="w-full mt-6 py-4 rounded-2xl font-heading font-bold text-[14px]" style={{ background: GOLD_GRADIENT, color: '#080808' }}>Show barber</button>
    </motion.div>
  </motion.div>
}

function BarberMode({ recommendation, onClose }) {
  const { style } = recommendation
  return <div className="fixed inset-0 z-[60] overflow-y-auto px-5 pb-10" style={{ background: BG, paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
    <div className="flex items-center justify-between mb-5"><button onClick={onClose}><ArrowLeft size={22} color="white" /></button><p className="font-heading font-bold text-white">Show Barber</p><div className="w-6" /></div>
    <CatalogModelImage recommendation={recommendation} className="w-full rounded-[26px] mb-6" />
    <p className="text-[10px] uppercase tracking-[.22em] mb-1" style={{ color: GOLD }}>Reference</p><h2 className="font-heading font-bold text-[27px] text-white mb-6">{style.name}</h2>
    <div className="space-y-3">{Object.entries(style.barber).map(([part, value]) => <div key={part} className="rounded-2xl p-4" style={{ background: PANEL, border: '1px solid rgba(255,255,255,.07)' }}><p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">{part}</p><p className="text-[14px] text-white/85 leading-relaxed">{value}</p></div>)}</div>
    <div className="rounded-2xl p-4 mt-3" style={{ background: 'rgba(198,168,92,.08)', border: '1px solid rgba(198,168,92,.22)' }}><p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: GOLD }}>Styling</p><p className="text-[14px] text-white/85">{style.styling}</p></div>
  </div>
}

function Looks({ recommendations, active, setActive, savedIds, onSave, onDetails, onSaved }) {
  const item = recommendations[active]
  if (!item) return null
  const go = direction => setActive(value => (value + direction + recommendations.length) % recommendations.length)
  return <div className="px-5 pb-10">
    <div className="pt-5 flex items-end justify-between mb-4"><div><p className="text-[10px] uppercase tracking-[.24em]" style={{ color: GOLD }}>HairMax</p><h1 className="font-heading font-bold text-[28px] text-white">Your Best Looks</h1></div><button onClick={onSaved} className="flex items-center gap-1.5 text-[11px] text-white/60"><Bookmark size={14} />{savedIds.length}</button></div>
    <motion.div key={item.hairstyleId} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={.18} onDragEnd={(_, info) => { if (info.offset.x < -55) go(1); if (info.offset.x > 55) go(-1) }} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}>
      <div className="relative"><CatalogModelImage recommendation={item} className="w-full rounded-[28px]" /><button onClick={() => go(-1)} aria-label="Previous hairstyle" className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,.55)' }}><ChevronLeft size={18} color="white" /></button><button onClick={() => go(1)} aria-label="Next hairstyle" className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,.55)' }}><ChevronRight size={18} color="white" /></button></div>
      <div className="pt-5"><div className="flex justify-between items-start"><div><p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: GOLD }}>{item.compatibility >= 90 ? 'Strong match' : 'Good match'}</p><h2 className="font-heading font-bold text-[23px] text-white">{item.style.name}</h2></div><span className="font-body text-[11px] text-white/40">{active + 1} / {recommendations.length}</span></div><p className="font-body text-[13px] text-white/60 mt-2 leading-relaxed max-w-[90%]">{conciseReason(item)}</p></div>
      <div className="grid grid-cols-2 gap-3 mt-5"><button onClick={() => onSave(item.hairstyleId)} className="py-3.5 rounded-2xl flex items-center justify-center gap-2 font-heading font-bold text-[12px]" style={{ background: savedIds.includes(item.hairstyleId) ? 'rgba(198,168,92,.14)' : PANEL, color: savedIds.includes(item.hairstyleId) ? GOLD : 'white', border: '1px solid rgba(255,255,255,.08)' }}><Heart size={15} fill={savedIds.includes(item.hairstyleId) ? GOLD : 'none'} />Save</button><button onClick={() => onDetails(item)} className="py-3.5 rounded-2xl font-heading font-bold text-[12px]" style={{ background: PANEL, color: 'white', border: '1px solid rgba(255,255,255,.08)' }}>Details</button></div>
      <div className="flex justify-center gap-1.5 mt-5">{recommendations.map((value, index) => <button key={value.hairstyleId} onClick={() => setActive(index)} className="h-1.5 rounded-full transition-all" style={{ width: index === active ? 20 : 6, background: index === active ? GOLD : 'rgba(255,255,255,.18)' }} />)}</div>
    </motion.div>
  </div>
}

function SavedLooks({ recommendations, savedIds, onSelect }) {
  const saved = savedIds.map(id => recommendations.find(item => item.hairstyleId === id) ?? (() => {
    const style = HAIRSTYLE_CATALOG.find(item => item.id === id)
    return style ? { hairstyleId: id, style, reasons: [], compatibilityFactors: [], limitations: [] } : null
  })()).filter(Boolean)
  return <div className="px-5 py-6"><h1 className="font-heading font-bold text-[28px] text-white mb-1">Saved Looks</h1><p className="text-[13px] text-white/45 mb-6">Your hairstyle shortlist.</p>{saved.length ? <div className="grid grid-cols-2 gap-3">{saved.map(item => <button key={item.hairstyleId} onClick={() => onSelect(item)} className="text-left"><CatalogModelImage recommendation={item} className="w-full rounded-2xl" /><p className="font-heading font-bold text-[12px] text-white mt-2">{item.style.name}</p></button>)}</div> : <div className="rounded-2xl py-14 text-center" style={{ background: PANEL }}><Heart size={24} color={GOLD} className="mx-auto mb-3" /><p className="text-[13px] text-white/55">Save a look to compare later.</p></div>}</div>
}

export default function HairMaxx() {
  const navigate = useNavigate()
  const currentScan = useStore(state => state.currentScan)
  const fallbackScan = useStore(state => state.scans?.[0])
  const scan = currentScan ?? fallbackScan
  const lastFaceScanImage = useStore(state => state.lastFaceScanImage)
  const storedHairType = useStore(state => state.hairType)
  const setHairType = useStore(state => state.setHairType)
  const storedProfile = useStore(state => state.hairProfile)
  const setHairProfile = useStore(state => state.setHairProfile)
  const recommendationCache = useStore(state => state.hairRecommendationCache)
  const setRecommendationCache = useStore(state => state.setHairRecommendationCache)
  const savedIds = useStore(state => state.savedHairLookIds)
  const toggleSaved = useStore(state => state.toggleSavedHairLook)

  const structure = useMemo(() => structureFromScan(scan), [scan])
  const [sourceImage, setSourceImage] = useState(lastFaceScanImage || currentScan?.facePhotoUrl || null)
  const [stage, setStage] = useState('intro')
  const [question, setQuestion] = useState(0)
  const [profile, setProfile] = useState(() => storedProfile?.scanId === scan?.id ? storedProfile : {
    scanId: scan?.id ?? null, hairType: ['straight', 'wavy', 'curly', 'coily'].includes(storedHairType) ? storedHairType : null,
    density: null, strandThickness: null, desiredLength: 'any', maintenancePreference: 'any',
  })
  const [recommendations, setRecommendations] = useState([])
  const [active, setActive] = useState(0)
  const [detail, setDetail] = useState(null)
  const [barber, setBarber] = useState(null)

  useEffect(() => {
    if (sourceImage || !scan?.id) return
    loadScanMedia(scan.id).then(media => { if (media?.photo) setSourceImage(media.photo) })
  }, [scan?.id, sourceImage])

  const questions = useMemo(() => [
    { key: 'hairType', title: "What's your hair type?", subtitle: 'Choose your natural pattern.', options: HAIR_TYPES, columns: 2, visual: true },
    { key: 'density', title: 'How dense is your hair?', subtitle: 'How much scalp coverage and overall volume do you have?', options: DENSITIES, columns: 3 },
    { key: 'strandThickness', title: 'How thick are the strands?', subtitle: 'Choose how each individual strand feels.', options: THICKNESSES, columns: 3 },
    { key: 'desiredLength', title: 'What length are you open to?', subtitle: null, options: LENGTHS, columns: 4 },
    { key: 'maintenancePreference', title: 'How much styling do you want?', subtitle: null, options: [{ id: 'low', label: 'Low maintenance' }, { id: 'some', label: 'Some styling' }, { id: 'any', label: "Don't care" }], columns: 3 },
  ], [])

  function startQuestions() {
    const reusable = storedProfile?.scanId === scan?.id && ['hairType', 'density', 'strandThickness', 'desiredLength', 'maintenancePreference'].every(key => storedProfile[key])
    if (reusable) { beginMatching(storedProfile); return }
    setQuestion(profile.hairType ? 1 : 0)
    setStage('questions')
  }

  function answer(value) {
    const item = questions[question]
    const nextProfile = { ...profile, [item.key]: value, scanId: scan?.id ?? null }
    setProfile(nextProfile)
    if (question < questions.length - 1) setTimeout(() => setQuestion(index => index + 1), 140)
    else beginMatching(nextProfile)
  }

  function cacheKey(nextProfile) {
    const evidenceVersion = structure.evidence?.schemaVersion ?? structure.evidence?.version ?? 'measured-v1'
    const profileKey = ['hairType', 'density', 'strandThickness', 'desiredLength', 'maintenancePreference'].map(key => nextProfile[key]).join('|')
    return `${scan?.id ?? 'no-scan'}|${evidenceVersion}|${profileKey}|${HAIR_CATALOG_VERSION}`
  }

  function resolveRecommendations(items, engine, hairProfile) {
    return items.map((item, index) => {
      const style = HAIRSTYLE_CATALOG.find(value => value.id === item.hairstyleId)
      const hardCompatible = style && style.compatibleHairTypes.includes(hairProfile.hairType) &&
        style.compatibleDensity.includes(hairProfile.density) && style.compatibleThickness.includes(hairProfile.strandThickness)
      return hardCompatible ? {
        hairstyleId: item.hairstyleId, style, rank: item.rank ?? index + 1,
        compatibility: item.compatibility ?? Math.max(72, 97 - index * 4),
        reasons: item.matchReasons ?? item.reasons ?? [],
        relevantMeasurements: item.relevantMeasurements ?? [],
        compatibilityFactors: item.compatibilityFactors ?? [], limitations: item.limitations ?? [],
        engine: item.engine ?? engine,
      } : null
    }).filter(Boolean)
  }

  async function beginMatching(nextProfile) {
    setHairProfile(nextProfile)
    setHairType(nextProfile.hairType)
    setActive(0)
    const key = cacheKey(nextProfile)
    if (recommendationCache?.key === key && recommendationCache.recommendations?.length) {
      const cached = resolveRecommendations(recommendationCache.recommendations, recommendationCache.engine, nextProfile)
      if (cached.length) {
        setRecommendations(cached)
        setStage('looks')
        return
      }
    }
    setStage('matching')
    let ranked
    try {
      const response = await api.hair.recommend({ hairProfile: nextProfile, analysisEvidence: portableEvidence(structure.evidence) })
      ranked = resolveRecommendations(response.recommendations ?? [], response.engine, nextProfile)
    } catch (error) {
      console.error('[HairMax] Grounded recommendation request failed:', error?.message)
      ranked = rankHairstyles(nextProfile, structure, 8).map(item => ({ ...item, engine: 'deterministic_catalog_fallback_v1' }))
    }
    if (!ranked.length) { setRecommendations([]); setStage('recommend_error'); return }
    setRecommendationCache({
      key,
      engine: ranked[0]?.engine,
      recommendations: ranked.map(({ hairstyleId, rank, compatibility, reasons, relevantMeasurements, compatibilityFactors, limitations, engine }) => ({ hairstyleId, rank, compatibility, reasons, relevantMeasurements, compatibilityFactors, limitations, engine })),
    })
    setRecommendations(ranked)
    setStage('looks')
  }

  function back() {
    if (barber) { setBarber(null); return }
    if (detail) { setDetail(null); return }
    if (stage === 'intro') navigate(-1)
    else if (stage === 'questions') question > 0 ? setQuestion(value => value - 1) : setStage('intro')
    else if (stage === 'saved') setStage('looks')
    else setStage('intro')
  }

  const selectedQuestion = questions[question]
  return <MotionPage style={{ background: BG }}>
    <Header title="HairMax" onBack={back} right={stage === 'looks' ? <button onClick={() => setStage('saved')}><Bookmark size={18} color={GOLD} /></button> : null} />
    <AnimatePresence mode="wait">
      {stage === 'intro' && <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ConnectedIntro structure={structure} scan={scan} image={sourceImage} onContinue={startQuestions} onRescan={() => navigate('/scan/capture')} /></motion.div>}
      {stage === 'questions' && selectedQuestion && <motion.div key={`q-${question}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-5"><ChoiceGrid {...selectedQuestion} value={profile[selectedQuestion.key]} onChange={answer} /></motion.div>}
      {stage === 'matching' && <motion.div key="matching" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Matching profile={profile} structure={structure} /></motion.div>}
      {stage === 'recommend_error' && <motion.div key="recommend-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[70vh] px-6 flex flex-col items-center justify-center text-center"><Sparkles size={30} color={GOLD} /><h2 className="font-heading font-bold text-[22px] text-white mt-5">Couldn’t build your looks</h2><p className="text-[13px] text-white/50 mt-2 mb-6">Your scan is safe. Try the grounded matching step again.</p><button onClick={() => beginMatching(profile)} className="px-6 py-3 rounded-2xl font-heading font-bold text-[13px]" style={{ background: GOLD_GRADIENT, color: '#080808' }}>Try again</button></motion.div>}
      {stage === 'looks' && <motion.div key="looks" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Looks recommendations={recommendations} active={active} setActive={setActive} savedIds={savedIds} onSave={toggleSaved} onDetails={setDetail} onSaved={() => setStage('saved')} /></motion.div>}
      {stage === 'saved' && <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><SavedLooks recommendations={recommendations} savedIds={savedIds} onSelect={item => { setDetail(item); setStage('looks') }} /></motion.div>}
    </AnimatePresence>
    <AnimatePresence>{detail && <DetailSheet recommendation={detail} onClose={() => setDetail(null)} onBarber={() => { setBarber(detail); setDetail(null) }} />}</AnimatePresence>
    {barber && <BarberMode recommendation={barber} onClose={() => setBarber(null)} />}
  </MotionPage>
}
