import MotionPage from '../components/MotionPage'
import PageHeader from '../components/PageHeader'
import { GOLD } from '../utils/theme'

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
  return (
    <div className="page-scroll-full" style={{ background: '#080808' }}>
      <div style={{ borderBottom: `1px solid ${BORDER}` }}>
        <PageHeader title="Privacy Policy" subtitle="Last updated: August 2026" back />
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
            <li><strong style={{ color: TEXT }}>Daily check-in data:</strong> Mood, water intake, skincare routine completions, and exercise logs. Collected to track your progress and personalize your looksmax plan over time.</li>
            <li><strong style={{ color: TEXT }}>Leaderboard data:</strong> Your public display name and improvement score. Collected to power community rankings and displayed publicly to other Ascendus users.</li>
            <li><strong style={{ color: TEXT }}>Referral data:</strong> Referral code and attribution (who referred you). Collected to track referrals and grant rewards accordingly.</li>
            <li><strong style={{ color: TEXT }}>Consent record:</strong> A timestamp of when you accepted our Terms of Service and Privacy Policy (<code>consent_at</code>), and whether you granted AI photo analysis consent (<code>ai_consent</code>). Retained for legal compliance purposes.</li>
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

        <Section title="3. Face Data">
          <p>When you submit a photo for analysis, it is transmitted securely to our server and sent to Anthropic's Claude AI API for processing. Your photos are stored in Supabase Storage (scan-images bucket) and are retained until you delete your account. See Section 6 for deletion options.</p>
        </Section>

        <Section title="4. TrueDepth Camera &amp; On-Device Face Scanning">
          <p>For fuller transparency: on supported iPhone models, Ascendus uses Apple's TrueDepth camera system (ARKit) to perform live face scanning. Here is what this means for your privacy:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li><strong style={{ color: TEXT }}>What the TrueDepth camera does:</strong> ARKit projects infrared dots onto your face and reads the reflection to construct a 3D face mesh (approximately 1,220 vertex points). This runs entirely on your device and is never recorded as a video or depth map.</li>
            <li><strong style={{ color: TEXT }}>What leaves your device:</strong> Only 18 computed numeric measurements (e.g. face width, jaw width, symmetry score) are extracted from the mesh and used to calculate your Glow Score. The raw depth data and 3D mesh are never transmitted to our servers or any third party.</li>
            <li><strong style={{ color: TEXT }}>Your photo (optional):</strong> If you use photo-based scanning, a JPEG of your face is captured and sent to our server for AI analysis (see Section 5). The TrueDepth geometric measurements and the photo upload are independent — raw depth data is never included in the upload.</li>
            <li><strong style={{ color: TEXT }}>Body and side-profile analysis:</strong> Body pose estimation and side-profile landmark detection use Apple's Vision framework, which runs entirely on-device. No image data leaves your phone as part of this analysis.</li>
            <li><strong style={{ color: TEXT }}>What we store:</strong> Only computed numeric scores and the optional JPEG. We never store raw depth maps, face meshes, or infrared sensor data.</li>
          </ul>
        </Section>

        <Section title="5. AI &amp; Biometric Data">
          <p>When you perform a photo-based scan, your photos are:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li>Transmitted securely (HTTPS/TLS) to our server</li>
            <li>Sent to <strong style={{ color: TEXT }}>Anthropic Claude API</strong> for AI analysis</li>
            <li>Stored in our Supabase database (hosted on AWS, us-east-1)</li>
            <li>Stored in Supabase Storage (scan-images bucket)</li>
          </ul>
          <p className="mt-2">Your facial image data may constitute biometric data under applicable law (including Illinois BIPA, Texas CUBI, and similar statutes). By providing explicit consent during onboarding, you authorize this processing for the sole purpose of appearance analysis.</p>
          <p className="mt-2">Anthropic's privacy policy governs their processing of data sent to their API. Anthropic does not train models on API inputs. See: anthropic.com/privacy</p>
        </Section>

        <Section title="6. Data Retention &amp; Deletion">
          <p>You can delete your data at any time:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li><strong style={{ color: TEXT }}>Delete All Scan Data</strong> (Profile → Privacy Settings → Delete All Scan Data): removes your scan history, scores, and photos from your device only. Photos and scan records stored on our servers are <em>not</em> removed by this action — use Delete Account & Data below to remove server-side data.</li>
            <li><strong style={{ color: TEXT }}>Delete Account &amp; Data</strong> (Profile → Delete Account & Data): permanently and immediately deletes your account, all scan records, and all photos stored on our servers. This action cannot be undone. You will be signed out upon confirmation.</li>
            <li><strong style={{ color: TEXT }}>Email request:</strong> support@ascendus.com — we will process deletion requests within 30 days as required by applicable law.</li>
          </ul>
          <p className="mt-2">We retain anonymized usage analytics for up to 12 months. Payment records are retained as required by law.</p>
        </Section>

        <Section title="7. Third-Party Services">
          <p>We use the following third-party services, each with their own privacy policies:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li><strong style={{ color: TEXT }}>Anthropic Claude API</strong>: AI photo analysis (anthropic.com/privacy)</li>
            <li><strong style={{ color: TEXT }}>Supabase</strong>: Database and file storage (supabase.com/privacy)</li>
            <li><strong style={{ color: TEXT }}>Apple App Store / StoreKit</strong>: In-app purchase processing on iOS (apple.com/legal/privacy)</li>
            <li><strong style={{ color: TEXT }}>RevenueCat</strong>: Subscription management on iOS (revenuecat.com/privacy)</li>
            <li><strong style={{ color: TEXT }}>Stripe</strong>: Payment processing on web (stripe.com/privacy)</li>
            <li><strong style={{ color: TEXT }}>Railway</strong>: Server hosting (railway.app/legal/privacy)</li>
          </ul>
        </Section>

        <Section title="8. Your Rights (PIPEDA / GDPR / CCPA)">
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

        <Section title="9. Children &amp; Minors">
          <p>Ascendus is not intended for users under 17 years of age. We do not knowingly collect personal information from minors. If you believe a minor has created an account, contact us immediately at support@ascendus.com and we will delete the data.</p>
        </Section>

        <Section title="10. Security">
          <p>We protect your data using industry-standard security practices:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            <li>All data transmitted over HTTPS/TLS</li>
            <li>Passwords hashed with bcrypt</li>
            <li>JWT tokens for session management</li>
            <li>Row-level security (RLS) on all database tables</li>
            <li>API keys stored server-side only, never exposed to the browser</li>
            <li>We use browser localStorage to store your session and scan results locally on your device</li>
          </ul>
        </Section>

        <Section title="11. Governing Law">
          <p>This Privacy Policy is governed by the laws of Ontario, Canada, and the federal Personal Information Protection and Electronic Documents Act (PIPEDA). Disputes shall be resolved in the courts of Ontario.</p>
        </Section>

        <Section title="12. Contact Us">
          <p>Privacy enquiries:</p>
          <p className="mt-1"><strong style={{ color: TEXT }}>Email:</strong> support@ascendus.com</p>
          <p><strong style={{ color: TEXT }}>Company:</strong> Ascendus Inc., Ontario, Canada</p>
        </Section>

        <p className="text-center font-body text-[11px] mt-6" style={{ color: TEXT_DIM }}>
          Ascendus v1.7.5 · © 2026 Ascendus Inc. · Ontario, Canada
        </p>
      </div>
    </div>
  )
}
