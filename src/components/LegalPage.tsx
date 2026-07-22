import Image from 'next/image';
import Link from 'next/link';

type LegalSection = {
  title: string;
  paragraphs: string[];
  items?: string[];
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
};

export function LegalPage({ eyebrow, title, description, updatedAt, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border-custom">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/login" className="font-semibold tracking-tight transition-colors hover:text-blue-600">
            SocialView
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            Back to sign in
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="max-w-2xl border-b border-border-custom pb-10">
          <p className="text-sm font-semibold text-blue-600">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-muted">{description}</p>
          <p className="mt-5 text-sm text-muted">Last updated: {updatedAt}</p>
        </div>

        <div className="mt-12 max-w-2xl space-y-12">
          {sections.map((section) => (
            <section key={section.title} aria-labelledby={section.title.toLowerCase().replaceAll(' ', '-')}>
              <h2
                id={section.title.toLowerCase().replaceAll(' ', '-')}
                className="text-xl font-bold tracking-tight"
              >
                {section.title}
              </h2>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-muted">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items && (
                  <ul className="list-disc space-y-2 pl-5 marker:text-blue-600">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </article>

      <footer className="border-t border-border-custom">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-6 text-xs text-muted sm:px-8">
          <span>© {new Date().getFullYear()} SocialView</span>
          <div className="flex items-center gap-2" aria-label="Powered by Coyô">
            <span>Powered by</span>
            <Image src="/coyo-logo.png" alt="Coyô" width={24} height={24} className="rounded-md" />
          </div>
        </div>
      </footer>
    </main>
  );
}
