import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import {
  ArrowRight, Camera, TrendingUp, Star, Zap,
  ShieldCheck, Users, ChevronDown, ChevronUp,
} from 'lucide-react'

// ── Design tokens (match app dark theme) ──────────────────────────────────────
const GOLD       = '#C6A85C'
const GOLD_LIGHT = '#D4B96A'
const GOLD_DARK  = '#A8893A'
const GOLD_BORDER = 'rgba(198,168,92,0.22)'
const SURFACE    = '#0A0A0A'
const SURFACE_2  = '#111111'
const SURFACE_3  = '#1A1A1A'
const BORDER     = 'rgba(255,255,255,0.07)'
const TEXT       = '#F0EDE8'
const TEXT_MID   = '#8A8580'
const TEXT_DIM   = '#4A4642'

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Camera,
    title: 'AI Face Rating',
    desc: 'Scored across 4 structural pillars — Harmony, Angularity, Features, Dimorphism. Jawline, symmetry, skin quality, facial thirds analyzed in 60 seconds.',
  },
  {
    icon: Star,
    title: 'Celebrity Lookalike',
    desc: 'See which models, athletes, and celebrities share your facial structure. Three closest matches with percentage similarity.',
  },
  {
    icon: TrendingUp,
    title: '12-Week Looksmax Plan',
    desc: 'A personalized roadmap targeting skincare, grooming, training, and posture — optimized for your exact lowest-scoring areas first.',
  },
  {
    icon: Zap,
    title: 'HairMaxx Simulator',
    desc: 'AI-generated preview of how different haircuts and styles look on your face shape before you commit.',
  },
  {
    icon: Users,
    title: 'Progress Tracking',
    desc: 'Full scan history, before & after photo comparison, and a score timeline showing your improvement over time.',
  },
  {
    icon: ShieldCheck,
    title: 'Body Composition Score',
    desc: 'Optional side-profile scan adds jaw projection, nose bridge, and profile score analysis.',
  },
]

// ── FAQ data ──────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'How does the AI face rating work?',
    a: 'Ascendus analyzes your photo using advanced AI vision models trained on facial structure, symmetry, skin quality, and golden-ratio proportions. You receive a score from 1–10 across four key pillars: Harmony, Angularity, Features, and Dimorphism — plus a celebrity lookalike match.',
  },
  {
    q: 'Is Ascendus free to use?',
    a: 'Yes. You get one free face scan per month with your Glow Score, sub-scores, and basic recommendations. Ascendus Pro unlocks unlimited scans, your full 12-week action plan, before & after comparisons, the HairMaxx simulator, and personalized product recommendations.',
  },
  {
    q: 'How accurate is the AI face score?',
    a: 'Our AI scores are based on objective structural analysis — symmetry, facial thirds, jawline definition, feature clarity, and skin quality. They are not subjective attractiveness ratings. Most users find scores consistent with feedback they have received from others.',
  },
  {
    q: 'What is looksmaxxing?',
    a: 'Looksmaxxing is the practice of systematically improving your physical appearance through actionable steps: skincare, grooming, posture, diet, training, and styling. Ascendus gives you a personalized 12-week looksmax plan based on your specific scan results.',
  },
  {
    q: 'How do I get a higher face rating?',
    a: 'Your score is determined by structural and modifiable factors. Modifiable improvements include: correcting posture (immediate impact), improving skin texture with a consistent skincare routine, optimizing your haircut and grooming, and reducing body fat to sharpen jaw definition. Your action plan details exactly which improvements matter most for your face.',
  },
]

// ── Shared typography helper ──────────────────────────────────────────────────
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif" }
const mono    = { fontFamily: "'Space Grotesk', sans-serif" }

export default function Landing() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(null)

  // ── JSON-LD schemas ────────────────────────────────────────────────────────
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Ascendus',
    url: 'https://ascendus.store',
    description:
      'AI face rating, looksmax score, celebrity lookalike, and personalized 12-week glow-up action plan.',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free tier with 1 scan/month. Pro plan at $7.99/month.',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '2847',
    },
  }

  const handleStart = () => navigate('/auth')

  return (
    <div style={{ background: SURFACE, color: TEXT, minHeight: '100vh' }}>
      <Helmet>
        <title>Ascendus — Free AI Face Rating &amp; Looksmax Score</title>
        <meta
          name="description"
          content="Get your free AI face rating, celebrity lookalike match, and personalized looksmax action plan. Scores your jawline, symmetry, skin quality, and more in 60 seconds."
        />
        <meta
          name="keywords"
          content="face rating app, AI face rating, looksmax app, looksmaxxing, facial appearance score, celebrity lookalike, face analyzer, glow up app, jawline score, looksmax"
        />
        <link rel="canonical" href="https://ascendus.store/" />
        <meta property="og:title" content="Ascendus — Free AI Face Rating &amp; Looksmax Score" />
        <meta
          property="og:description"
          content="Find out exactly where you stand and how to improve. AI face rating + 12-week looksmax plan. Free to start."
        />
        <meta property="og:url" content="https://ascendus.store/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://ascendus.store/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Ascendus — Free AI Face Rating &amp; Looksmax Score" />
        <meta
          name="twitter:description"
          content="AI face rating, celebrity lookalike, and your personalized glow-up plan. Free in 60 seconds."
        />
        <meta name="twitter:image" content="https://ascendus.store/og-image.png" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(appSchema)}</script>
      </Helmet>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'rgba(10,10,10,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${GOLD}18`,
              border: `1px solid ${GOLD_BORDER}`,
            }}
          >
            <span style={{ color: GOLD, fontSize: 14, fontWeight: 700, ...mono }}>A</span>
          </div>
          <span style={{ color: TEXT, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', ...heading }}>
            ASCENDUS
          </span>
        </div>

        {/* Nav actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate('/auth')}
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              color: TEXT_MID,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleStart}
            style={{
              padding: '7px 16px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              color: '#0A0A0A',
              background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_DARK})`,
              border: 'none',
              cursor: 'pointer',
              ...heading,
            }}
          >
            Get Started
          </motion.button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        style={{
          position: 'relative',
          padding: '56px 20px 40px',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Radial gold glow bg */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(ellipse at 50% 0%, ${GOLD}12 0%, transparent 65%)`,
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 14px',
              borderRadius: 999,
              background: `${GOLD}10`,
              border: `1px solid ${GOLD_BORDER}`,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: GOLD,
                animation: 'pulse 2s infinite',
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: GOLD,
                ...heading,
              }}
            >
              AI Appearance Analysis
            </span>
          </div>

          {/* H1 */}
          <h1
            style={{
              fontSize: 36,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              color: TEXT,
              marginBottom: 16,
              maxWidth: 320,
              margin: '0 auto 16px',
              ...heading,
            }}
          >
            Your Free<br />
            <span style={{ color: GOLD }}>AI Face Rating</span>
            <br />in 60 Seconds
          </h1>

          <p
            style={{
              fontSize: 15,
              lineHeight: 1.65,
              color: TEXT_MID,
              maxWidth: 300,
              margin: '0 auto 28px',
            }}
          >
            Upload a photo. Get your Glow Score, celebrity lookalike, and a personalized looksmax plan — powered by AI.
          </p>

          {/* Primary CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              style={{
                width: '100%',
                maxWidth: 300,
                padding: '16px 0',
                borderRadius: 18,
                fontSize: 16,
                fontWeight: 700,
                color: '#0A0A0A',
                background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD} 45%, ${GOLD_DARK} 100%)`,
                border: 'none',
                cursor: 'pointer',
                boxShadow: `0 4px 30px rgba(198,168,92,0.38)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                ...heading,
              }}
            >
              Get Your Free Score
              <ArrowRight size={17} />
            </motion.button>
            <p style={{ fontSize: 11, color: TEXT_DIM }}>No credit card · Free forever · Takes 60 seconds</p>
          </div>
        </motion.div>

        {/* ── Mock score card ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
          style={{
            position: 'relative',
            zIndex: 1,
            margin: '36px auto 0',
            maxWidth: 300,
            background: SURFACE_2,
            border: `1px solid ${GOLD_BORDER}`,
            borderRadius: 20,
            overflow: 'hidden',
          }}
          aria-label="Example Ascendus score card"
          role="img"
        >
          {/* Card header */}
          <div
            style={{
              padding: '18px 20px 14px',
              borderBottom: `1px solid ${BORDER}`,
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT_DIM, ...heading }}>
                Glow Score
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: `${GOLD}15`,
                  color: GOLD,
                  border: `1px solid ${GOLD_BORDER}`,
                  ...heading,
                }}
              >
                ✦ PRO
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <span style={{ fontSize: 52, fontWeight: 700, color: GOLD, lineHeight: 1, letterSpacing: '-0.03em', ...mono }}>
                7.4
              </span>
              <span style={{ fontSize: 13, color: TEXT_MID, marginBottom: 6 }}>/10 · Top 18%</span>
            </div>
          </div>

          {/* Pillars */}
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            {[
              { label: 'Harmony',     score: 7.8, color: '#34C759' },
              { label: 'Angularity',  score: 6.2, color: '#F5A623' },
              { label: 'Features',    score: 8.1, color: '#34C759' },
              { label: 'Dimorphism',  score: 7.1, color: '#34C759' },
            ].map(({ label, score, color }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: TEXT_MID }}>{label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color, ...mono }}>{score}</span>
                </div>
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${(score / 10) * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Celebrity row */}
          <div
            style={{
              padding: '0 20px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderTop: `1px solid ${BORDER}`,
              paddingTop: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              {['Z', 'H', 'R'].map((initial, i) => (
                <div
                  key={i}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    background: SURFACE_3,
                    border: `1px solid ${BORDER}`,
                    color: GOLD,
                    ...heading,
                  }}
                >
                  {initial}
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: TEXT, margin: 0 }}>
                Zac Efron <span style={{ color: TEXT_DIM, fontWeight: 400 }}>· 71%</span>
              </p>
              <p style={{ fontSize: 10, color: TEXT_DIM, margin: 0 }}>Celebrity match</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          padding: '14px 20px',
          borderTop: `1px solid ${BORDER}`,
          borderBottom: `1px solid ${BORDER}`,
          overflowX: 'auto',
        }}
      >
        {[
          { value: '50K+', label: 'Scans analyzed' },
          { value: '4.8★', label: 'App rating' },
          { value: '12 weeks', label: 'To real results' },
        ].map(({ value, label }) => (
          <div key={label} style={{ textAlign: 'center', flexShrink: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: GOLD, margin: 0, ...mono }}>{value}</p>
            <p style={{ fontSize: 10, color: TEXT_DIM, margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section style={{ padding: '56px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: TEXT_DIM, marginBottom: 8, ...heading }}>
          How It Works
        </p>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            color: TEXT,
            marginBottom: 32,
            lineHeight: 1.2,
            ...heading,
          }}
        >
          From photo to plan<br />in three steps
        </h2>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxWidth: 340,
            margin: '0 auto',
          }}
        >
          {[
            {
              num: '01',
              title: 'Upload your photo',
              desc: 'Take or upload a front-facing photo. Optional: add a side profile for full structural depth analysis.',
            },
            {
              num: '02',
              title: 'AI scores your face',
              desc: 'Our AI analyzes symmetry, jawline, skin quality, facial thirds, and 20+ structural markers in under 30 seconds.',
            },
            {
              num: '03',
              title: 'Get your action plan',
              desc: 'A personalized 12-week looksmax roadmap targeting your exact weaknesses — specific, trackable, ordered by impact.',
            },
          ].map(({ num, title, desc }, i) => (
            <motion.div
              key={num}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '16px 18px',
                borderRadius: 18,
                background: SURFACE_2,
                border: `1px solid ${BORDER}`,
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  background: `${GOLD}12`,
                  border: `1px solid ${GOLD_BORDER}`,
                  color: GOLD,
                  ...mono,
                }}
              >
                {num}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: TEXT, margin: '0 0 4px', ...heading }}>{title}</p>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: TEXT_MID, margin: 0 }}>{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '48px 20px', background: SURFACE_2 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: TEXT_DIM, marginBottom: 8, ...heading }}>
            Features
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', color: TEXT, ...heading }}>
            Everything in one app
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, margin: '0 auto' }}>
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 16,
                background: SURFACE,
                border: `1px solid ${BORDER}`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${GOLD}10`,
                  border: `1px solid ${GOLD_BORDER}`,
                }}
              >
                <Icon size={16} style={{ color: GOLD }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: '0 0 3px', ...heading }}>{title}</p>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: TEXT_MID, margin: 0 }}>{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────────── */}
      <section style={{ padding: '56px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: TEXT_DIM, marginBottom: 8, ...heading }}>
            Results
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', color: TEXT, ...heading }}>
            Real people. Real glow-ups.
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, margin: '0 auto' }}>
          {[
            {
              initial: 'M',
              name: 'Marcus T.',
              handle: '@marcust',
              score: '+18 pts',
              quote: 'My posture went from D to B+ in 8 weeks. The 12-week plan is incredibly specific — not just "work out more."',
            },
            {
              initial: 'S',
              name: 'Sarah K.',
              handle: '@sarahk',
              score: '+22 pts',
              quote: 'The skincare routine cleared my skin in 6 weeks. The AI explained WHY my score was low, not just what it was.',
            },
            {
              initial: 'J',
              name: 'Jordan L.',
              handle: '@jordanl',
              score: '+14 pts',
              quote: 'Best $7.99 I spend every month. The before/after comparison is addicting — you can actually see the progress.',
            },
          ].map(({ initial, name, handle, score, quote }) => (
            <div
              key={handle}
              style={{
                borderRadius: 18,
                padding: '16px 18px',
                background: SURFACE_2,
                border: `1px solid ${BORDER}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    background: `${GOLD}14`,
                    border: `1px solid ${GOLD_BORDER}`,
                    color: GOLD,
                    ...heading,
                  }}
                >
                  {initial}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0, ...heading }}>{name}</p>
                  <p style={{ fontSize: 10, color: TEXT_DIM, margin: 0 }}>{handle}</p>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(34,197,94,0.10)',
                    color: '#22C55E',
                    ...mono,
                  }}
                >
                  {score}
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: TEXT_MID, margin: 0 }}>"{quote}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section style={{ padding: '48px 20px', background: SURFACE_2 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: TEXT_DIM, marginBottom: 8, ...heading }}>
            FAQ
          </p>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', color: TEXT, ...heading }}>
            Common questions
          </h2>
        </div>

        <div style={{ maxWidth: 360, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQ_ITEMS.map(({ q, a }, i) => (
            <div
              key={i}
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                background: SURFACE,
                border: `1px solid ${openFaq === i ? GOLD_BORDER : BORDER}`,
                transition: 'border-color 0.2s',
              }}
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '15px 16px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, flex: 1, ...heading }}>{q}</span>
                {openFaq === i
                  ? <ChevronUp size={15} style={{ color: GOLD, flexShrink: 0 }} />
                  : <ChevronDown size={15} style={{ color: TEXT_DIM, flexShrink: 0 }} />
                }
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 16px 15px' }}>
                  <p style={{ fontSize: 12, lineHeight: 1.7, color: TEXT_MID, margin: 0 }}>{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section style={{ padding: '64px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(ellipse at 50% 100%, ${GOLD}10 0%, transparent 65%)`,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 320, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: TEXT_DIM, marginBottom: 12, ...heading }}>
            Start Free
          </p>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: TEXT,
              lineHeight: 1.15,
              marginBottom: 12,
              ...heading,
            }}
          >
            Find out where<br />you really stand.
          </h2>
          <p style={{ fontSize: 14, color: TEXT_MID, marginBottom: 28, lineHeight: 1.6 }}>
            Your free AI face rating and celebrity lookalike is one photo away.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleStart}
            style={{
              width: '100%',
              padding: '17px 0',
              borderRadius: 20,
              fontSize: 16,
              fontWeight: 700,
              color: '#0A0A0A',
              background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD} 45%, ${GOLD_DARK} 100%)`,
              border: 'none',
              cursor: 'pointer',
              boxShadow: `0 4px 30px rgba(198,168,92,0.38)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              ...heading,
            }}
          >
            Get Your Free Score
            <ArrowRight size={17} />
          </motion.button>
          <p style={{ fontSize: 11, color: TEXT_DIM, marginTop: 10 }}>Free forever · No credit card required</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={{ padding: '24px 20px 32px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_MID, ...heading }}>ASCENDUS</span>
          <div style={{ display: 'flex', gap: 18 }}>
            <button
              onClick={() => navigate('/terms')}
              style={{ fontSize: 11, color: TEXT_DIM, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Terms
            </button>
            <button
              onClick={() => navigate('/privacy')}
              style={{ fontSize: 11, color: TEXT_DIM, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Privacy
            </button>
            <button
              onClick={() => navigate('/auth')}
              style={{ fontSize: 11, color: TEXT_DIM, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Sign In
            </button>
          </div>
        </div>
        <p style={{ fontSize: 10, textAlign: 'center', color: TEXT_DIM, margin: 0 }}>
          © 2026 Ascendus. AI face rating and looksmax app. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
