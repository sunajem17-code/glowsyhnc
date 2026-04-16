import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import MotionPage from '../components/MotionPage'

const GOLD = '#C6A85C'
const TEXT = '#F0EDE8'
const TEXT_DIM = '#5A5652'
const BORDER = 'rgba(255,255,255,0.07)'

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="font-heading font-bold text-[15px] mb-2" style={{ color: GOLD }}>{title}</h2>
      <div className="font-body text-[13px] leading-relaxed space-y-2" style={{ color: TEXT_DIM }}>
        {children}
      </div>
    </div>
  )
}

export default function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div className="page-scroll-full" style={{ background: '#080808' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <ChevronLeft size={18} style={{ color: TEXT }} />
        </button>
        <div>
          <h1 className="font-heading font-bold text-[17px]" style={{ color: TEXT }}>Privacy Policy</h1>
          <p className="text-[11px] font-body" style={{ color: TEXT_DIM }}>Last updated: April 2025</p>
        </div>
      </div>

      <div className="px-5 py-6 pb-20 max-w-2xl mx-auto">
        <div className="mb-6 px-4 py-4 rounded-2xl" style={{ background: 'rgba(198,168,92,0.06)', border: '1px solid rgba(198,168,92,0.2)' }}>
          <p className="font-body text-[12px] leading-relaxed" style={{ color: 'rgba(198,168,92,0.8)' }}>
            Ascendus is operated by Ascendus Inc. (Ontario, Canada). This policy explains how we collect, use, and protect your personal information in compliance with PIPEDA (Canadian federal privacy law), GDPR, and applicable US state laws.
          </p>
        </div>

        <Section title="1. What We Collect">
          <p>We collect the following personal information when you use Ascendus:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li><strong style={{ color: TEXT }}>Account data:</strong> Email address, name, and password (hashed)</li>
            <li><strong style={{ color: TEXT }}>Photos:</strong> Face and body photos you upload for scanning. These are treated as biometric data.</li>
            <li><strong style={{ color: TEXT }}>Scan results:</strong> AI-generated scores, metrics, and recommendations</li>
            <li><strong style={{ color: TEXT }}>Profile data:</strong> Height, weight, gender, hair type (optional)</li>
            <li><strong style={{ color: TEXT }}>Usage data:</strong> App activity, check-in history, streak data</li>
            <li><strong style={{ color: TEXT }}>Payment data:</strong> Processed by Stripe. We never store raw card details.</li>
          </ul>
        </Section>

        <Section title="2. How We Use Your Data">
          <p>We use your data solely to provide and improve the Ascendus service:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li>To analyze your photos using Anthropic Claude AI</li>
            <li>To generate personalized improvement plans and recommendations</li>
            <li>To track your progress over time</li>
            <li>To process subscription payments via Stripe</li>
            <li>To send transactional notifications (with your permission)</li>
          </ul>
          <p className="mt-2"><strong style={{ color: TEXT }}>We do not sell, rent, or share your personal data with third parties for marketing purposes.</strong></p>
        </Section>

        <Section title="3. AI & Biometric Data">
          <p>When you perform a scan, your photos are:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li>Transmitted securely (HTTPS/TLS) to our server</li>
            <li>Sent to <strong style={{ color: TEXT }}>Anthropic Claude API</strong> for AI analysis</li>
            <li>Stored in our Supabase database (hosted on AWS, us-east-1)</li>
            <li>Stored in Supabase Storage (scan-images bucket)</li>
          </ul>
          <p className="mt-2">Your facial image data may constitute biometric data under applicable law (including Illinois BIPA, Texas CUBI, and similar statutes). By providing explicit consent during onboarding, you authorize this processing for the sole purpose of appearance analysis.</p>
          <p className="mt-2">Anthropic's privacy policy governs their processing of data sent to their API. Anthropic does not train models on API inputs. See: anthropic.com/privacy</p>
        </Section>

        <Section title="4. Data Retention & Deletion">
          <p>You can delete your data at any time:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li><strong style={{ color: TEXT }}>Delete scan data:</strong> Profile → Privacy Settings → Delete All Scan Data</li>
            <li><strong style={{ color: TEXT }}>Delete account:</strong> Profile → Delete Account & Data</li>
            <li><strong style={{ color: TEXT }}>Email request:</strong> support@ascendus.com — we will delete within 30 days</li>
          </ul>
          <p className="mt-2">We retain anonymized usage analytics for up to 12 months. Payment records are retained as required by law.</p>
        </Section>

        <Section title="5. Third-Party Services">
          <p>We use the following third-party services, each with their own privacy policies:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li><strong style={{ color: TEXT }}>Anthropic Claude API</strong> — AI photo analysis (anthropic.com/privacy)</li>
            <li><strong style={{ color: TEXT }}>Supabase</strong> — Database and file storage (supabase.com/privacy)</li>
            <li><strong style={{ color: TEXT }}>Stripe</strong> — Payment processing (stripe.com/privacy)</li>
            <li><strong style={{ color: TEXT }}>Railway</strong> — Server hosting (railway.app/legal/privacy)</li>
          </ul>
        </Section>

        <Section title="6. Your Rights (PIPEDA / GDPR / CCPA)">
          <p>Depending on your jurisdiction, you have the right to:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent at any time</li>
            <li>Data portability (receive your data in a portable format)</li>
            <li>Lodge a complaint with your local data protection authority</li>
          </ul>
          <p className="mt-2">To exercise any of these rights, contact: <strong style={{ color: TEXT }}>support@ascendus.com</strong></p>
        </Section>

        <Section title="7. Children & Minors">
          <p>Ascendus is not intended for users under 17 years of age. We do not knowingly collect personal information from minors. If you believe a minor has created an account, contact us immediately at support@ascendus.com and we will delete the data.</p>
        </Section>

        <Section title="8. Security">
          <p>We protect your data using industry-standard security practices:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li>All data transmitted over HTTPS/TLS</li>
            <li>Passwords hashed with bcrypt</li>
            <li>JWT tokens for session management</li>
            <li>Row-level security (RLS) on all database tables</li>
            <li>API keys stored server-side only, never exposed to the browser</li>
          </ul>
        </Section>

        <Section title="9. Governing Law">
          <p>This Privacy Policy is governed by the laws of Ontario, Canada, and the federal Personal Information Protection and Electronic Documents Act (PIPEDA). Disputes shall be resolved in the courts of Ontario.</p>
        </Section>

        <Section title="10. Contact Us">
          <p>Privacy enquiries:</p>
          <p className="mt-1"><strong style={{ color: TEXT }}>Email:</strong> support@ascendus.com</p>
          <p><strong style={{ color: TEXT }}>Company:</strong> Ascendus Inc., Ontario, Canada</p>
        </Section>

        <p className="text-center font-body text-[11px] mt-6" style={{ color: TEXT_DIM }}>
          Ascendus v1.0 · © 2025 Ascendus Inc. · Ontario, Canada
        </p>
      </div>
    </div>
  )
}
