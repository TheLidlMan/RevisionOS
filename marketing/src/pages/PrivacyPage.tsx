import Header from '../components/Header'
import Footer from '../components/Footer'

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main style={{ paddingTop: 96 }}>
        <div className="container-narrow section">
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Privacy Policy</h1>
          <p style={{
            color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 500,
            marginBottom: '2rem', padding: '0.75rem 1rem',
            background: 'rgba(220,120,100,0.08)', borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(220,120,100,0.2)',
          }}>
            ⚠️ DRAFT — This is placeholder text and does not constitute legal advice. A finalised policy will be published before public launch.
          </p>

          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.9375rem' }}>
            <p style={{ marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--text)' }}>Last updated:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>

            <h2 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '0.75rem' }}>1. What we collect</h2>
            <p style={{ marginBottom: '1rem' }}>
              When you sign in with Google, we receive your name, email address, and profile picture from Google. We store these to identify your account. We do not request access to your Google Drive, contacts, or any other Google services.
            </p>

            <h2 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '0.75rem' }}>2. Cookies</h2>
            <p style={{ marginBottom: '1rem' }}>
              We use a single essential <strong style={{ color: 'var(--text)' }}>session cookie</strong> to keep you logged in. This cookie is:
            </p>
            <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
              <li>HttpOnly — cannot be read by JavaScript</li>
              <li>Secure — only sent over HTTPS</li>
              <li>Scoped to <code>.reviseos.co.uk</code></li>
              <li>Expires after 7 days</li>
            </ul>
            <p style={{ marginBottom: '1rem' }}>
              We do not use any analytics, advertising, or tracking cookies in this phase of the product.
            </p>

            <h2 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '0.75rem' }}>3. How we use your data</h2>
            <p style={{ marginBottom: '1rem' }}>
              Your uploaded study materials and revision data are used solely to provide the Revise OS service to you. We do not sell, share, or use your data for advertising purposes. Content you upload is processed by large language models to generate flashcards, quiz questions, and study aids on your behalf.
            </p>

            <h2 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '0.75rem' }}>4. Data storage</h2>
            <p style={{ marginBottom: '1rem' }}>
              Your data is stored securely. Session tokens are hashed before storage. Passwords (where applicable) are hashed with bcrypt. We retain your data for as long as your account is active.
            </p>

            <h2 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '0.75rem' }}>5. Your rights</h2>
            <p style={{ marginBottom: '1rem' }}>
              You may request deletion of your account and all associated data at any time by contacting us. [Placeholder: detailed rights under GDPR/UK GDPR will be listed here.]
            </p>

            <h2 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '0.75rem' }}>6. Contact</h2>
            <p style={{ marginBottom: '1rem' }}>
              For privacy-related enquiries, please email <strong style={{ color: 'var(--text)' }}>hello@reviseos.co.uk</strong>. [Placeholder: registered address and data controller details will be added.]
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
