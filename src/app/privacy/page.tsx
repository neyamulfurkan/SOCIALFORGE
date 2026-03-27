export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <div className="prose prose-invert">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <h2>Information We Collect</h2>
        <p>We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support.</p>
        <h2>How We Use Your Information</h2>
        <p>We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.</p>
        <h2>Data Security</h2>
        <p>We implement appropriate technical and organizational measures to protect your personal information.</p>
        <h2>Contact Us</h2>
        <p>If you have questions about this Privacy Policy, please contact us at support@socialforge.io.</p>
      </div>
    </div>
  );
}