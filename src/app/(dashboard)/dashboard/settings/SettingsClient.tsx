// src/app/(dashboard)/dashboard/settings/SettingsClient.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CHATBOT_PERSONALITIES, PRODUCT_CATEGORIES, COLOR_SCHEMES } from '@/lib/constants';
import type { BusinessConfigShape } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type BrandingData = {
  name: string;
  slug: string;
  logo: string | null;
  tagline: string | null;
  accentColor: string;
  heroImages: string[];
  domain: string | null;
};

type SettingsClientProps = {
  config: BusinessConfigShape;
  brandingData: BrandingData;
  businessId: string;
  isSuperAdmin: boolean;
};

type NavItem = {
  id: string;
  label: string;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: 'branding', label: 'Store Branding' },
  { id: 'colorTheme', label: 'Color Theme' },
  { id: 'heroImages', label: 'Hero Images' },
  { id: 'payments', label: 'Payments' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'chatbot', label: 'Chatbot' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'social', label: 'Social Media' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
  { id: 'apikeys', label: 'API Keys' },
];

// ─── Small reusable field components ─────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-text-primary">{label}</label>
      {children}
      {hint && <p className="text-xs text-text-secondary">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        'w-full bg-surface border border-border rounded-md px-3 py-2',
        'text-text-primary placeholder:text-text-tertiary text-sm',
        'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      )}
    />
  );
}

function TextAreaInput({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        'w-full bg-surface border border-border rounded-md px-3 py-2',
        'text-text-primary placeholder:text-text-tertiary text-sm',
        'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
        'resize-none',
      )}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border',
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
          )}
        />
      </div>
      <span className="text-sm text-text-primary">{label}</span>
    </label>
  );
}

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  const labels: Record<SaveState, string> = {
    idle: 'Save',
    saving: 'Saving…',
    saved: 'Saved ✓',
    error: 'Error — Retry',
  };
  return (
    <button
      onClick={onClick}
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
      {labels[state]}
    </button>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-6 flex flex-col gap-5">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {children}
    </div>
  );
}

// ─── useSave hook ─────────────────────────────────────────────────────────────

function useSave(businessId: string) {
  const [states, setStates] = useState<Record<string, SaveState>>({});

  const save = useCallback(
    async (section: string, body: Record<string, unknown>) => {
      setStates((s) => ({ ...s, [section]: 'saving' }));
      const isBranding = section === 'branding';
      const url = isBranding
        ? `/api/admin/businesses/${businessId}`
        : `/api/admin/businesses/${businessId}/config`;
      const method = isBranding ? 'PUT' : 'PATCH';
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed');
        setStates((s) => ({ ...s, [section]: 'saved' }));
        setTimeout(() => setStates((s) => ({ ...s, [section]: 'idle' })), 2500);
      } catch {
        setStates((s) => ({ ...s, [section]: 'error' }));
        setTimeout(() => setStates((s) => ({ ...s, [section]: 'idle' })), 3000);
      }
    },
    [businessId],
  );

  const getState = (section: string): SaveState => states[section] ?? 'idle';

  return { save, getState };
}

// ─── Section: Hero Images ────────────────────────────────────────────────────

function HeroImagesSection({
  initial,
  save,
  saveState,
}: {
  initial: string[];
  save: (section: string, body: Record<string, unknown>) => Promise<void>;
  saveState: SaveState;
}) {
  const [images, setImages] = useState<string[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});

  async function uploadFile(file: File, index: number): Promise<string> {
    const sigRes = await fetch('/api/uploads', { credentials: 'include' });
    if (!sigRes.ok) throw new Error(`Signature request failed (${sigRes.status})`);
    const sigData = await sigRes.json();
    const { signature, timestamp, cloudName, apiKey, uploadPreset } =
      sigData.data ?? sigData;
    if (!cloudName) throw new Error('Cloudinary cloud name missing from environment variables.');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('signature', signature);
    formData.append('timestamp', String(timestamp));
    formData.append('api_key', apiKey);
    formData.append('folder', sigData.data?.folder ?? sigData.folder ?? '');
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadProgress((p) => ({ ...p, [index]: pct }));
        }
      };
      xhr.onload = () => {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 200) resolve(data.secure_url);
        else reject(new Error(data.error?.message ?? 'Upload failed'));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
      xhr.send(formData);
    });
  }

  async function handleFilesSelected(files: FileList) {
    const remaining = 8 - images.length;
    if (remaining <= 0) {
      alert('Maximum 8 hero images allowed. Remove some to add more.');
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const startIdx = images.length;
      const uploaded = await Promise.all(
        toUpload.map((file, i) => uploadFile(file, startIdx + i)),
      );
      setImages((prev) => [...prev, ...uploaded]);
    } catch {
      alert('One or more uploads failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  return (
    <SectionCard title="Hero Images">
      <p className="text-sm text-text-secondary">
        Upload up to 8 images for your store hero carousel. The first image is shown first.
        Drag to reorder using the arrow buttons.
      </p>

      {/* Upload zone */}
      <label className={cn(
        'flex flex-col items-center justify-center gap-3 w-full rounded-xl border-2 border-dashed border-border',
        'py-8 cursor-pointer transition-colors hover:border-accent hover:bg-accent/5',
        uploading && 'opacity-50 pointer-events-none',
        images.length >= 8 && 'opacity-40 pointer-events-none',
      )}>
        <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            {uploading ? 'Uploading…' : images.length >= 8 ? 'Maximum 8 images reached' : 'Click to upload images'}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5">
            PNG, JPG, WEBP — up to {8 - images.length} more • Recommended: 1600×900px (16:9)
          </p>
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={uploading || images.length >= 8}
          onChange={(e) => { if (e.target.files?.length) handleFilesSelected(e.target.files); }}
        />
      </label>

      {/* Upload progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="flex flex-col gap-2">
          {Object.entries(uploadProgress).map(([idx, pct]) => (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-text-secondary">
                <span>Image {Number(idx) + 1}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {images.map((url, i) => (
            <div
              key={url + i}
              className="relative rounded-xl overflow-hidden border border-border bg-surface-raised group"
              style={{ aspectRatio: '16/9' }}
            >
              <img
                src={url}
                alt={`Hero ${i + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200" />
              {/* Index badge */}
              <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center">
                {i + 1}
              </div>
              {/* Controls */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => moveImage(i, i - 1)}
                  disabled={i === 0}
                  className="w-6 h-6 rounded-md bg-black/70 text-white text-xs flex items-center justify-center hover:bg-black/90 disabled:opacity-30"
                  title="Move left"
                >
                  ←
                </button>
                <button
                  onClick={() => moveImage(i, i + 1)}
                  disabled={i === images.length - 1}
                  className="w-6 h-6 rounded-md bg-black/70 text-white text-xs flex items-center justify-center hover:bg-black/90 disabled:opacity-30"
                  title="Move right"
                >
                  →
                </button>
                <button
                  onClick={() => removeImage(i)}
                  className="w-6 h-6 rounded-md bg-error/80 text-white text-xs flex items-center justify-center hover:bg-error"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && !uploading && (
        <p className="text-sm text-text-tertiary text-center py-4">
          No hero images yet. Upload some above to enable the carousel.
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-text-tertiary">{images.length} / 8 images</p>
        <SaveButton
          state={saveState}
          onClick={() => save('branding', { heroImages: images })}
        />
      </div>
    </SectionCard>
  );
}

// ─── Section: Color Theme ─────────────────────────────────────────────────────

const CATEGORY_ORDER = ['Popular', 'Warm', 'Cool', 'Nature', 'Luxury', 'Neutral'];

function applyColorSchemeToPage(scheme: typeof COLOR_SCHEMES[number]) {
  const root = document.documentElement;
  root.style.setProperty('--color-accent', scheme.accent);
  root.style.setProperty('--color-accent-hover', scheme.accentHover);
  root.style.setProperty('--color-accent-text', scheme.accentText);
  root.style.setProperty('--color-store-bg', scheme.bg);
  root.style.setProperty('--color-store-surface', scheme.surface);
  root.style.setProperty('--color-store-border', scheme.border);
}

function ColorThemeSection({
  initialAccentColor,
  save,
  saveState,
}: {
  initialAccentColor: string;
  save: (section: string, body: Record<string, unknown>) => Promise<void>;
  saveState: SaveState;
}) {
  const currentScheme = COLOR_SCHEMES.find((s) => s.accent === initialAccentColor);
  const [selectedId, setSelectedId] = useState<string>(currentScheme?.id ?? 'violet');
  const [previewId, setPreviewId] = useState<string | null>(null);

  const activeId = previewId ?? selectedId;
  const activeScheme = COLOR_SCHEMES.find((s) => s.id === activeId) ?? COLOR_SCHEMES[0];

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    schemes: COLOR_SCHEMES.filter((s) => s.category === cat),
  })).filter((g) => g.schemes.length > 0);

  function handleHover(id: string) {
    setPreviewId(id);
    const scheme = COLOR_SCHEMES.find((s) => s.id === id);
    if (scheme) applyColorSchemeToPage(scheme);
  }

  function handleLeave() {
    setPreviewId(null);
    const selected = COLOR_SCHEMES.find((s) => s.id === selectedId);
    if (selected) applyColorSchemeToPage(selected);
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setPreviewId(null);
    const scheme = COLOR_SCHEMES.find((s) => s.id === id);
    if (scheme) applyColorSchemeToPage(scheme);
  }

  return (
    <SectionCard title="Color Theme">
      <p className="text-sm text-text-secondary">
        Choose a color theme for your public store. Hover to preview, click to select.
      </p>

      {/* Live preview strip */}
      <div
        className="rounded-lg border border-border overflow-hidden"
        style={{ '--color-accent': activeScheme.accent } as React.CSSProperties}
      >
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: activeScheme.bg, borderBottom: `1px solid ${activeScheme.border}` }}
        >
          <span className="text-sm font-semibold" style={{ color: activeScheme.textPrimary }}>
            {activeScheme.name} — Preview
          </span>
          <div className="flex items-center gap-2">
            <div
              className="h-7 px-3 rounded-md text-xs font-medium flex items-center"
              style={{ backgroundColor: activeScheme.accent, color: activeScheme.accentText }}
            >
              Add to Cart
            </div>
            <div
              className="h-7 px-3 rounded-md text-xs font-medium flex items-center border"
              style={{ borderColor: activeScheme.border, color: activeScheme.textSecondary, backgroundColor: activeScheme.surface }}
            >
              View Details
            </div>
          </div>
        </div>
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ backgroundColor: activeScheme.surface }}
        >
          <div className="w-10 h-10 rounded-md" style={{ backgroundColor: activeScheme.surfaceRaised, border: `1px solid ${activeScheme.border}` }} />
          <div className="flex flex-col gap-1 flex-1">
            <div className="h-2.5 rounded-full w-32" style={{ backgroundColor: activeScheme.textPrimary, opacity: 0.15 }} />
            <div className="h-2 rounded-full w-20" style={{ backgroundColor: activeScheme.textSecondary, opacity: 0.2 }} />
          </div>
          <div className="text-sm font-bold" style={{ color: activeScheme.accent }}>৳1,200</div>
        </div>
      </div>

      {/* Scheme grid by category */}
      {grouped.map(({ category, schemes }) => (
        <div key={category} className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{category}</p>
          <div className="grid grid-cols-4 gap-2">
            {schemes.map((scheme) => (
              <button
                key={scheme.id}
                onMouseEnter={() => handleHover(scheme.id)}
                onMouseLeave={handleLeave}
                onClick={() => handleSelect(scheme.id)}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all',
                  selectedId === scheme.id
                    ? 'border-accent ring-2 ring-accent/30 bg-accent/5'
                    : 'border-border hover:border-accent/50 hover:bg-surface-raised',
                )}
              >
                {/* Color swatch */}
                <div className="flex gap-0.5">
                  <div className="w-5 h-5 rounded-l-md" style={{ backgroundColor: scheme.accent }} />
                  <div className="w-5 h-5" style={{ backgroundColor: scheme.bg, border: `1px solid ${scheme.border}` }} />
                  <div className="w-5 h-5 rounded-r-md" style={{ backgroundColor: scheme.surface, border: `1px solid ${scheme.border}` }} />
                </div>
                <span className="text-xs text-text-secondary text-center leading-tight">{scheme.name}</span>
                {selectedId === scheme.id && (
                  <div
                    className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                    style={{ backgroundColor: scheme.accent }}
                  >
                    ✓
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Selected info */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: activeScheme.accent }} />
          <span className="text-sm text-text-secondary">
            Selected: <span className="text-text-primary font-medium">{COLOR_SCHEMES.find((s) => s.id === selectedId)?.name}</span>
          </span>
        </div>
        <SaveButton
          state={saveState}
          onClick={() => {
            const scheme = COLOR_SCHEMES.find((s) => s.id === selectedId);
            if (scheme) {
              save('branding', {
                accentColor: scheme.accent,
              });
            }
          }}
        />
      </div>
    </SectionCard>
  );
}

// ─── Section: Store Branding ──────────────────────────────────────────────────

function BrandingSection({
  initial,
  businessId,
  save,
  saveState,
}: {
  initial: BrandingData;
  businessId: string;
  save: (section: string, body: Record<string, unknown>) => Promise<void>;
  saveState: SaveState;
}) {
  const [name, setName] = useState(initial.name);
  const [tagline, setTagline] = useState(initial.tagline ?? '');
  const [accentColor, setAccentColor] = useState(initial.accentColor);
  const [domain, setDomain] = useState(initial.domain ?? '');
  const [logo, setLogo] = useState(initial.logo ?? '');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(initial.logo ?? '');

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const sigRes = await fetch('/api/uploads', { credentials: 'include' });
      if (!sigRes.ok) {
        const errData = await sigRes.json().catch(() => ({}));
        throw new Error(errData.error ?? `Signature request failed (${sigRes.status})`);
      }
      const sigData = await sigRes.json();
      // Handle both flat response and wrapped { data: ... } response shapes
      const { signature, timestamp, cloudName, apiKey, uploadPreset } =
        sigData.data ?? sigData;
      if (!cloudName) {
        throw new Error(
          'Cloudinary cloud name missing. Ensure NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and CLOUDINARY_CLOUD_NAME are set in your environment variables.',
        );
      }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', signature);
      formData.append('timestamp', String(timestamp));
      formData.append('api_key', apiKey);
      formData.append('folder', sigData.data?.folder ?? sigData.folder ?? '');
      const upRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData },
      );
      const upData = await upRes.json();
      if (!upRes.ok) {
        throw new Error(upData.error?.message ?? 'Cloudinary upload failed');
      }
      if (!upData.secure_url) {
        throw new Error('No URL returned from Cloudinary');
      }
      setLogo(upData.secure_url);
      setLogoPreview(upData.secure_url);
    } catch (err) {
      alert('Logo upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLogoUploading(false);
    }
  };

  // Preview accent color immediately on the page via CSS variable
  const handleColorChange = (v: string) => {
    setAccentColor(v);
    document.documentElement.style.setProperty('--color-accent', v);
  };

  return (
    <SectionCard title="Store Branding">
      <Field label="Store Name">
        <TextInput value={name} onChange={setName} placeholder="My Awesome Store" />
      </Field>
      <Field label="Store Logo" hint="Recommended: square image, at least 200×200px. PNG or SVG with transparent background works best.">
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-surface-raised shrink-0">
              <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
              <button
                onClick={() => { setLogo(''); setLogoPreview(''); }}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-error text-white text-[10px] flex items-center justify-center hover:opacity-80"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border bg-surface-raised flex items-center justify-center shrink-0">
              <span className="text-text-tertiary text-2xl">🖼</span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className={cn(
              'inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-md border border-border',
              'text-text-primary hover:bg-surface-raised transition-colors cursor-pointer',
              logoUploading && 'opacity-50 cursor-not-allowed pointer-events-none',
            )}>
              {logoUploading ? 'Uploading…' : 'Upload Logo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={logoUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />
            </label>
            <p className="text-xs text-text-tertiary">PNG, JPG, SVG, WEBP accepted</p>
          </div>
        </div>
      </Field>
      <Field label="Tagline" hint="Shown in the hero section of your store.">
        <TextInput value={tagline} onChange={setTagline} placeholder="Your tagline here" />
      </Field>
      <Field label="Accent Color" hint="Used for buttons, highlights, and the chatbot.">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => handleColorChange(e.target.value)}
            className="h-9 w-16 rounded-md border border-border bg-surface cursor-pointer p-0.5"
          />
          <span className="text-sm text-text-secondary font-mono">{accentColor}</span>
        </div>
      </Field>
      <Field
        label="Custom Domain"
        hint="Point your domain's CNAME to our servers then enter it here."
      >
        <TextInput value={domain} onChange={setDomain} placeholder="shop.yourdomain.com" />
      </Field>
      <div className="flex justify-end pt-1">
        <SaveButton
          state={saveState}
          onClick={() =>
            save('branding', {
              name,
              tagline: tagline || null,
              accentColor,
              domain: domain || null,
              logo: logo || null,
            })
          }
        />
      </div>
    </SectionCard>
  );
}

// ─── Section: Payments ────────────────────────────────────────────────────────

function PaymentsSection({
  initial,
  save,
  saveState,
}: {
  initial: BusinessConfigShape;
  save: (section: string, body: Record<string, unknown>) => Promise<void>;
  saveState: SaveState;
}) {
  const [cashOnDelivery, setCashOnDelivery] = useState(initial.cashOnDelivery);
  const [bkashNumber, setBkashNumber] = useState(initial.bkashNumber ?? '');
  const [bkashInstructions, setBkashInstructions] = useState(
    initial.bkashInstructions ?? '',
  );
  const [nagadNumber, setNagadNumber] = useState(initial.nagadNumber ?? '');
  const [nagadInstructions, setNagadInstructions] = useState(
    initial.nagadInstructions ?? '',
  );
  const [stripePublicKey, setStripePublicKey] = useState(
    initial.stripePublicKey ?? '',
  );
  const [stripeSecretKey, setStripeSecretKey] = useState(
    initial.stripeSecretKey ?? '',
  );

  return (
    <SectionCard title="Payments">
      <Toggle checked={cashOnDelivery} onChange={setCashOnDelivery} label="Cash on Delivery" />

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          bKash
        </p>
        <Field label="bKash Number">
          <TextInput
            value={bkashNumber}
            onChange={setBkashNumber}
            placeholder="01XXXXXXXXX"
          />
        </Field>
        <Field label="bKash Instructions">
          <TextAreaInput
            value={bkashInstructions}
            onChange={setBkashInstructions}
            placeholder="Send money to the number above, use your order number as reference."
          />
        </Field>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Nagad
        </p>
        <Field label="Nagad Number">
          <TextInput
            value={nagadNumber}
            onChange={setNagadNumber}
            placeholder="01XXXXXXXXX"
          />
        </Field>
        <Field label="Nagad Instructions">
          <TextAreaInput
            value={nagadInstructions}
            onChange={setNagadInstructions}
            placeholder="Send money to the number above, use your order number as reference."
          />
        </Field>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-4">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Stripe (Card Payments)
        </p>
        <Field label="Stripe Publishable Key">
          <TextInput
            value={stripePublicKey}
            onChange={setStripePublicKey}
            placeholder="pk_live_…"
          />
        </Field>
        <Field label="Stripe Secret Key">
          <TextInput
            value={stripeSecretKey}
            onChange={setStripeSecretKey}
            type="password"
            placeholder="sk_live_…"
          />
        </Field>
      </div>

      <div className="flex justify-end pt-1">
        <SaveButton
          state={saveState}
          onClick={() =>
            save('payments', {
              cashOnDelivery,
              bkashNumber: bkashNumber || null,
              bkashInstructions: bkashInstructions || null,
              nagadNumber: nagadNumber || null,
              nagadInstructions: nagadInstructions || null,
              stripePublicKey: stripePublicKey || null,
              stripeSecretKey: stripeSecretKey || null,
            })
          }
        />
      </div>
    </SectionCard>
  );
}

// ─── Section: Delivery ────────────────────────────────────────────────────────

function DeliverySection({
  initial,
  save,
  saveState,
}: {
  initial: BusinessConfigShape;
  save: (section: string, body: Record<string, unknown>) => Promise<void>;
  saveState: SaveState;
}) {
  const [deliveryCharge, setDeliveryCharge] = useState(
    String(initial.deliveryCharge),
  );
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(
    initial.freeDeliveryThreshold != null
      ? String(initial.freeDeliveryThreshold)
      : '',
  );
  const [deliveryTimeMessage, setDeliveryTimeMessage] = useState(
    initial.deliveryTimeMessage ?? '',
  );

  return (
    <SectionCard title="Delivery">
      <Field label="Delivery Charge (৳)" hint="Set to 0 for free delivery on all orders.">
        <TextInput
          type="number"
          value={deliveryCharge}
          onChange={setDeliveryCharge}
          placeholder="0"
        />
      </Field>
      <Field
        label="Free Delivery Threshold (৳)"
        hint="Orders above this amount get free delivery. Leave blank to disable."
      >
        <TextInput
          type="number"
          value={freeDeliveryThreshold}
          onChange={setFreeDeliveryThreshold}
          placeholder="e.g. 1000"
        />
      </Field>
      <Field label="Delivery Time Message" hint="Shown to customers at checkout.">
        <TextInput
          value={deliveryTimeMessage}
          onChange={setDeliveryTimeMessage}
          placeholder="3–5 business days"
        />
      </Field>
      <div className="flex justify-end pt-1">
        <SaveButton
          state={saveState}
          onClick={() =>
            save('delivery', {
              deliveryCharge: parseFloat(deliveryCharge) || 0,
              freeDeliveryThreshold: freeDeliveryThreshold
                ? parseFloat(freeDeliveryThreshold)
                : null,
              deliveryTimeMessage: deliveryTimeMessage || null,
            })
          }
        />
      </div>
    </SectionCard>
  );
}

// ─── Section: Chatbot ─────────────────────────────────────────────────────────

function ChatbotSection({
  initial,
  save,
  saveState,
}: {
  initial: BusinessConfigShape;
  save: (section: string, body: Record<string, unknown>) => Promise<void>;
  saveState: SaveState;
}) {
  const [personality, setPersonality] = useState(initial.chatbotPersonality);
  const [welcomeMessage, setWelcomeMessage] = useState(
    initial.chatbotWelcomeMessage,
  );
  const [language, setLanguage] = useState(initial.chatbotLanguage);
  const [knowledgeBase, setKnowledgeBase] = useState <
    Array<{ question: string; answer: string }>
  >(initial.knowledgeBase);

  const addKbEntry = () =>
    setKnowledgeBase((kb) => [...kb, { question: '', answer: '' }]);

  const updateKbEntry = (
    index: number,
    field: 'question' | 'answer',
    value: string,
  ) => {
    setKnowledgeBase((kb) =>
      kb.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)),
    );
  };

  const removeKbEntry = (index: number) =>
    setKnowledgeBase((kb) => kb.filter((_, i) => i !== index));

  return (
    <SectionCard title="Chatbot">
      <Field label="Personality">
        <div className="grid grid-cols-2 gap-2">
          {CHATBOT_PERSONALITIES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPersonality(p.id)}
              className={cn(
                'flex flex-col items-start gap-0.5 p-3 rounded-md border text-left transition-colors',
                personality === p.id
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-surface hover:bg-surface-raised',
              )}
            >
              <span className="text-sm font-medium text-text-primary">{p.name}</span>
              <span className="text-xs text-text-secondary">{p.description}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Welcome Message">
        <TextAreaInput
          value={welcomeMessage}
          onChange={setWelcomeMessage}
          placeholder="Hi! How can I help you today?"
          rows={2}
        />
      </Field>

      <Field label="Language">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className={cn(
            'w-full bg-surface border border-border rounded-md px-3 py-2',
            'text-text-primary text-sm',
            'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
          )}
        >
          <option value="en">English</option>
          <option value="bn">Bengali</option>
          <option value="ar">Arabic</option>
          <option value="hi">Hindi</option>
        </select>
      </Field>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">Knowledge Base</span>
          <button
            onClick={addKbEntry}
            className="text-xs text-accent hover:text-accent-hover font-medium"
          >
            + Add Entry
          </button>
        </div>
        {knowledgeBase.length === 0 && (
          <p className="text-sm text-text-secondary">
            No entries yet. Add FAQs your chatbot should know.
          </p>
        )}
        {knowledgeBase.map((entry, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 p-3 bg-surface-raised rounded-md border border-border"
          >
            <TextInput
              value={entry.question}
              onChange={(v) => updateKbEntry(i, 'question', v)}
              placeholder="Question"
            />
            <TextAreaInput
              value={entry.answer}
              onChange={(v) => updateKbEntry(i, 'answer', v)}
              placeholder="Answer"
              rows={2}
            />
            <button
              onClick={() => removeKbEntry(i)}
              className="self-end text-xs text-error hover:opacity-80"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-1">
        <SaveButton
          state={saveState}
          onClick={() =>
            save('chatbot', {
              chatbotPersonality: personality,
              chatbotWelcomeMessage: welcomeMessage,
              chatbotLanguage: language,
              knowledgeBase,
            })
          }
        />
      </div>
    </SectionCard>
  );
}

// ─── Section: Messenger ───────────────────────────────────────────────────────

function MessengerSection({
  initial,
  save,
  saveState,
}: {
  initial: BusinessConfigShape;
  save: (section: string, body: Record<string, unknown>) => Promise<void>;
  saveState: SaveState;
}) {
  const [messengerEnabled, setMessengerEnabled] = useState(
    initial.messengerEnabled,
  );
  const [facebookPageId, setFacebookPageId] = useState(
    initial.facebookPageId ?? '',
  );
  const [facebookPageToken, setFacebookPageToken] = useState(
    initial.facebookPageToken ?? '',
  );

   const openMetaOAuth = () => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    if (!appId) {
      alert('Facebook App ID is not configured. Please add NEXT_PUBLIC_META_APP_ID to your environment variables.');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/api/auth/facebook/callback');
    const scope = 'pages_messaging,pages_manage_posts,instagram_basic,instagram_content_publish,pages_read_engagement';
    const popup = window.open(
      `https://www.facebook.com/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`,
      'MetaOAuth',
      'width=600,height=700',
    );
    if (!popup) {
      alert('Please allow popups to connect your Facebook Page.');
    }
  };

  return (
    <SectionCard title="Messenger">
      <Toggle
        checked={messengerEnabled}
        onChange={setMessengerEnabled}
        label="Enable Messenger Bot"
      />
      <Field
        label="Facebook Page ID"
        hint="Find this in your Facebook Page settings > About."
      >
        <TextInput
          value={facebookPageId}
          onChange={setFacebookPageId}
          placeholder="123456789012345"
        />
      </Field>
      <Field
        label="Facebook Page Access Token"
        hint="Generated via the Meta developer console or the Connect button below."
      >
        <TextInput
          value={facebookPageToken}
          onChange={setFacebookPageToken}
          type="password"
          placeholder="EAA…"
        />
      </Field>
      <button
        onClick={openMetaOAuth}
        className="self-start flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-md border border-border text-text-primary hover:bg-surface-raised transition-colors"
      >
        Connect via Facebook
      </button>
      <div className="flex justify-end pt-1">
        <SaveButton
          state={saveState}
          onClick={() =>
            save('messenger', {
              messengerEnabled,
              facebookPageId: facebookPageId || null,
              facebookPageToken: facebookPageToken || null,
            })
          }
        />
      </div>
    </SectionCard>
  );
}

// ─── Section: Social Media ────────────────────────────────────────────────────

function SocialSection({
  initial,
  save,
  saveState,
}: {
  initial: BusinessConfigShape;
  save: (section: string, body: Record<string, unknown>) => Promise<void>;
  saveState: SaveState;
}) {
  const [instagramAccountId, setInstagramAccountId] = useState(
    initial.instagramAccountId ?? '',
  );
  const [socialAutoApprove, setSocialAutoApprove] = useState(
    initial.socialAutoApprove,
  );
  const [defaultPostTime, setDefaultPostTime] = useState(initial.defaultPostTime);

  return (
    <SectionCard title="Social Media">
      <Field
        label="Instagram Account ID"
        hint="Find this in your Meta Business Suite > Instagram settings."
      >
        <TextInput
          value={instagramAccountId}
          onChange={setInstagramAccountId}
          placeholder="17841400000000000"
        />
      </Field>
      <Field label="Default Posting Time" hint="Posts scheduled without a specific time use this.">
        <input
          type="time"
          value={defaultPostTime}
          onChange={(e) => setDefaultPostTime(e.target.value)}
          className={cn(
            'w-40 bg-surface border border-border rounded-md px-3 py-2',
            'text-text-primary text-sm',
            'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
          )}
        />
      </Field>
      <Toggle
        checked={socialAutoApprove}
        onChange={setSocialAutoApprove}
        label="Auto-approve generated posts (skip review)"
      />
      {socialAutoApprove && (
        <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
          Auto-approve is on. Posts will be published without your review.
        </p>
      )}
      <div className="flex justify-end pt-1">
        <SaveButton
          state={saveState}
          onClick={() =>
            save('social', {
              instagramAccountId: instagramAccountId || null,
              socialAutoApprove,
              defaultPostTime,
            })
          }
        />
      </div>
    </SectionCard>
  );
}

// ─── Section: Notifications ───────────────────────────────────────────────────

function NotificationsSection({
  initial,
  save,
  saveState,
}: {
  initial: BusinessConfigShape;
  save: (section: string, body: Record<string, unknown>) => Promise<void>;
  saveState: SaveState;
}) {
  const [notificationEmail, setNotificationEmail] = useState(
    initial.notificationEmail ?? '',
  );
  const [notifyOnOrder, setNotifyOnOrder] = useState(initial.notifyOnOrder);
  const [notifyOnMessage, setNotifyOnMessage] = useState(initial.notifyOnMessage);

  return (
    <SectionCard title="Notifications">
      <Field
        label="Notification Email"
        hint="Where to send order and message alerts."
      >
        <TextInput
          type="email"
          value={notificationEmail}
          onChange={setNotificationEmail}
          placeholder="you@example.com"
        />
      </Field>
      <div className="flex flex-col gap-3">
        <Toggle
          checked={notifyOnOrder}
          onChange={setNotifyOnOrder}
          label="Email me when a new order is placed"
        />
        <Toggle
          checked={notifyOnMessage}
          onChange={setNotifyOnMessage}
          label="Email me when a new Messenger message arrives"
        />
      </div>
      <div className="flex justify-end pt-1">
        <SaveButton
          state={saveState}
          onClick={() =>
            save('notifications', {
              notificationEmail: notificationEmail || null,
              notifyOnOrder,
              notifyOnMessage,
            })
          }
        />
      </div>
    </SectionCard>
  );
}

// ─── Section: API Keys (super admin only) ─────────────────────────────────────

function ApiKeysSection({ businessId }: { businessId: string }) {
  type KeyField = {
    key: string;
    label: string;
    placeholder: string;
  };

  const KEYS: KeyField[] = [
    {
      key: 'GROQ_KEY_CHATBOT',
      label: 'Groq Key — Chatbot',
      placeholder: 'gsk_…',
    },
    {
      key: 'GROQ_KEY_DESCRIPTIONS',
      label: 'Groq Key — Descriptions',
      placeholder: 'gsk_…',
    },
    {
      key: 'GROQ_KEY_SOCIAL',
      label: 'Groq Key — Social',
      placeholder: 'gsk_…',
    },
    {
      key: 'GROQ_KEY_MESSENGER',
      label: 'Groq Key — Messenger',
      placeholder: 'gsk_…',
    },
  ];

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(KEYS.map((k) => [k.key, ''])),
  );
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [loaded, setLoaded] = useState(false);

  // Load existing key values on mount so fields are not blank after save
  useEffect(() => {
    if (loaded) return;
    setLoaded(true);
    fetch(`/api/admin/platform-config?businessId=${businessId}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data.data)) return;
        const incoming: Record<string, string> = {};
        for (const entry of data.data as Array<{ key: string; value: string }>) {
          if (KEYS.some((k) => k.key === entry.key)) {
            incoming[entry.key] = entry.value ?? '';
          }
        }
        setValues((v) => ({ ...v, ...incoming }));
      })
      .catch(() => {});
  }, [businessId, loaded]);

  const toggleReveal = (key: string) =>
    setRevealed((r) => ({ ...r, [key]: !r[key] }));

  const saveKey = async (key: string, value: string) => {
    if (!value.startsWith('gsk_')) {
      alert('Groq API keys must start with "gsk_"');
      return;
    }
    setStates((s) => ({ ...s, [key]: 'saving' }));
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value, businessId }),
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
    <SectionCard title="API Keys">
           <p className="text-sm text-text-secondary">
        Enter your Groq API keys to power the AI chatbot, product descriptions, and social post generation.
        Get your free key at{' '}
        <a
          href="https://console.groq.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2"
        >
          console.groq.com
        </a>
        . All four fields can use the same key.
      </p>
      {KEYS.map((k) => (
        <Field key={k.key} label={k.label}>
          <div className="flex gap-2">
            <input
              type={revealed[k.key] ? 'text' : 'password'}
              value={values[k.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [k.key]: e.target.value }))
              }
              placeholder={k.placeholder}
              className={cn(
                'flex-1 bg-surface border border-border rounded-md px-3 py-2',
                'text-text-primary placeholder:text-text-tertiary text-sm font-mono',
                'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
              )}
            />
            <button
              onClick={() => toggleReveal(k.key)}
              className="h-9 px-3 text-xs border border-border rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
            >
              {revealed[k.key] ? 'Hide' : 'Show'}
            </button>
            <SaveButton
              state={states[k.key] ?? 'idle'}
              onClick={() => saveKey(k.key, values[k.key])}
            />
          </div>
        </Field>
      ))}
    </SectionCard>
  );
}

// ─── Section: Security (Password Change) ─────────────────────────────────────

function SecuritySection({ businessId }: { businessId: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSave() {
    setErrorMsg(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg('All fields are required');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setErrorMsg('New password must be different from your current password');
      return;
    }
    setSaveState('saving');
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Failed to change password');
        setSaveState('error');
        setTimeout(() => setSaveState('idle'), 3000);
        return;
      }
      setSaveState('saved');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  const strength =
    newPassword.length === 0 ? 0 : newPassword.length < 8 ? 1 : newPassword.length < 12 ? 2 : 3;
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong'];
  const strengthColors = ['', 'bg-error', 'bg-warning', 'bg-success'];
  const strengthTextColors = ['', 'text-error', 'text-warning', 'text-success'];

  return (
    <SectionCard title="Security">
      <p className="text-sm text-text-secondary">
        Change your account password. You will need your current password to make this change.
      </p>

      {errorMsg && (
        <div className="px-3 py-2 rounded-md bg-error/10 border border-error/20">
          <p className="text-error text-sm">{errorMsg}</p>
        </div>
      )}

      <Field label="Current Password">
        <TextInput
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Enter your current password"
        />
      </Field>

      <Field label="New Password" hint="Minimum 8 characters.">
        <TextInput
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="Enter a new password"
        />
        {newPassword.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex gap-1">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-300',
                    strength >= level ? strengthColors[strength] : 'bg-border',
                  )}
                />
              ))}
            </div>
            <p className={cn('text-xs', strength > 0 ? strengthTextColors[strength] : 'text-text-tertiary')}>
              {strength > 0 ? `${strengthLabels[strength]} password` : ''}
            </p>
          </div>
        )}
      </Field>

      <Field label="Confirm New Password">
        <TextInput
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Repeat your new password"
        />
        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <p className="text-xs text-error mt-1">Passwords do not match</p>
        )}
        {confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length >= 8 && (
          <p className="text-xs text-success mt-1">Passwords match ✓</p>
        )}
      </Field>

      <div className="flex justify-end pt-1">
        <SaveButton state={saveState} onClick={handleSave} />
      </div>
    </SectionCard>
  );
}

// ─── Main SettingsClient ──────────────────────────────────────────────────────

export function SettingsClient({
  config,
  brandingData,
  businessId,
  isSuperAdmin,
}: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState('branding');
  const { save, getState } = useSave(businessId);

const visibleNav = NAV_ITEMS;

  return (
    <div className="flex min-h-screen">
      {/* Left sub-nav */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 border-r border-border pt-6 pr-4 gap-0.5">
        {visibleNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={cn(
              'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
              activeSection === item.id
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised',
            )}
          >
            {item.label}
          </button>
        ))}
      </aside>

      {/* Mobile tab strip */}
      <div className="lg:hidden w-full overflow-x-auto flex gap-2 px-4 py-3 border-b border-border">
        {visibleNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={cn(
              'shrink-0 px-3 py-1.5 text-sm rounded-full border transition-colors',
              activeSection === item.id
                ? 'border-accent bg-accent/10 text-accent font-medium'
                : 'border-border text-text-secondary hover:text-text-primary',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <main className="flex-1 px-6 py-6 max-w-2xl">
        {activeSection === 'branding' && (
          <BrandingSection
            initial={brandingData}
            businessId={businessId}
            save={save}
            saveState={getState('branding')}
          />
        )}
        {activeSection === 'colorTheme' && (
          <ColorThemeSection
            initialAccentColor={brandingData.accentColor}
            save={save}
            saveState={getState('branding')}
          />
        )}
        {activeSection === 'heroImages' && (
          <HeroImagesSection
            initial={brandingData.heroImages}
            save={save}
            saveState={getState('branding')}
          />
        )}
        {activeSection === 'payments' && (
          <PaymentsSection
            initial={config}
            save={save}
            saveState={getState('payments')}
          />
        )}
        {activeSection === 'delivery' && (
          <DeliverySection
            initial={config}
            save={save}
            saveState={getState('delivery')}
          />
        )}
        {activeSection === 'chatbot' && (
          <ChatbotSection
            initial={config}
            save={save}
            saveState={getState('chatbot')}
          />
        )}
        {activeSection === 'messenger' && (
          <MessengerSection
            initial={config}
            save={save}
            saveState={getState('messenger')}
          />
        )}
        {activeSection === 'social' && (
          <SocialSection
            initial={config}
            save={save}
            saveState={getState('social')}
          />
        )}
        {activeSection === 'notifications' && (
          <NotificationsSection
            initial={config}
            save={save}
            saveState={getState('notifications')}
          />
        )}
        {activeSection === 'security' && (
          <SecuritySection businessId={businessId} />
        )}
         {activeSection === 'apikeys' && (
          <ApiKeysSection businessId={businessId} />
        )}      </main>
    </div>
  );
}