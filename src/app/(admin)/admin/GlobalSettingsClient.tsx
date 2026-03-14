'use client';
// src/app/(admin)/admin/GlobalSettingsClient.tsx
import { useState } from 'react';
import type { PlatformConfigKey } from '@/lib/types';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type FieldConfig = {
  key: PlatformConfigKey;
  label: string;
  hint?: string;
  validate?: (value: string) => string | null;
  sanitize?: (value: string) => string;
};

type SectionConfig = {
  title: string;
  description: string;
  fields: FieldConfig[];
};

type FieldState = {
  value: string;
  revealed: boolean;
  saving: boolean;
  error: string | null;
  saved: boolean;
  loading: boolean;
};

// ─────────────────────────────────────────────
// FIELD DEFINITIONS
// ─────────────────────────────────────────────

const SECTIONS: SectionConfig[] = [
  {
    title: 'Groq API Keys',
    description:
      'Each key is used exclusively for its designated feature. All four keys must be set for the platform to function.',
    fields: [
      {
        key: 'GROQ_KEY_CHATBOT',
        label: 'Chatbot Key',
        hint: 'Used for website chatbot conversations only.',
        validate: (v) =>
          v.startsWith('gsk_') ? null : 'Groq keys must start with "gsk_"',
      },
      {
        key: 'GROQ_KEY_DESCRIPTIONS',
        label: 'Descriptions Key',
        hint: 'Used for product description generation only.',
        validate: (v) =>
          v.startsWith('gsk_') ? null : 'Groq keys must start with "gsk_"',
      },
      {
        key: 'GROQ_KEY_SOCIAL',
        label: 'Social Key',
        hint: 'Used for social media post generation only.',
        validate: (v) =>
          v.startsWith('gsk_') ? null : 'Groq keys must start with "gsk_"',
      },
      {
        key: 'GROQ_KEY_MESSENGER',
        label: 'Messenger Key',
        hint: 'Used for Messenger bot intelligence only.',
        validate: (v) =>
          v.startsWith('gsk_') ? null : 'Groq keys must start with "gsk_"',
      },
    ],
  },
  {
    title: 'Cloudinary',
    description: 'Image storage, transformation, and delivery credentials.',
    fields: [
      {
        key: 'CLOUDINARY_CLOUD_NAME',
        label: 'Cloud Name',
        hint: 'Found in your Cloudinary dashboard.',
        sanitize: (v) => v.replace(/\/+$/, '').trim(),
      },
      {
        key: 'CLOUDINARY_API_KEY',
        label: 'API Key',
      },
      {
        key: 'CLOUDINARY_API_SECRET',
        label: 'API Secret',
        hint: 'Never exposed to the client.',
      },
    ],
  },
  {
    title: 'Resend',
    description: 'Transactional email sending for order confirmations and notifications.',
    fields: [
      {
        key: 'RESEND_API_KEY',
        label: 'API Key',
        hint: 'Found in your Resend dashboard.',
      },
    ],
  },
  {
    title: 'Stripe',
    description: 'Platform-level Stripe credentials for payment processing.',
    fields: [
      {
        key: 'STRIPE_PLATFORM_KEY',
        label: 'Platform Secret Key',
        hint: 'Use the secret key from your Stripe dashboard.',
      },
    ],
  },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function hasValue(configMap: Record<string, string>, key: string): boolean {
  return !!configMap[key];
}

// ─────────────────────────────────────────────
// EYE ICON (inline SVG — no import needed)
// ─────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }): React.ReactElement {
  if (open) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SpinnerIcon(): React.ReactElement {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" />
    </svg>
  );
}

function CheckIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// INDIVIDUAL FIELD COMPONENT
// ─────────────────────────────────────────────

function ConfigField({
  fieldConfig,
  isSet,
}: {
  fieldConfig: FieldConfig;
  isSet: boolean;
}): React.ReactElement {
  const [state, setState] = useState<FieldState>({
    value: '',
    revealed: false,
    saving: false,
    error: null,
    saved: false,
    loading: false,
  });

  function setPartial(partial: Partial<FieldState>): void {
    setState((prev) => ({ ...prev, ...partial }));
  }

  async function handleReveal(): Promise<void> {
    if (state.revealed) {
      setPartial({ revealed: false, value: '' });
      return;
    }

    setPartial({ loading: true, error: null });
    try {
      const res = await fetch(`/api/admin/platform-config/${fieldConfig.key}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch value');
      const json = (await res.json()) as { data?: { value?: string }; error?: string };
      const actualValue = json.data?.value ?? '';
      setPartial({ revealed: true, value: actualValue, loading: false });
    } catch {
      setPartial({ loading: false, error: 'Could not reveal value. Try again.' });
    }
  }

  async function handleSave(): Promise<void> {
    const rawValue = state.value.trim();
    if (!rawValue) {
      setPartial({ error: 'Value cannot be empty.' });
      return;
    }

    const sanitized = fieldConfig.sanitize ? fieldConfig.sanitize(rawValue) : rawValue;

    if (fieldConfig.validate) {
      const validationError = fieldConfig.validate(sanitized);
      if (validationError) {
        setPartial({ error: validationError });
        return;
      }
    }

    setPartial({ saving: true, error: null, saved: false });

    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: fieldConfig.key, value: sanitized }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? 'Save failed');
      }

      // Re-mask after save
      setPartial({ saving: false, saved: true, revealed: false, value: '' });
      setTimeout(() => setPartial({ saved: false }), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setPartial({ saving: false, error: message });
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setPartial({ value: e.target.value, error: null, saved: false });
  }

  const isDisabled = state.saving || state.loading;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--color-text-primary)]">
          {fieldConfig.label}
        </label>
        {isSet && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)] font-medium">
            Configured
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={state.revealed ? 'text' : 'password'}
            value={state.value}
            onChange={handleChange}
            disabled={isDisabled}
            placeholder={isSet ? '••••••••••••••••' : 'Enter value…'}
            className={cn(
              'w-full bg-[var(--color-surface)] border rounded-[var(--radius-md)] px-3 py-2',
              'text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]',
              'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'pr-10',
              state.error
                ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20'
                : 'border-[var(--color-border)]',
            )}
          />
          <button
            type="button"
            onClick={handleReveal}
            disabled={isDisabled}
            aria-label={state.revealed ? 'Hide value' : 'Reveal current value'}
            className={cn(
              'absolute right-2.5 top-1/2 -translate-y-1/2',
              'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'transition-colors',
            )}
          >
            {state.loading ? <SpinnerIcon /> : <EyeIcon open={state.revealed} />}
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isDisabled || !state.value.trim()}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 h-[38px] rounded-[var(--radius-md)]',
            'text-sm font-medium transition-colors whitespace-nowrap',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            state.saved
              ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
              : 'bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-hover)]',
          )}
        >
          {state.saving ? (
            <>
              <SpinnerIcon />
              Saving…
            </>
          ) : state.saved ? (
            <>
              <CheckIcon />
              Saved
            </>
          ) : (
            'Save'
          )}
        </button>
      </div>

      {fieldConfig.hint && !state.error && (
        <p className="text-xs text-[var(--color-text-tertiary)]">{fieldConfig.hint}</p>
      )}
      {state.error && (
        <p className="text-xs text-[var(--color-error)]">{state.error}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN CLIENT COMPONENT
// ─────────────────────────────────────────────

type GlobalSettingsClientProps = {
  configMap: Record<string, string>;
};

export default function GlobalSettingsClient({
  configMap,
}: GlobalSettingsClientProps): React.ReactElement {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Global Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Platform-level API keys and credentials. These apply to all businesses unless
          overridden per business.
        </p>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-5">
          <div className="border-b border-[var(--color-border)] pb-3">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {section.title}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              {section.description}
            </p>
          </div>

          <div className="space-y-5">
            {section.fields.map((field) => (
              <ConfigField
                key={field.key}
                fieldConfig={field}
                isSet={hasValue(configMap, field.key)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <p className="text-xs text-[var(--color-text-secondary)]">
          <span className="font-medium text-[var(--color-text-primary)]">Note:</span> Values
          are stored encrypted in the database and never logged. Each field saves
          independently — there is no global save button.
        </p>
      </div>
    </div>
  );
}