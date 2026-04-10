import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
  Save,
} from 'lucide-react';
import { getSettings, updateSettings, validateApiKey } from '../api/client';
import type { SettingsUpdate } from '../types';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '8px',
  color: '#f5f0e8',
  outline: 'none',
  fontWeight: 300,
};

const inputFocusBorder = '1px solid rgba(196,149,106,0.6)';

const buttonStyle: React.CSSProperties = {
  background: '#c4956a',
  color: '#1a1714',
  borderRadius: '8px',
  fontWeight: 500,
  border: 'none',
};

const headingFont: React.CSSProperties = {
  fontFamily: "'Clash Display', sans-serif",
  color: '#f5f0e8',
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keyDirty, setKeyDirty] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [apiKeyFocused, setApiKeyFocused] = useState(false);
  const [modelFocused, setModelFocused] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const [form, setForm] = useState<SettingsUpdate>({});
  const formInitialized = useRef(false);

  useEffect(() => {
    if (settings && !formInitialized.current) {
      formInitialized.current = true;
      setForm({
        llm_model: settings.llm_model,
        daily_new_cards_limit: settings.daily_new_cards_limit,
        cards_per_document: settings.cards_per_document,
        questions_per_document: settings.questions_per_document,
        weakness_threshold: settings.weakness_threshold,
        desired_retention: settings.desired_retention,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: SettingsUpdate) => updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const validateMutation = useMutation({
    mutationFn: validateApiKey,
    onSuccess: (result) => setValidationResult(result),
    onError: () =>
      setValidationResult({ valid: false, message: 'Validation failed' }),
  });

  const handleSave = () => {
    const data: SettingsUpdate = { ...form };
    if (keyDirty && apiKey) {
      data.groq_api_key = apiKey;
    }
    saveMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#c4956a' }} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-6 h-6" style={{ color: '#c4956a' }} />
        <h1 style={{ ...headingFont, fontSize: '1.5rem', fontWeight: 700 }}>
          Settings
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* API Key */}
        <div className="p-6" style={glass}>
          <h3 style={{ ...headingFont, fontSize: '1rem', fontWeight: 500, marginBottom: '1rem' }}>
            Groq API Key
          </h3>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyDirty ? apiKey : settings?.groq_api_key ?? ''}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setKeyDirty(true);
                  setValidationResult(null);
                }}
                onFocus={() => setApiKeyFocused(true)}
                onBlur={() => setApiKeyFocused(false)}
                placeholder="gsk_..."
                className="w-full px-3 py-2 pr-10"
                style={{
                  ...inputStyle,
                  border: apiKeyFocused ? inputFocusBorder : inputStyle.border,
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.5)', cursor: 'pointer' }}
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <button
              onClick={() => {
                const key = keyDirty ? apiKey : settings?.groq_api_key ?? '';
                if (key) validateMutation.mutate(key);
              }}
              disabled={validateMutation.isPending}
              className="px-4 py-2"
              style={{
                ...glass,
                borderRadius: '8px',
                color: '#f5f0e8',
                fontSize: '0.875rem',
                fontWeight: 300,
                cursor: validateMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: validateMutation.isPending ? 0.5 : 1,
              }}
            >
              {validateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Validate'
              )}
            </button>
          </div>
          {validationResult && (
            <div
              className="flex items-center gap-2 mt-2"
              style={{
                color: validationResult.valid
                  ? 'rgba(120,180,120,0.8)'
                  : 'rgba(220,120,100,0.8)',
                fontSize: '0.875rem',
                fontWeight: 300,
              }}
            >
              {validationResult.valid ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {validationResult.message}
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div className="p-6" style={glass}>
          <h3 style={{ ...headingFont, fontSize: '1rem', fontWeight: 500, marginBottom: '1rem' }}>
            LLM Model
          </h3>
          <select
            value={form.llm_model ?? ''}
            onChange={(e) => setForm({ ...form, llm_model: e.target.value })}
            onFocus={() => setModelFocused(true)}
            onBlur={() => setModelFocused(false)}
            className="w-full px-3 py-2.5"
            style={{
              ...inputStyle,
              border: modelFocused ? inputFocusBorder : inputStyle.border,
              fontSize: '0.875rem',
            }}
          >
            <option value="meta-llama/llama-4-scout-17b-16e-instruct">
              Llama 4 Scout 17B
            </option>
            <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
            <option value="llama-3.3-70b-versatile">
              Llama 3.3 70B Versatile
            </option>
            <option value="gemma2-9b-it">Gemma 2 9B</option>
            <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
          </select>
        </div>

        {/* Sliders */}
        <div className="p-6" style={glass}>
          <h3 style={{ ...headingFont, fontSize: '1rem', fontWeight: 500, marginBottom: '1rem' }}>
            Study Parameters
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <SliderField
              label="Daily New Cards Limit"
              value={form.daily_new_cards_limit ?? 20}
              min={5}
              max={50}
              onChange={(v) => setForm({ ...form, daily_new_cards_limit: v })}
            />
            <SliderField
              label="Cards per Document"
              value={form.cards_per_document ?? 20}
              min={5}
              max={50}
              onChange={(v) => setForm({ ...form, cards_per_document: v })}
            />
            <SliderField
              label="Questions per Document"
              value={form.questions_per_document ?? 10}
              min={5}
              max={30}
              onChange={(v) => setForm({ ...form, questions_per_document: v })}
            />
            <SliderField
              label="Weakness Threshold"
              value={Math.round((form.weakness_threshold ?? 0.7) * 100)}
              min={50}
              max={95}
              suffix="%"
              onChange={(v) =>
                setForm({ ...form, weakness_threshold: v / 100 })
              }
            />
            <SliderField
              label="Desired Retention"
              value={Math.round((form.desired_retention ?? 0.9) * 100)}
              min={80}
              max={99}
              suffix="%"
              onChange={(v) =>
                setForm({ ...form, desired_retention: v / 100 })
              }
            />
          </div>
        </div>

        {/* Save feedback */}
        {saveMutation.isSuccess && (
          <div
            className="flex items-center gap-2 p-3"
            style={{
              background: 'rgba(120,180,120,0.08)',
              border: '1px solid rgba(120,180,120,0.2)',
              borderRadius: '8px',
              color: 'rgba(120,180,120,0.8)',
              fontSize: '0.875rem',
              fontWeight: 300,
            }}
          >
            <CheckCircle className="w-4 h-4" />
            Settings saved successfully!
          </div>
        )}
        {saveMutation.isError && (
          <div
            className="p-3"
            style={{
              background: 'rgba(220,120,100,0.08)',
              border: '1px solid rgba(220,120,100,0.2)',
              borderRadius: '8px',
              color: 'rgba(220,120,100,0.8)',
              fontSize: '0.875rem',
              fontWeight: 300,
            }}
          >
            Failed to save settings.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-3"
          style={{
            ...buttonStyle,
            fontSize: '1rem',
            opacity: saveMutation.isPending ? 0.5 : 1,
            cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </button>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-2" style={{ fontSize: '0.875rem' }}>
        <span style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>{label}</span>
        <span style={{ color: '#f5f0e8', fontWeight: 500 }}>
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full"
        style={{ accentColor: '#c4956a' }}
      />
    </div>
  );
}
