'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

type GlobalSettingsClientProps = {
  configMap: Record<string, string>;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const KEY_GROUPS = [
  {
    title: 'Groq API Keys',
    hint: 'Get your free key at console.groq.com — all four fields can use the same key.',
    keys: [
      { key: 'GROQ_KEY_CHATBOT', label: 'Groq Key — Chatbot', placeholder: 'gsk_…' },
      { key: 'GROQ_KEY_DESCRIPTIONS', label: 'Groq Key — Descriptions', placeholder: 'gsk_…' },
      { key: 'GROQ_KEY_SOCIAL', label: 'Groq Key — Social', placeholder: 'gsk_…' },
      { key: 'GROQ_KEY_MESSENGER', label: 'Groq Key — Messenger', placeholder: 'gsk_…' },
    ],
  },
  {
    title: 'Cloudinary',
    hint: 'Image storage and delivery.',
    keys: [
      { key: 'CLOUDINARY_CLOUD_NAME', label: 'Cloud Name', placeholder: 'mycloud' },
      { key: 'CLOUDINARY_API_KEY', label: 'API Key', placeholder: '123456789' },
      { key: 'CLOUDINARY_API_SECRET', label: 'API Secret', placeholder: 'abc123…' },
    ],
  },
  {
    title: 'Resend',
    hint: 'Transactional email sending.',
    keys: [
      { key: 'RESEND_API_KEY', label: 'Resend API Key', placeholder: 're_…' },
    ],
  },
  {
    title: 'Stripe',
    hint: 'Card payment processing.',
    keys: [
      { key: 'STRIPE_PLATFORM_KEY', label: 'Stripe Secret Key', placeholder: 'sk_live_…' },
    ],
  },
];

export default function GlobalSettingsClient({ configMap }: GlobalSettingsClientProps) {
  const [values, setValues] = useState<Record<string, string>>(configMap);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});

  const toggleReveal = (key: string) =>
    setRevealed((r) => ({ ...r, [key]: !r[key] }));

  const saveKey = async (key: string, value: string) => {
    if (!value.trim()) {
      alert('Value cannot be empty');
      return;
    }
    if (key.startsWith('GROQ_KEY') && !value.startsWith('gsk_')) {
      alert('Groq API keys must start with "gsk_"');
      return;
    }
    setStates((s) => ({ ...s, [key]: 'saving' }));
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error('Failed');
      setStates((s) => ({ ...s, [key]: 'saved' }));
      setTimeout(() => setStates((s) => ({ ...s, [key]: 'idle' })), 2500);
    } catch {
      setStates((s) => ({ ...s, [key]: 'error' }));
      setTimeout(() => setStates((s) => ({ ...s, [key]: 'idle' })), 3000);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Global Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Platform-wide API keys. These apply to all businesses unless overridden per-business.
        </p>
      </div>

      {KEY_GROUPS.map((group) => (
        <div key={group.title} className="bg-surface border border-border rounded-lg p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{group.title}</h2>
            <p className="text-xs text-text-secondary mt-0.5">{group.hint}</p>
          </div>

          {group.keys.map(({ key, label, placeholder }) => {
            const state = states[key] ?? 'idle';
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-primary">{label}</label>
                <div className="flex gap-2">
                  <input
                    type={revealed[key] ? 'text' : 'password'}
                    value={values[key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={cn(
                      'flex-1 bg-surface-raised border border-border rounded-md px-3 py-2',
                      'text-text-primary placeholder:text-text-tertiary text-sm font-mono',
                      'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
                    )}
                  />
                  <button
                    onClick={() => toggleReveal(key)}
                    className="h-9 px-3 text-xs border border-border rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
                  >
                    {revealed[key] ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => saveKey(key, values[key] ?? '')}
                    disabled={state === 'saving'}
                    className={cn(
                      'h-9 px-4 text-sm font-medium rounded-md transition-colors',
                      state === 'saved'
                        ? 'bg-success/10 text-success border border-success/20'
                        : state === 'error'
                          ? 'bg-error/10 text-error border border-error/20'
                          : 'bg-accent text-accent-text hover:bg-accent-hover',
                      state === 'saving' && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : state === 'error' ? 'Error' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}