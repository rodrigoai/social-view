'use client';

import { FormEvent, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/',
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }

    router.replace('/');
  }

  async function handleForgotPassword() {
    setError('');
    setMessage('');
    setIsResetting(true);

    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    setIsResetting(false);

    if (!response.ok) {
      setError('Password reset email is not available. Contact an administrator.');
      return;
    }

    setMessage('If that email is active, a temporary password has been sent.');
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border-custom rounded-2xl p-6 shadow-xl"
        >
          <div className="mb-6">
            <p className="text-sm font-semibold text-blue-600">SocialView</p>
            <h1 className="text-2xl font-bold text-foreground mt-1">Sign in</h1>
            <p className="text-sm text-muted mt-1">Use your account credentials to continue.</p>
          </div>

          <label className="block text-sm font-semibold text-foreground mb-2" htmlFor="email">
            Email
          </label>
          <div className="relative mb-4">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border-custom bg-background text-foreground outline-none focus:border-blue-500"
              required
            />
          </div>

          <label className="block text-sm font-semibold text-foreground mb-2" htmlFor="password">
            Password
          </label>
          <div className="relative mb-4">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border-custom bg-background text-foreground outline-none focus:border-blue-500"
              required
            />
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition-colors"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isResetting || !email}
            className="mt-3 w-full py-2 rounded-xl text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
          >
            {isResetting ? 'Sending...' : 'Remember my password'}
          </button>
        </form>

        <footer className="mt-6 flex flex-col items-center gap-4 text-xs text-muted">
          <nav aria-label="Legal" className="flex items-center gap-3">
            <Link className="transition-colors hover:text-foreground" href="/terms">
              Terms of Service
            </Link>
            <span aria-hidden="true" className="h-3 w-px bg-border-custom" />
            <Link className="transition-colors hover:text-foreground" href="/privacy">
              Privacy Policy
            </Link>
          </nav>
          <div className="flex items-center gap-2" aria-label="Powered by Coyô">
            <span>Powered by</span>
            <Image src="/coyo-logo.png" alt="Coyô" width={24} height={24} className="rounded-md" />
          </div>
        </footer>
      </div>
    </main>
  );
}
