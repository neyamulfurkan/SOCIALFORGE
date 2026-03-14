'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    storeName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch('/api/admin/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        storeName: form.storeName,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(res.status === 409 ? 'Email already registered' : (data.error ?? 'Registration failed'));
      setLoading(false);
      return;
    }

    await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    router.push('/onboarding');
  }

  const strength =
    form.password.length === 0 ? 0 : form.password.length < 8 ? 1 : form.password.length < 12 ? 2 : 3;

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface rounded-xl p-8 shadow-elevated">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Create Account</h1>
          <p className="text-sm text-text-secondary mt-1">Start selling on social in minutes</p>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-md bg-error/10 border border-error/20">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Jane Smith"
            required
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="jane@example.com"
            required
            autoComplete="email"
          />
          <Input
            label="Store Name"
            value={form.storeName}
            onChange={(e) => set('storeName', e.target.value)}
            placeholder="My Awesome Shop"
            required
          />
          <div className="space-y-2">
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
            />
            {form.password.length > 0 && <PasswordStrength strength={strength} />}
          </div>
          <Input
            label="Confirm Password"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
            placeholder="Repeat your password"
            required
            autoComplete="new-password"
          />
          <Button type="submit" loading={loading} className="w-full mt-2">
            Create Account
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-accent hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

function PasswordStrength({ strength }: { strength: 0 | 1 | 2 | 3 }) {
  const labels = ['', 'Weak', 'Fair', 'Strong'];
  const colors = ['', 'bg-error', 'bg-warning', 'bg-success'];
  const textColors = ['', 'text-error', 'text-warning', 'text-success'];

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300',
              strength >= level ? colors[strength] : 'bg-border',
            )}
          />
        ))}
      </div>
      <p className={cn('text-xs', strength > 0 ? textColors[strength] : 'text-text-tertiary')}>
        {strength > 0 ? `${labels[strength]} password` : ''}
      </p>
    </div>
  );
}