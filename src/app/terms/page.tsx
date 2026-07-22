import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service | SocialView',
  description: 'The terms that govern access to and use of SocialView.',
};

const sections = [
  {
    title: '1. Agreement to these terms',
    paragraphs: [
      'By accessing or using SocialView, you agree to these Terms of Service. If you use SocialView on behalf of an organization, you confirm that you are authorized to accept these terms for that organization.',
      'If you do not agree to these terms, do not access or use the service.',
    ],
  },
  {
    title: '2. The service',
    paragraphs: [
      'SocialView is a reporting and management dashboard that can connect to third-party advertising, analytics, social media, and business systems. Features and integrations may change over time as we improve the service.',
      'Third-party services remain governed by their own terms and policies. SocialView does not control those services and is not responsible for their availability, accuracy, or changes.',
    ],
  },
  {
    title: '3. Accounts and access',
    paragraphs: [
      'You must provide accurate account information, keep your credentials confidential, and promptly notify your account administrator if you suspect unauthorized access. You are responsible for activity performed through your account unless prohibited by law.',
      'Access may be limited, suspended, or removed when necessary to protect the service, comply with law, address security risks, or enforce these terms.',
    ],
  },
  {
    title: '4. Acceptable use',
    paragraphs: ['You may use SocialView only for lawful, authorized business purposes. You must not:'],
    items: [
      'Access data, accounts, or systems without permission.',
      'Interfere with, probe, or disrupt the service or its security measures.',
      'Upload malicious code or use the service to distribute unlawful or harmful material.',
      'Reverse engineer, resell, or copy the service except where the law expressly permits it.',
      'Use automated means in a way that places an unreasonable load on the service.',
    ],
  },
  {
    title: '5. Your data and connected services',
    paragraphs: [
      'You retain your rights in the data you or your organization provides or connects to SocialView. You grant us the limited permission needed to host, process, display, and transmit that data to operate and support the service.',
      'You are responsible for having the rights and permissions required to connect accounts and provide data to SocialView. Our handling of personal information is described in the Privacy Policy.',
    ],
  },
  {
    title: '6. Availability and changes',
    paragraphs: [
      'We work to keep SocialView reliable, but the service is provided on an “as available” basis and may occasionally be interrupted for maintenance, updates, security work, or circumstances outside our control.',
      'We may update, add, or remove features. When a material change affects these terms, we may provide notice through the service or your account administrator.',
    ],
  },
  {
    title: '7. Intellectual property',
    paragraphs: [
      'SocialView, including its software, design, branding, and documentation, is protected by intellectual property laws. Except for the limited right to use the service under these terms, no rights are transferred to you.',
      'Feedback may be used to improve the service without restriction or compensation, provided it does not identify you or disclose your confidential information.',
    ],
  },
  {
    title: '8. Disclaimers and liability',
    paragraphs: [
      'To the extent permitted by law, the service is provided without warranties of merchantability, fitness for a particular purpose, or non-infringement. Reports and metrics may depend on data supplied by third parties and should be independently reviewed before making important decisions.',
      'To the extent permitted by law, SocialView and its providers will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, revenue, data, or business opportunity arising from use of the service.',
    ],
  },
  {
    title: '9. Termination',
    paragraphs: [
      'You may stop using SocialView at any time. Your organization or its administrator may also remove your access. Provisions that by their nature should survive termination—including ownership, disclaimers, and liability limitations—will remain in effect.',
    ],
  },
  {
    title: '10. Contact',
    paragraphs: [
      'Questions about these terms should be directed to your SocialView account administrator, who can route the request to the service operator.',
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      description="These terms explain the rules for using SocialView and the responsibilities that come with your account."
      updatedAt="July 21, 2026"
      sections={sections}
    />
  );
}
