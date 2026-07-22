import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | SocialView',
  description: 'How SocialView collects, uses, and protects personal information.',
};

const sections = [
  {
    title: '1. Scope',
    paragraphs: [
      'This Privacy Policy explains how personal information is handled when you access or use SocialView. It applies to account holders and other people whose information may be processed through the service.',
      'Your organization may separately control business data connected to SocialView. Questions about that data should first be directed to your organization or account administrator.',
    ],
  },
  {
    title: '2. Information we collect',
    paragraphs: ['We collect information needed to provide, secure, and improve SocialView, including:'],
    items: [
      'Account information, such as your name, email address, role, and authentication details.',
      'Usage and technical information, such as device, browser, IP address, timestamps, and interactions with the service.',
      'Data from connected services, such as advertising, analytics, social media, and business performance information authorized by you or your organization.',
      'Support communications and feedback you choose to provide.',
    ],
  },
  {
    title: '3. How we use information',
    paragraphs: ['We use information to:'],
    items: [
      'Provide, operate, maintain, and personalize SocialView.',
      'Authenticate users, manage permissions, and protect accounts and the service.',
      'Connect authorized third-party services and present reporting data.',
      'Diagnose issues, monitor performance, and improve features and usability.',
      'Communicate about service, security, support, and policy updates.',
      'Comply with legal obligations and enforce applicable agreements.',
    ],
  },
  {
    title: '4. Legal bases',
    paragraphs: [
      'Where required by applicable law, we process personal information to perform a contract, pursue legitimate interests such as operating and securing the service, comply with legal obligations, or based on consent. You may withdraw consent where it is the applicable basis, without affecting earlier lawful processing.',
    ],
  },
  {
    title: '5. How information is shared',
    paragraphs: [
      'Information may be shared with your organization and authorized account users; vendors that support hosting, security, communications, analytics, and customer support; connected third-party services at your direction; and authorities or other parties when required by law or necessary to protect rights, safety, and security.',
      'We do not sell personal information. Vendors may process information only to provide services to us and under appropriate confidentiality and data protection obligations.',
    ],
  },
  {
    title: '6. Data retention',
    paragraphs: [
      'We retain personal information for as long as needed to provide the service, fulfill the purposes described here, meet legal and contractual requirements, resolve disputes, and maintain security. Retention periods vary depending on the type of information and the instructions of your organization.',
    ],
  },
  {
    title: '7. Security',
    paragraphs: [
      'We use administrative, technical, and organizational safeguards designed to protect information against unauthorized access, alteration, loss, or disclosure. No system is completely secure, so you should also protect your credentials and report suspected account misuse promptly.',
    ],
  },
  {
    title: '8. Your privacy rights',
    paragraphs: [
      'Depending on where you live, you may have rights to access, correct, delete, restrict, or object to certain processing of your personal information, request portability, or lodge a complaint with a data protection authority.',
      'To exercise a right, contact your SocialView account administrator. We may need to verify your identity and may direct requests concerning organization-controlled data to that organization.',
    ],
  },
  {
    title: '9. International processing',
    paragraphs: [
      'Information may be processed in countries other than the one where you live. When required, appropriate safeguards are used for international transfers of personal information.',
    ],
  },
  {
    title: '10. Children',
    paragraphs: [
      'SocialView is a business service and is not directed to children. We do not knowingly collect personal information from children through the service.',
    ],
  },
  {
    title: '11. Changes and contact',
    paragraphs: [
      'We may update this policy to reflect changes in the service, law, or our practices. The “Last updated” date shows when the latest version took effect.',
      'Questions or requests about privacy should be directed to your SocialView account administrator, who can route them to the service operator.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      description="This policy describes what information SocialView handles, why we use it, and the choices available to you."
      updatedAt="July 21, 2026"
      sections={sections}
    />
  );
}
