// src/app/(admin)/admin/businesses/[businessId]/BusinessDetailClient.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Business,
  BusinessConfig,
  User,
  PlatformConfig,
  PlanType,
  BusinessStatus,
} from '@prisma/client';

type FullBusiness = Business & {
  config: BusinessConfig | null;
  owner: User | null;
  platformConfig: PlatformConfig[];
};

export default function BusinessDetailClient({
  business,
  businessId,
}: {
  business: FullBusiness;
  businessId: string;
}) {
  return (
    <>
      <BusinessConfigEditor config={business.config} businessId={businessId} />
      <SubscriptionManager business={business} />
      <DangerZone business={business} />
    </>
  );
}

// ─── BusinessConfigEditor ─────────────────────

function BusinessConfigEditor({
  config,
  businessId,
}: {
  config: BusinessConfig | null;
  businessId: string;
}) {
  const defaultConfig = {
    chatbotPersonality: config?.chatbotPersonality ?? 'friendly',
    chatbotWelcomeMessage: config?.chatbotWelcomeMessage ?? '',
    chatbotLanguage: config?.chatbotLanguage ?? 'en',
    deliveryCharge: config ? Number(config.deliveryCharge) : 0,
    freeDeliveryThreshold: config?.freeDeliveryThreshold
      ? Number(config.freeDeliveryThreshold)
      : null,
    deliveryTimeMessage: config?.deliveryTimeMessage ?? '',
    cashOnDelivery: config?.cashOnDelivery ?? true,
    bkashNumber: config?.bkashNumber ?? '',
    bkashInstructions: config?.bkashInstructions ?? '',
    nagadNumber: config?.nagadNumber ?? '',
    nagadInstructions: config?.nagadInstructions ?? '',
    notificationEmail: config?.notificationEmail ?? '',
    notifyOnOrder: config?.notifyOnOrder ?? true,
    notifyOnMessage: config?.notifyOnMessage ?? true,
    messengerEnabled: config?.messengerEnabled ?? false,
    socialAutoApprove: config?.socialAutoApprove ?? false,
    defaultPostTime: config?.defaultPostTime ?? '10:00',
  };

  const [form, setForm] = useState(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof typeof defaultConfig) {
    return {
      value: String(form[key] ?? ''),
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  function checkField(key: keyof typeof defaultConfig) {
    return {
      checked: Boolean(form[key]),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.checked })),
    };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/businesses/${businessId}/config`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
          credentials: 'include',
        },
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error((json as { error?: string }).error ?? 'Failed to save');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full bg-base border border-border rounded-md px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-sm';
  const labelClass = 'block text-xs font-medium text-text-secondary mb-1';

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
          Business Config
          {!config && (
            <span className="ml-2 text-yellow-400 normal-case font-normal">
              · Setup incomplete — showing defaults
            </span>
          )}
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-8 px-3 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 font-medium transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
      {error && <p className="text-sm text-error mb-3">{error}</p>}
      <div className="bg-surface border border-border rounded-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Chatbot */}
        <div className="space-y-3 md:col-span-2">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Chatbot
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Personality</label>
              <input className={inputClass} {...field('chatbotPersonality')} />
            </div>
            <div>
              <label className={labelClass}>Language</label>
              <input className={inputClass} {...field('chatbotLanguage')} />
            </div>
            <div>
              <label className={labelClass}>Default Post Time</label>
              <input
                type="time"
                className={inputClass}
                {...field('defaultPostTime')}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Welcome Message</label>
            <textarea
              rows={2}
              className={inputClass}
              {...field('chatbotWelcomeMessage')}
            />
          </div>
        </div>

        {/* Delivery */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Delivery
          </p>
          <div>
            <label className={labelClass}>Delivery Charge</label>
            <input
              type="number"
              className={inputClass}
              value={form.deliveryCharge}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  deliveryCharge: parseFloat(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div>
            <label className={labelClass}>Free Delivery Threshold</label>
            <input
              type="number"
              className={inputClass}
              value={form.freeDeliveryThreshold ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  freeDeliveryThreshold: e.target.value
                    ? parseFloat(e.target.value)
                    : null,
                }))
              }
            />
          </div>
          <div>
            <label className={labelClass}>Delivery Time Message</label>
            <input
              className={inputClass}
              {...field('deliveryTimeMessage')}
            />
          </div>
        </div>

        {/* Payments */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Payments
          </p>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="cod"
              {...checkField('cashOnDelivery')}
              className="accent-accent"
            />
            <label htmlFor="cod" className="text-sm text-text-primary">
              Cash on Delivery
            </label>
          </div>
          <div>
            <label className={labelClass}>bKash Number</label>
            <input className={inputClass} {...field('bkashNumber')} />
          </div>
          <div>
            <label className={labelClass}>Nagad Number</label>
            <input className={inputClass} {...field('nagadNumber')} />
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Notifications
          </p>
          <div>
            <label className={labelClass}>Notification Email</label>
            <input
              type="email"
              className={inputClass}
              {...field('notificationEmail')}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notifyOrder"
              {...checkField('notifyOnOrder')}
              className="accent-accent"
            />
            <label htmlFor="notifyOrder" className="text-sm text-text-primary">
              Notify on new orders
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notifyMsg"
              {...checkField('notifyOnMessage')}
              className="accent-accent"
            />
            <label htmlFor="notifyMsg" className="text-sm text-text-primary">
              Notify on new messages
            </label>
          </div>
        </div>

        {/* Social / Messenger */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Social & Messenger
          </p>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="messenger"
              {...checkField('messengerEnabled')}
              className="accent-accent"
            />
            <label htmlFor="messenger" className="text-sm text-text-primary">
              Messenger Bot Enabled
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoApprove"
              {...checkField('socialAutoApprove')}
              className="accent-accent"
            />
            <label htmlFor="autoApprove" className="text-sm text-text-primary">
              Auto-approve social posts
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── SubscriptionManager ──────────────────────

function SubscriptionManager({ business }: { business: FullBusiness }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function callPlan(body: Record<string, unknown>, key: string) {
    setError(null);
    setLoading(key);
    try {
      const res = await fetch(
        `/api/admin/businesses/${business.id}/plan`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        },
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error((json as { error?: string }).error ?? 'Failed');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  }

  const plans: PlanType[] = ['TRIAL', 'STARTER', 'PRO'];

  const btnBase =
    'h-8 px-3 text-sm rounded-md font-medium transition-colors border disabled:opacity-50';

  return (
    <section>
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Subscription
      </h2>
      {error && <p className="text-sm text-error mb-3">{error}</p>}
      <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
        <div>
          <p className="text-xs text-text-tertiary mb-2">Change Plan</p>
          <div className="flex gap-2 flex-wrap">
            {plans.map((plan) => (
              <button
                key={plan}
                disabled={loading !== null || business.plan === plan}
                className={`${btnBase} ${
                  business.plan === plan
                    ? 'bg-accent text-white border-accent'
                    : 'bg-transparent text-text-primary border-border hover:bg-surface-raised'
                }`}
                onClick={() => callPlan({ plan }, `plan-${plan}`)}
              >
                {loading === `plan-${plan}` ? 'Updating…' : plan}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-2">Trial & Billing</p>
          <div className="flex gap-2 flex-wrap">
            <button
              disabled={loading !== null}
              className={`${btnBase} bg-transparent text-text-primary border-border hover:bg-surface-raised`}
              onClick={() => {
                const expires = new Date();
                expires.setDate(expires.getDate() + 7);
                callPlan(
                  { plan: business.plan, planExpiresAt: expires.toISOString() },
                  'extend-trial',
                );
              }}
            >
              {loading === 'extend-trial' ? '…' : 'Extend Trial +7 days'}
            </button>
            <button
              disabled={loading !== null}
              className={`${btnBase} bg-transparent text-text-primary border-border hover:bg-surface-raised`}
              onClick={() => callPlan({ pause: true }, 'pause')}
            >
              {loading === 'pause' ? '…' : 'Pause Subscription'}
            </button>
          </div>
        </div>
        {business.planExpiresAt && (
          <p className="text-xs text-text-tertiary">
            Plan expires:{' '}
            {new Date(business.planExpiresAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </section>
  );
}

// ─── DangerZone ───────────────────────────────

function DangerZone({ business }: { business: FullBusiness }) {
  const [loading, setLoading] = useState<BusinessStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function callStatus(status: BusinessStatus) {
    if (
      !window.confirm(
        `Are you sure you want to set this business to ${status}? This takes effect immediately.`,
      )
    )
      return;
    setError(null);
    setLoading(status);
    try {
      const res = await fetch(
        `/api/admin/businesses/${business.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
          credentials: 'include',
        },
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error((json as { error?: string }).error ?? 'Failed');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-error uppercase tracking-wider mb-3">
        Danger Zone
      </h2>
      {error && <p className="text-sm text-error mb-3">{error}</p>}
      <div className="bg-surface border border-error/30 rounded-lg p-5 space-y-3">
        <p className="text-sm text-text-secondary">
          These actions take effect immediately and may impact the business and
          its customers.
        </p>
        <div className="flex gap-3 flex-wrap">
          {business.status !== 'SUSPENDED' && (
            <button
              disabled={loading !== null}
              onClick={() => callStatus('SUSPENDED')}
              className="h-9 px-4 text-sm rounded-md font-medium bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
            >
              {loading === 'SUSPENDED' ? 'Suspending…' : 'Suspend Business'}
            </button>
          )}
          {business.status === 'SUSPENDED' && (
            <button
              disabled={loading !== null}
              onClick={() => callStatus('ACTIVE')}
              className="h-9 px-4 text-sm rounded-md font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              {loading === 'ACTIVE' ? 'Reactivating…' : 'Reactivate Business'}
            </button>
          )}
          {business.status !== 'CANCELLED' && (
            <button
              disabled={loading !== null}
              onClick={() => callStatus('CANCELLED')}
              className="h-9 px-4 text-sm rounded-md font-medium bg-error/10 text-error hover:bg-error/20 transition-colors disabled:opacity-50"
            >
              {loading === 'CANCELLED' ? 'Cancelling…' : 'Cancel Business'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}