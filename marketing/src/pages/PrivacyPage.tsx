import Header from '../components/Header'
import Footer from '../components/Footer'

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ fontSize: '1.25rem', marginTop: '2.25rem', marginBottom: '0.75rem', color: 'var(--text)', fontFamily: 'var(--heading)' }}>
    {children}
  </h2>
)

const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ marginBottom: '1rem' }}>{children}</p>
)

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main style={{ paddingTop: 96 }}>
        <div className="container-narrow section">
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Privacy Policy</h1>

          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.9375rem' }}>
            <p style={{ marginBottom: '2rem' }}>
              <strong style={{ color: 'var(--text)' }}>Last updated:</strong> 11 April 2026
            </p>

            <P>
              This Privacy Policy explains how ReviseOS Ltd ("ReviseOS", "we", "us", or "our") collects, uses, stores, and shares information about you when you use our website at <strong style={{ color: 'var(--text)' }}>reviseos.co.uk</strong> and the ReviseOS application (collectively, the "Service"). We are the data controller for the purposes of UK GDPR and the Data Protection Act 2018. Please read this policy carefully. By using the Service, you acknowledge that you have read and understood it.
            </P>

            <H2>1. Information we collect</H2>
            <P>We collect the following categories of information:</P>
            <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong style={{ color: 'var(--text)' }}>Account information.</strong> When you register or sign in with Google, we receive your name, email address, and profile picture from Google. If you register with an email and password, we store your email address and a bcrypt hash of your password — we never store your password in plain text.</li>
              <li><strong style={{ color: 'var(--text)' }}>Study content.</strong> Documents, notes, and other files you upload so that the Service can generate flashcards, quizzes, and knowledge graphs on your behalf.</li>
              <li><strong style={{ color: 'var(--text)' }}>Usage and performance data.</strong> Information about how you interact with the Service, such as modules visited, flashcard review outcomes, quiz scores, and spaced-repetition scheduling data. This is used to power adaptive learning features and is not shared with third parties.</li>
              <li><strong style={{ color: 'var(--text)' }}>Technical data.</strong> Your IP address, browser type, operating system, and device type, collected automatically when you access the Service. This is used for security, debugging, and abuse prevention.</li>
              <li><strong style={{ color: 'var(--text)' }}>Communications.</strong> If you contact us by email, we retain those communications to respond to your enquiry.</li>
            </ul>
            <P>We do not collect payment card details directly — payments are handled by our third-party payment processor and are subject to their privacy policy.</P>

            <H2>2. Legal basis for processing</H2>
            <P>We process your personal data on the following legal bases under UK GDPR:</P>
            <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong style={{ color: 'var(--text)' }}>Performance of a contract</strong> — to provide the Service and manage your account.</li>
              <li><strong style={{ color: 'var(--text)' }}>Legitimate interests</strong> — to ensure the security of the Service, prevent fraud, and improve our product, where these interests are not overridden by your rights.</li>
              <li><strong style={{ color: 'var(--text)' }}>Legal obligation</strong> — where we are required to process data to comply with applicable law.</li>
              <li><strong style={{ color: 'var(--text)' }}>Consent</strong> — for any optional processing (such as marketing communications), which you may withdraw at any time.</li>
            </ul>

            <H2>3. How we use your information</H2>
            <P>We use your information to:</P>
            <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>Create and manage your account;</li>
              <li>Process your uploaded study content through AI models to generate flashcards, quiz questions, summaries, and knowledge graphs;</li>
              <li>Schedule spaced-repetition review sessions and track your learning progress;</li>
              <li>Send transactional emails (e.g. password reset, account notifications);</li>
              <li>Detect and prevent fraudulent, abusive, or illegal use of the Service;</li>
              <li>Comply with our legal obligations;</li>
              <li>Respond to support enquiries.</li>
            </ul>
            <P>We do not sell your personal data. We do not use your study content to train AI models without your explicit, opt-in consent.</P>

            <H2>4. Cookies and local storage</H2>
            <P>
              We use a single essential <strong style={{ color: 'var(--text)' }}>session cookie</strong> to keep you authenticated. This cookie is HttpOnly (inaccessible to JavaScript), Secure (transmitted only over HTTPS), scoped to <code style={{ fontSize: '0.875rem', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.35rem', borderRadius: 4 }}>.reviseos.co.uk</code>, and expires after 7 days of inactivity.
            </P>
            <P>
              We may store a JWT token in your browser's <code style={{ fontSize: '0.875rem', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.35rem', borderRadius: 4 }}>localStorage</code> as a fallback for clients that block cookies. This token is used solely for authentication and is cleared on logout.
            </P>
            <P>We do not use advertising cookies, cross-site tracking cookies, or third-party analytics cookies. If this changes, we will update this policy and request your consent where required.</P>

            <H2>5. Sharing your information</H2>
            <P>We do not sell or rent your personal data. We may share your information only in the following limited circumstances:</P>
            <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong style={{ color: 'var(--text)' }}>Service providers.</strong> We use trusted third-party infrastructure providers (including cloud hosting, database, and AI API providers) who process data on our behalf under data processing agreements. These providers are contractually prohibited from using your data for any purpose other than providing services to us.</li>
              <li><strong style={{ color: 'var(--text)' }}>Google.</strong> If you sign in with Google, your authentication is handled via OAuth 2.0. We receive only the profile scopes you authorise. We do not access your Google Drive, Gmail, or any other Google services.</li>
              <li><strong style={{ color: 'var(--text)' }}>Legal requirements.</strong> We may disclose your information if required to do so by law, court order, or government authority, or if we reasonably believe disclosure is necessary to protect our rights, your safety, or the safety of others.</li>
              <li><strong style={{ color: 'var(--text)' }}>Business transfers.</strong> If ReviseOS is involved in a merger, acquisition, or sale of assets, your data may be transferred as part of that transaction. We will notify you before your data becomes subject to a different privacy policy.</li>
            </ul>

            <H2>6. Data retention</H2>
            <P>
              We retain your account data and study content for as long as your account is active. If you delete your account, we will delete or anonymise your personal data within 30 days, except where we are required to retain it for longer by law (for example, for tax or fraud-prevention purposes). Aggregated, anonymised analytics data that cannot be linked back to you may be retained indefinitely.
            </P>

            <H2>7. Data security</H2>
            <P>
              We take reasonable technical and organisational measures to protect your data against unauthorised access, alteration, disclosure, or destruction. These include encrypted data transmission (TLS 1.2+), bcrypt password hashing, HttpOnly session cookies, and access controls limiting who within our team can access production data. However, no method of transmission over the internet or method of electronic storage is 100% secure, and we cannot guarantee absolute security.
            </P>

            <H2>8. International transfers</H2>
            <P>
              Your data may be processed on servers located outside the United Kingdom. Where we transfer personal data outside the UK, we ensure that appropriate safeguards are in place (such as the UK International Data Transfer Agreement or equivalent standard contractual clauses) to ensure your data receives a comparable level of protection.
            </P>

            <H2>9. Your rights under UK GDPR</H2>
            <P>You have the following rights in relation to your personal data:</P>
            <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong style={{ color: 'var(--text)' }}>Access.</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong style={{ color: 'var(--text)' }}>Rectification.</strong> Ask us to correct inaccurate or incomplete data.</li>
              <li><strong style={{ color: 'var(--text)' }}>Erasure.</strong> Request deletion of your personal data ("right to be forgotten"), subject to legal retention obligations.</li>
              <li><strong style={{ color: 'var(--text)' }}>Restriction.</strong> Ask us to restrict how we process your data in certain circumstances.</li>
              <li><strong style={{ color: 'var(--text)' }}>Portability.</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong style={{ color: 'var(--text)' }}>Objection.</strong> Object to processing based on legitimate interests.</li>
              <li><strong style={{ color: 'var(--text)' }}>Withdraw consent.</strong> Where processing is based on consent, withdraw it at any time without affecting the lawfulness of prior processing.</li>
            </ul>
            <P>
              To exercise any of these rights, email us at <strong style={{ color: 'var(--text)' }}>hello@reviseos.co.uk</strong>. We will respond within 30 days. You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at <strong style={{ color: 'var(--text)' }}>ico.org.uk</strong> if you believe we have not handled your data lawfully.
            </P>

            <H2>10. Children's privacy</H2>
            <P>
              The Service is not directed at children under the age of 13. We do not knowingly collect personal data from children under 13. If we become aware that we have collected data from a child under 13 without parental consent, we will delete it promptly. Users aged 13–17 should obtain parental consent before using the Service, in accordance with our Terms of Service.
            </P>

            <H2>11. Third-party links</H2>
            <P>
              The Service may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to read their privacy policies before providing any personal information.
            </P>

            <H2>12. Changes to this policy</H2>
            <P>
              We may update this Privacy Policy from time to time. When we make material changes, we will notify you by email or by prominent notice within the Service at least 14 days before the changes take effect. The "Last updated" date at the top of this page will always reflect the most recent revision. Your continued use of the Service after the effective date constitutes acceptance of the updated policy.
            </P>

            <H2>13. Contact us</H2>
            <P>
              If you have any questions, concerns, or requests relating to this Privacy Policy or our data practices, please contact us at <strong style={{ color: 'var(--text)' }}>hello@reviseos.co.uk</strong>. We aim to respond to all enquiries within 5 business days.
            </P>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
