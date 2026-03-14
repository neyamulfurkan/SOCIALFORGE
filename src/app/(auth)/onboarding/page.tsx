'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from 'ai/react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PRODUCT_CATEGORIES, CHATBOT_PERSONALITIES } from '@/lib/constants';
import type { OnboardingState } from '@/lib/types';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type Step =
  | 'welcome'
  | 'storeName'
  | 'categories'
  | 'personality'
  | 'language'
  | 'delivery'
  | 'payments'
  | 'social'
  | 'complete';

type DisplayMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};

const STEP_ORDER: Step[] = [
  'welcome',
  'storeName',
  'categories',
  'personality',
  'language',
  'delivery',
  'payments',
  'social',
  'complete',
];

const STEP_QUESTIONS: Record<Step, string> = {
  welcome:
    "👋 Welcome! I'm here to set up your store in just a few steps. Let's start — what's the name of your business?",
  storeName: "Great name! Now, which product categories best describe what you sell? Pick as many as you like.",
  categories: "Perfect. How should your chatbot sound to customers?",
  personality: "Got it! What language should your chatbot use to talk to customers?",
  language: "Almost there. Describe your delivery policy in your own words — e.g. timelines, areas you cover.",
  delivery: "Which payment methods do you accept? Add your account numbers where applicable.",
  payments: "Last step — would you like to connect your Facebook Page now to enable Messenger and social posting?",
  social: "🎉 All done! Here's a summary of your setup. Ready to open your dashboard?",
  complete: '',
};

const LANGUAGE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'bn', label: 'বাংলা (Bengali)' },
  { id: 'en-bn', label: 'English & Bengali' },
];

const STORAGE_KEY = 'socialforge_onboarding';

const defaultAnswers: OnboardingState = {
  storeName: '',
  categories: [],
  personality: 'friendly',
  language: 'en',
  delivery: '',
  payments: { cod: true },
  facebookConnected: false,
};

// ─────────────────────────────────────────────
// LIVE PREVIEW
// ─────────────────────────────────────────────

function LivePreview({ answers }: { answers: OnboardingState }) {
  const personality = CHATBOT_PERSONALITIES.find((p) => p.id === answers.personality);
  const accentColor = '#7c3aed';

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-elevated border border-store-border bg-store-surface">
        {/* Mock Store Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: accentColor }}
        >
          <span className="text-white font-bold text-lg truncate">
            {answers.storeName || 'Your Store Name'}
          </span>
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-white/20" />
            <div className="w-6 h-6 rounded-full bg-white/20" />
          </div>
        </div>

        {/* Mock Product Grid */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg bg-store-bg border border-store-border overflow-hidden">
              <div className="aspect-[3/4] bg-border/30" />
              <div className="p-2">
                <div className="h-3 bg-border/40 rounded w-3/4 mb-1" />
                <div
                  className="h-3 rounded w-1/2"
                  style={{ backgroundColor: accentColor + '33' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Mock Chatbot Button */}
        <div className="px-4 pb-4 flex justify-end">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-elevated"
            style={{ backgroundColor: accentColor }}
          >
            <span className="text-white text-lg">✨</span>
          </div>
        </div>
      </div>

      {/* Config Summary */}
      <div className="mt-6 w-full max-w-sm space-y-2">
        {answers.storeName && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="text-success">✓</span>
            <span>Store: <span className="text-text-primary font-medium">{answers.storeName}</span></span>
          </div>
        )}
        {answers.categories.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="text-success">✓</span>
            <span>{answers.categories.length} categories selected</span>
          </div>
        )}
        {personality && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="text-success">✓</span>
            <span>Chatbot: <span className="text-text-primary font-medium">{personality.name}</span></span>
          </div>
        )}
        {answers.language && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="text-success">✓</span>
            <span>Language: <span className="text-text-primary font-medium">
              {LANGUAGE_OPTIONS.find((l) => l.id === answers.language)?.label ?? answers.language}
            </span></span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// STEP INPUTS
// ─────────────────────────────────────────────

function StoreNameInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Input
        placeholder="e.g. Dhaka Boutique"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && value.trim() && onSubmit()}
        autoFocus
        className="flex-1"
      />
      <Button onClick={onSubmit} disabled={!value.trim()} size="md">
        Next →
      </Button>
    </div>
  );
}

function CategoriesInput({
  selected,
  onToggle,
  onSubmit,
}: {
  selected: string[];
  onToggle: (cat: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRODUCT_CATEGORIES.map((cat) => {
          const active = selected.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => onToggle(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                active
                  ? 'bg-accent text-accent-text border-accent'
                  : 'border-border text-text-secondary hover:border-accent/50 hover:text-text-primary'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
      <Button onClick={onSubmit} disabled={selected.length === 0} size="md">
        Continue →
      </Button>
    </div>
  );
}

function PersonalityInput({
  selected,
  onSelect,
  onSubmit,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {CHATBOT_PERSONALITIES.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              selected === p.id
                ? 'border-accent bg-accent/10'
                : 'border-border hover:border-accent/50'
            }`}
          >
            <div className="font-medium text-text-primary text-sm">{p.name}</div>
            <div className="text-text-secondary text-xs mt-0.5">{p.description}</div>
          </button>
        ))}
      </div>
      <Button onClick={onSubmit} size="md">
        Continue →
      </Button>
    </div>
  );
}

function LanguageInput({
  selected,
  onSelect,
  onSubmit,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {LANGUAGE_OPTIONS.map((lang) => (
          <button
            key={lang.id}
            onClick={() => onSelect(lang.id)}
            className={`px-4 py-2.5 rounded-lg border text-left text-sm font-medium transition-colors ${
              selected === lang.id
                ? 'border-accent bg-accent/10 text-text-primary'
                : 'border-border text-text-secondary hover:border-accent/50 hover:text-text-primary'
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
      <Button onClick={onSubmit} size="md">
        Continue →
      </Button>
    </div>
  );
}

function DeliveryInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      <textarea
        className="w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors resize-none"
        rows={3}
        placeholder="e.g. We deliver within Dhaka in 2-3 days. Outside Dhaka takes 5-7 days."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
      />
      <Button onClick={onSubmit} disabled={!value.trim()} size="md">
        Continue →
      </Button>
    </div>
  );
}

function PaymentsInput({
  payments,
  onChange,
  onSubmit,
}: {
  payments: OnboardingState['payments'];
  onChange: (p: OnboardingState['payments']) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* bKash */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={!!payments.bkash !== undefined}
            onChange={() => {
              if (payments.bkash !== undefined) {
                const { bkash: _b, ...rest } = payments;
                onChange(rest);
              } else {
                onChange({ ...payments, bkash: '' });
              }
            }}
            className="accent-[var(--color-accent)]"
          />
          bKash
        </label>
        {payments.bkash !== undefined && (
          <Input
            placeholder="01XXXXXXXXX"
            value={payments.bkash}
            onChange={(e) => onChange({ ...payments, bkash: e.target.value })}
          />
        )}
      </div>

      {/* Nagad */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={payments.nagad !== undefined}
            onChange={() => {
              if (payments.nagad !== undefined) {
                const { nagad: _n, ...rest } = payments;
                onChange(rest);
              } else {
                onChange({ ...payments, nagad: '' });
              }
            }}
            className="accent-[var(--color-accent)]"
          />
          Nagad
        </label>
        {payments.nagad !== undefined && (
          <Input
            placeholder="01XXXXXXXXX"
            value={payments.nagad}
            onChange={(e) => onChange({ ...payments, nagad: e.target.value })}
          />
        )}
      </div>

      {/* COD */}
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
        <input
          type="checkbox"
          checked={payments.cod}
          onChange={(e) => onChange({ ...payments, cod: e.target.checked })}
          className="accent-[var(--color-accent)]"
        />
        Cash on Delivery
      </label>

      <Button onClick={onSubmit} size="md">
        Continue →
      </Button>
    </div>
  );
}

function SocialInput({
  onConnect,
  onSkip,
}: {
  onConnect: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button onClick={onConnect} variant="primary" size="md">
        Connect Facebook
      </Button>
      <Button onClick={onSkip} variant="secondary" size="md">
        Skip for now
      </Button>
    </div>
  );
}

function CompleteSummary({
  answers,
  onFinish,
  isSubmitting,
}: {
  answers: OnboardingState;
  onFinish: () => void;
  isSubmitting: boolean;
}) {
  const personality = CHATBOT_PERSONALITIES.find((p) => p.id === answers.personality);
  const language = LANGUAGE_OPTIONS.find((l) => l.id === answers.language);
  const paymentMethods = [
    answers.payments.bkash !== undefined ? 'bKash' : null,
    answers.payments.nagad !== undefined ? 'Nagad' : null,
    answers.payments.cod ? 'Cash on Delivery' : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Store Name</span>
          <span className="text-text-primary font-medium">{answers.storeName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Categories</span>
          <span className="text-text-primary font-medium">{answers.categories.length} selected</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Chatbot Personality</span>
          <span className="text-text-primary font-medium">{personality?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Language</span>
          <span className="text-text-primary font-medium">{language?.label}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Payments</span>
          <span className="text-text-primary font-medium">{paymentMethods.join(', ') || 'None'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Facebook</span>
          <span className={answers.facebookConnected ? 'text-success font-medium' : 'text-text-tertiary'}>
            {answers.facebookConnected ? 'Connected' : 'Skipped'}
          </span>
        </div>
      </div>
      <Button onClick={onFinish} loading={isSubmitting} size="lg" className="w-full">
        Go to Dashboard →
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('welcome');
  const [answers, setAnswers] = useState<OnboardingState>(defaultAnswers);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview'>('chat');
  const [tempStoreName, setTempStoreName] = useState('');
  const [tempDelivery, setTempDelivery] = useState('');
  const [tempPayments, setTempPayments] = useState<OnboardingState['payments']>({ cod: true });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Restore from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { step: Step; answers: OnboardingState };
        if (parsed.step && parsed.answers) {
          setAnswers(parsed.answers);
          setTempStoreName(parsed.answers.storeName);
          setTempDelivery(parsed.answers.delivery);
          setTempPayments(parsed.answers.payments);
          // Re-play messages up to saved step
          const stepIndex = STEP_ORDER.indexOf(parsed.step);
          const priorMessages: DisplayMessage[] = [];
          for (let i = 0; i <= stepIndex && i < STEP_ORDER.length; i++) {
            const s = STEP_ORDER[i];
            if (STEP_QUESTIONS[s]) {
              priorMessages.push({ id: `assistant-${s}`, role: 'assistant', content: STEP_QUESTIONS[s] });
            }
          }
          setMessages(priorMessages);
          setStep(parsed.step);
          return;
        }
      }
    } catch {
      // ignore
    }
    // Fresh start — show welcome question after delay
    showQuestion('welcome');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save to localStorage on step/answer change ──
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers }));
    } catch {
      // ignore
    }
  }, [step, answers]);

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function showQuestion(targetStep: Step) {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const question = STEP_QUESTIONS[targetStep];
      if (question) {
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${targetStep}-${Date.now()}`, role: 'assistant', content: question },
        ]);
      }
      setStep(targetStep);
    }, 600);
  }

  function addUserMessage(content: string) {
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content },
    ]);
  }

  function advanceStep(current: Step) {
    const idx = STEP_ORDER.indexOf(current);
    const next = STEP_ORDER[idx + 1] as Step | undefined;
    if (next) showQuestion(next);
  }

  // ── Step handlers ──
  function handleStoreName() {
    const name = tempStoreName.trim();
    if (!name) return;
    addUserMessage(name);
    setAnswers((prev) => ({ ...prev, storeName: name }));
    advanceStep('welcome');
  }

  function handleCategoryToggle(cat: string) {
    setAnswers((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  function handleCategories() {
    addUserMessage(answers.categories.join(', '));
    advanceStep('storeName');
  }

  function handlePersonality(id: string) {
    setAnswers((prev) => ({ ...prev, personality: id }));
  }

  function handlePersonalitySubmit() {
    const p = CHATBOT_PERSONALITIES.find((p) => p.id === answers.personality);
    addUserMessage(p?.name ?? answers.personality);
    advanceStep('categories');
  }

  function handleLanguage(id: string) {
    setAnswers((prev) => ({ ...prev, language: id }));
  }

  function handleLanguageSubmit() {
    const l = LANGUAGE_OPTIONS.find((l) => l.id === answers.language);
    addUserMessage(l?.label ?? answers.language);
    advanceStep('personality');
  }

  function handleDelivery() {
    if (!tempDelivery.trim()) return;
    addUserMessage(tempDelivery.trim());
    setAnswers((prev) => ({ ...prev, delivery: tempDelivery.trim() }));
    advanceStep('language');
  }

  function handlePayments() {
    const methods = [
      tempPayments.bkash !== undefined ? 'bKash' : null,
      tempPayments.nagad !== undefined ? 'Nagad' : null,
      tempPayments.cod ? 'Cash on Delivery' : null,
    ].filter(Boolean);
    addUserMessage(methods.join(', ') || 'None');
    setAnswers((prev) => ({ ...prev, payments: tempPayments }));
    advanceStep('delivery');
  }

  function handleSocialConnect() {
    addUserMessage('Connect Facebook — opening flow…');
    setAnswers((prev) => ({ ...prev, facebookConnected: true }));
    advanceStep('payments');
  }

  function handleSocialSkip() {
    addUserMessage('Skip for now');
    setAnswers((prev) => ({ ...prev, facebookConnected: false }));
    advanceStep('payments');
  }

  async function handleFinish() {
    setIsSubmitting(true);
    try {
      // Save BusinessConfig
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-onboarding',
          ...answers,
        }),
        credentials: 'include',
      });

      // Trigger welcome post draft
      await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'welcome-post' }),
        credentials: 'include',
      });

      // Clear localStorage
      localStorage.removeItem(STORAGE_KEY);

      router.push('/dashboard');
    } catch {
      setIsSubmitting(false);
    }
  }

  // ── Render input for current step ──
  function renderStepInput() {
    if (isTyping) return null;

    switch (step) {
      case 'welcome':
        return (
          <StoreNameInput
            value={tempStoreName}
            onChange={setTempStoreName}
            onSubmit={handleStoreName}
          />
        );
      case 'storeName':
        return (
          <CategoriesInput
            selected={answers.categories}
            onToggle={handleCategoryToggle}
            onSubmit={handleCategories}
          />
        );
      case 'categories':
        return (
          <PersonalityInput
            selected={answers.personality}
            onSelect={handlePersonality}
            onSubmit={handlePersonalitySubmit}
          />
        );
      case 'personality':
        return (
          <LanguageInput
            selected={answers.language}
            onSelect={handleLanguage}
            onSubmit={handleLanguageSubmit}
          />
        );
      case 'language':
        return (
          <DeliveryInput
            value={tempDelivery}
            onChange={setTempDelivery}
            onSubmit={handleDelivery}
          />
        );
      case 'delivery':
        return (
          <PaymentsInput
            payments={tempPayments}
            onChange={setTempPayments}
            onSubmit={handlePayments}
          />
        );
      case 'payments':
        return (
          <SocialInput
            onConnect={handleSocialConnect}
            onSkip={handleSocialSkip}
          />
        );
      case 'social':
      case 'complete':
        return (
          <CompleteSummary
            answers={answers}
            onFinish={handleFinish}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  }

  // ── Progress ──
  const stepIndex = STEP_ORDER.indexOf(step);
  const progressPct = Math.round((stepIndex / (STEP_ORDER.length - 1)) * 100);

  // ── Chat panel ──
  const chatPanel = (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="h-1 bg-surface-raised rounded-full overflow-hidden mx-6 mt-6">
        <motion.div
          className="h-full bg-accent rounded-full"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-accent text-accent-text rounded-br-sm'
                    : 'bg-surface border border-border text-text-primary rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-text-tertiary block"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Step input */}
      <AnimatePresence mode="wait">
        {!isTyping && (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="px-6 pb-6 pt-2"
          >
            {renderStepInput()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-base flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <span className="font-semibold text-text-primary">SocialForge</span>
        </div>

        {/* Mobile tab toggle */}
        <div className="flex md:hidden gap-1 bg-surface rounded-lg p-1">
          {(['chat', 'preview'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize ${
                mobileTab === tab
                  ? 'bg-accent text-accent-text'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="w-28 hidden md:block" />
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat — always shown on desktop, conditionally on mobile */}
        <div
          className={`flex-1 md:flex md:flex-col md:border-r md:border-border overflow-hidden ${
            mobileTab === 'chat' ? 'flex flex-col' : 'hidden'
          }`}
        >
          {chatPanel}
        </div>

        {/* Preview — desktop always visible, mobile conditional */}
        <div
          className={`md:w-[420px] md:flex md:flex-col overflow-y-auto bg-base ${
            mobileTab === 'preview' ? 'flex flex-col flex-1' : 'hidden'
          }`}
        >
          <LivePreview answers={answers} />
        </div>
      </div>
    </div>
  );
}