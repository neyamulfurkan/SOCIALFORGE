export type KnownFlag = {
  key: string;
  label: string;
  protected: boolean;
};

export const KNOWN_FLAGS: KnownFlag[] = [
  { key: 'flag:chatbot', label: 'AI Chatbot', protected: true },
  { key: 'flag:messenger', label: 'Messenger Bot', protected: false },
  { key: 'flag:social', label: 'Social Media Automation', protected: false },
  { key: 'flag:analytics', label: 'Analytics Dashboard', protected: false },
  { key: 'flag:custom-keys', label: 'Custom API Keys', protected: false },
];

export type FlagOverride = {
  businessId: string;
  businessName: string;
  enabled: boolean;
};

export type ResolvedFlag = {
  key: string;
  label: string;
  protected: boolean;
  enabled: boolean;
  overrides: FlagOverride[];
};