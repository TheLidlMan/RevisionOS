import { useState } from 'react';
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

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [keyDirty, setKeyDirty] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const [form, setForm] = useState<SettingsUpdate>({});

  // Initialize form from settings
  const initialized = settings && Object.keys(form).length === 0;
  if (initialized) {
    setForm({
      llm_model: settings.llm_model,
      daily_new_cards_limit: settings.daily_new_cards_limit,
      cards_per_document: settings.cards_per_document,
      questions_per_document: settings.questions_per_document,
      weakness_threshold: settings.weakness_threshold,
      desired_retention: settings.desired_retention,
    });
  }

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
        <Loader2 className="w-6 h-6 animate-spin text-teal" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-6 h-6 text-teal" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* API Key */}
        <div className="bg-navy-light rounded-xl border border-gray-800 p-6">
          <h3 className="font-medium mb-4">Groq API Key</h3>
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
                placeholder="gsk_..."
                className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
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
              className="bg-navy-lighter border border-gray-700 hover:border-gray-500 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50"
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
              className={`flex items-center gap-2 mt-2 text-sm ${
                validationResult.valid ? 'text-green-400' : 'text-red-400'
              }`}
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
        <div className="bg-navy-light rounded-xl border border-gray-800 p-6">
          <h3 className="font-medium mb-4">LLM Model</h3>
          <select
            value={form.llm_model ?? ''}
            onChange={(e) => setForm({ ...form, llm_model: e.target.value })}
            className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-teal transition-colors text-sm"
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
        <div className="bg-navy-light rounded-xl border border-gray-800 p-6 space-y-6">
          <h3 className="font-medium mb-2">Study Parameters</h3>

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

        {/* Save */}
        {saveMutation.isSuccess && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm text-green-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Settings saved successfully!
          </div>
        )}
        {saveMutation.isError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
            Failed to save settings.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-lg px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2"
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
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-300">{label}</span>
        <span className="text-white font-medium">
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
        className="w-full accent-teal"
      />
    </div>
  );
}
