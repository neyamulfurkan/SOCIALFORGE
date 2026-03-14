// src/app/(admin)/admin/feature-flags/FeatureFlagsClient.tsx
'use client';

import { useState, useTransition, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ResolvedFlag, FlagOverride } from './types';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type BusinessSearchResult = {
  id: string;
  name: string;
};

type Props = {
  flags: ResolvedFlag[];
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function callFeatureFlagApi(payload: {
  flagKey: string;
  enabled: boolean;
  businessId?: string;
}): Promise<void> {
  const res = await fetch('/api/admin/feature-flags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string }).error ?? 'Request failed');
  }
}

async function searchBusinesses(query: string): Promise<BusinessSearchResult[]> {
  const res = await fetch(
    `/api/admin/businesses?search=${encodeURIComponent(query)}&pageSize=8`,
    { credentials: 'include' },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: Array<{ id: string; name: string }>;
  };
  return (json.data ?? []).map((b) => ({ id: b.id, name: b.name }));
}

// ─────────────────────────────────────────────
// TOGGLE SWITCH
// ─────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50',
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

// ─────────────────────────────────────────────
// OVERRIDE CHIP
// ─────────────────────────────────────────────

function OverrideChip({
  override,
  onRemove,
  removing,
}: {
  override: FlagOverride;
  onRemove: () => void;
  removing: boolean;
}): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity',
        override.enabled
          ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
          : 'bg-[var(--color-error)]/10 text-[var(--color-error)]',
        removing && 'opacity-40',
      )}
    >
      {override.businessName}
      <span className="text-[10px] opacity-60">({override.enabled ? 'on' : 'off'})</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        className="ml-0.5 rounded-full hover:opacity-70 focus-visible:outline-none"
        aria-label={`Remove override for ${override.businessName}`}
      >
        ×
      </button>
    </span>
  );
}

// ─────────────────────────────────────────────
// BUSINESS SEARCH
// ─────────────────────────────────────────────

function BusinessSearch({
  flagKey,
  existingOverrides,
  onAdd,
}: {
  flagKey: string;
  existingOverrides: FlagOverride[];
  onAdd: (business: BusinessSearchResult, enabled: boolean) => Promise<void>;
}): React.ReactElement {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BusinessSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (val: string): void => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const found = await searchBusinesses(val.trim());
      setResults(found.filter((b) => !existingOverrides.some((o) => o.businessId === b.id)));
      setSearching(false);
    }, 300);
  };

  const handleAdd = async (business: BusinessSearchResult, enabled: boolean): Promise<void> => {
    setAdding(business.id);
    try {
      await onAdd(business, enabled);
      setQuery('');
      setResults([]);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="mt-3 relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search business to add override…"
          className={cn(
            'flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]',
            'px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]',
            'focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20',
          )}
        />
        {searching && (
          <span className="text-xs text-[var(--color-text-secondary)]">Searching…</span>
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute left-0 right-0 z-10 mt-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-elevated)] overflow-hidden">
          {results.map((biz) => (
            <div
              key={biz.id}
              className="flex items-center justify-between px-3 py-2 hover:bg-[var(--color-surface-raised)] transition-colors"
            >
              <span className="text-sm text-[var(--color-text-primary)]">{biz.name}</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={adding === biz.id}
                  onClick={() => handleAdd(biz, true)}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium bg-[var(--color-success)]/10 text-[var(--color-success)]',
                    'hover:bg-[var(--color-success)]/20 transition-colors disabled:opacity-40',
                  )}
                >
                  Enable
                </button>
                <button
                  type="button"
                  disabled={adding === biz.id}
                  onClick={() => handleAdd(biz, false)}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium bg-[var(--color-error)]/10 text-[var(--color-error)]',
                    'hover:bg-[var(--color-error)]/20 transition-colors disabled:opacity-40',
                  )}
                >
                  Disable
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// FLAG ROW
// ─────────────────────────────────────────────

function FlagRow({ flag }: { flag: ResolvedFlag }): React.ReactElement {
  const [enabled, setEnabled] = useState(flag.enabled);
  const [overrides, setOverrides] = useState<FlagOverride[]>(flag.overrides);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const handleGlobalToggle = (val: boolean): void => {
    if (flag.protected && !val) return;
    startTransition(async () => {
      setError(null);
      const prev = enabled;
      setEnabled(val);
      try {
        await callFeatureFlagApi({ flagKey: flag.key.replace('flag:', ''), enabled: val });
      } catch (err) {
        setEnabled(prev);
        setError(err instanceof Error ? err.message : 'Failed to update flag');
      }
    });
  };

  const handleRemoveOverride = async (businessId: string): Promise<void> => {
    setRemovingId(businessId);
    setError(null);
    try {
      // Removing an override means deleting it — we send the global value to reset
      await callFeatureFlagApi({
        flagKey: flag.key.replace('flag:', ''),
        enabled,
        businessId,
      });
      setOverrides((prev) => prev.filter((o) => o.businessId !== businessId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove override');
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddOverride = async (
    business: BusinessSearchResult,
    overrideEnabled: boolean,
  ): Promise<void> => {
    setError(null);
    await callFeatureFlagApi({
      flagKey: flag.key.replace('flag:', ''),
      enabled: overrideEnabled,
      businessId: business.id,
    });
    setOverrides((prev) => [
      ...prev,
      { businessId: business.id, businessName: business.name, enabled: overrideEnabled },
    ]);
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {flag.protected && (
            <span
              title="This flag cannot be globally disabled"
              className="flex-shrink-0 text-[var(--color-warning)]"
              aria-label="Protected flag"
            >
              {/* Lock icon — inline SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{flag.label}</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 font-mono">{flag.key}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {isPending && (
            <span className="text-xs text-[var(--color-text-secondary)]">Saving…</span>
          )}
          <Toggle
            checked={enabled}
            onChange={handleGlobalToggle}
            disabled={flag.protected || isPending}
          />
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-[var(--color-error)]">{error}</p>
      )}

      {/* Per-business overrides */}
      {overrides.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {overrides.map((o) => (
            <OverrideChip
              key={o.businessId}
              override={o}
              onRemove={() => handleRemoveOverride(o.businessId)}
              removing={removingId === o.businessId}
            />
          ))}
        </div>
      )}

      {/* Add override */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowSearch((s) => !s)}
          className={cn(
            'text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            'transition-colors underline underline-offset-2',
          )}
        >
          {showSearch ? 'Cancel' : '+ Add per-business override'}
        </button>

        {showSearch && (
          <BusinessSearch
            flagKey={flag.key}
            existingOverrides={overrides}
            onAdd={handleAddOverride}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN CLIENT COMPONENT
// ─────────────────────────────────────────────

export default function FeatureFlagsClient({ flags }: Props): React.ReactElement {
  return (
    <div className="space-y-3">
      {flags.map((flag) => (
        <FlagRow key={flag.key} flag={flag} />
      ))}

      <p className="text-xs text-[var(--color-text-tertiary)] pt-2">
        Global toggle changes propagate to all businesses within 5 minutes.
        Per-business overrides take immediate effect.
        <br />
        Protected flags (
        <span className="inline-block align-middle text-[var(--color-warning)]">🔒</span>) cannot
        be globally disabled.
      </p>
    </div>
  );
}