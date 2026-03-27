export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <div className="prose prose-invert">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <h2>Acceptance of Terms</h2>
        <p>By accessing or using SocialForge, you agree to be bound by these Terms of Service.</p>
        <h2>Use of Service</h2>
        <p>You may use our service only for lawful purposes and in accordance with these terms.</p>
        <h2>Account Responsibility</h2>
        <p>You are responsible for maintaining the security of your account and for any activities that occur under your account.</p>
        <h2>Payment Terms</h2>
        <p>Fees for paid plans are billed in advance and are non-refundable except as required by law.</p>
        <h2>Contact</h2>
        <p>Questions about these Terms? Contact us at support@socialforge.io.</p>
      </div>
    </div>
  );
}