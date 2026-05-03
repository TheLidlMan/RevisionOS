import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, FloppyDisk, GearSix, SpinnerGap, WarningCircle } from '@phosphor-icons/react';
import { getSettings, updateSettings, validateApiKey } from '../api/client';
import type { SettingsUpdate } from '../types';
import Skeleton from '../components/Skeleton';
import ThemeToggle from '../components/ThemeToggle';
import type { ThemeMode } from '../utils/theme';
import { useAutosaveDraft } from '../hooks/useAutosaveDraft';
import { formatAutosaveStatus } from '../utils/formatters';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

const MODEL_OPTIONS = [
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
  { value: 'openai/gpt-oss-20b', label: 'OpenAI GPT-OSS 20B' },
  { value: 'openai/gpt-oss-120b', label: 'OpenAI GPT-OSS 120B' },
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
  { value: 'groq/compound-mini', label: 'Groq Compound Mini' },
  { value: 'groq/compound', label: 'Groq Compound' },
] as const;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const formInitialized = useRef(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const {
    draft,
    setDraft,
    status: draftStatus,
    restored,
  } = useAutosaveDraft('settings:draft', () => ({ apiKey: '', form: {} as SettingsUpdate }));

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  useEffect(() => {
    if (settingsQuery.data && !formInitialized.current) {
      formInitialized.current = true;
      setDraft((current) => ({
        ...current,
        form: Object.keys(current.form || {}).length > 0
          ? current.form
          : {
              llm_model_fast: settingsQuery.data.llm_model_fast,
              llm_model: settingsQuery.data.llm_model,
              llm_model_quality: settingsQuery.data.llm_model_quality,
              llm_fallback_model: settingsQuery.data.llm_fallback_model,
              llm_temperature: settingsQuery.data.llm_temperature,
              llm_top_p: settingsQuery.data.llm_top_p,
              llm_max_completion_tokens: settingsQuery.data.llm_max_completion_tokens,
              llm_json_mode_enabled: settingsQuery.data.llm_json_mode_enabled,
              llm_streaming_enabled: settingsQuery.data.llm_streaming_enabled,
              cards_per_document: settingsQuery.data.cards_per_document,
              questions_per_document: settingsQuery.data.questions_per_document,
              daily_new_cards_limit: settingsQuery.data.daily_new_cards_limit,
              desired_retention: settingsQuery.data.desired_retention,
              theme: settingsQuery.data.theme,
            },
      }));
    }
  }, [setDraft, settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setFeedback({ type: 'success', message: 'Settings saved.' });
      formInitialized.current = false;
    },
    onError: () => setFeedback({ type: 'error', message: 'Failed to save settings.' }),
  });

  const validateAndSaveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.apiKey.trim()) {
        throw new Error('Enter an API key first.');
      }
      const result = await validateApiKey(draft.apiKey.trim());
      if (!result.valid) {
        throw new Error(result.message);
      }
      return updateSettings({ groq_api_key: draft.apiKey.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setFeedback({ type: 'success', message: 'Groq API key validated and saved.' });
      setDraft((current) => ({ ...current, apiKey: '' }));
    },
    onError: (error) => setFeedback({ type: 'error', message: (error as Error).message }),
  });

  if (settingsQuery.isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full">
        <div className="space-y-5">
          {[0, 1].map((idx) => (
            <section key={idx} className="p-5" style={glass}>
              <Skeleton className="h-5 w-32 mb-4" />
              <Skeleton className="h-12 w-full mb-3" />
              <Skeleton className="h-4 w-48" />
            </section>
          ))}
        </div>
      </div>
    );
  }

  const form = draft.form;
  const canSave = Boolean(form.llm_model) && Boolean(form.llm_model_fast) && !saveMutation.isPending;
  const canValidateKey = draft.apiKey.trim().length > 0 && !validateAndSaveMutation.isPending;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <GearSix size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.8rem' }}>Settings</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Keep the remaining controls simple and backend-focused.</p>
          <p style={{ color: draftStatus === 'error' ? 'var(--danger)' : 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: 8 }}>
            {formatAutosaveStatus(draftStatus, restored)}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <section className="p-5" style={glass}>
          <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.1rem', marginBottom: 12 }}>
            Groq API Key
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>
            Validate and save the key in one step so automatic summaries and flashcards can run.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              value={draft.apiKey}
              onChange={(event) => {
                setDraft((current) => ({ ...current, apiKey: event.target.value }));
                setFeedback(null);
              }}
              placeholder={settingsQuery.data?.groq_api_key || 'gsk_...'}
              className="flex-1 px-3 py-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
            />
            <button type="button" className="scholar-btn" disabled={!canValidateKey} onClick={() => validateAndSaveMutation.mutate()}>
              {validateAndSaveMutation.isPending ? <SpinnerGap size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              Validate & Save
            </button>
          </div>
          {!draft.apiKey.trim() ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginTop: 10 }}>Paste a Groq key to validate and save it.</p>
          ) : null}
        </section>

        <section className="p-5" style={glass}>
          <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.1rem', marginBottom: 12 }}>
            Groq Request Controls
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>
            AI requests are processed globally one at a time across backend workers, so uploads queue instead of tripping local rate limits.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Fast model</span>
              <select value={form.llm_model_fast ?? ''} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, llm_model_fast: event.target.value } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Mid model</span>
              <select value={form.llm_model_quality ?? ''} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, llm_model_quality: event.target.value } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Main model</span>
              <select value={form.llm_model ?? ''} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, llm_model: event.target.value } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Fallback model</span>
              <select value={form.llm_fallback_model ?? ''} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, llm_fallback_model: event.target.value } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Temperature</span>
              <input type="number" min={0} max={2} step={0.1} value={form.llm_temperature ?? 0.1} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, llm_temperature: Number(event.target.value) || 0 } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }} />
            </label>

            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Top P</span>
              <input type="number" min={0} max={1} step={0.05} value={form.llm_top_p ?? 1} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, llm_top_p: Number(event.target.value) || 0 } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }} />
            </label>

            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Max completion tokens</span>
              <input type="number" min={1} max={65536} value={form.llm_max_completion_tokens ?? 4096} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, llm_max_completion_tokens: Number(event.target.value) || 4096 } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }} />
            </label>

            <label className="flex items-center justify-between gap-3 px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
              <span>
                <span className="block mb-1" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>JSON mode</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>Request structured Groq JSON output</span>
              </span>
              <input type="checkbox" checked={Boolean(form.llm_json_mode_enabled)} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, llm_json_mode_enabled: event.target.checked } }))} />
            </label>

            <label className="flex items-center justify-between gap-3 px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
              <span>
                <span className="block mb-1" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Streaming</span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>Enable streamed Groq responses where supported</span>
              </span>
              <input type="checkbox" checked={Boolean(form.llm_streaming_enabled)} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, llm_streaming_enabled: event.target.checked } }))} />
            </label>
          </div>
        </section>

        <section className="p-5" style={glass}>
          <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.1rem', marginBottom: 12 }}>
            Study Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Daily new cards limit</span>
              <input type="number" min={1} max={100} value={form.daily_new_cards_limit ?? 20} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, daily_new_cards_limit: Number(event.target.value) || 20 } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }} />
            </label>

            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Flashcards per document</span>
              <input type="number" min={1} max={200} value={form.cards_per_document ?? 200} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, cards_per_document: Number(event.target.value) || 200 } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }} />
            </label>

            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Quiz questions per run</span>
              <input type="number" min={1} max={20} value={form.questions_per_document ?? 10} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, questions_per_document: Number(event.target.value) || 10 } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }} />
            </label>

            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Desired retention</span>
              <input type="number" min={0.5} max={0.99} step={0.01} value={form.desired_retention ?? 0.9} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, desired_retention: Number(event.target.value) || 0.9 } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }} />
            </label>
          </div>

          <div className="flex justify-end mt-5">
            <button type="button" className="scholar-btn" disabled={!canSave} onClick={() => saveMutation.mutate(form)}>
              {saveMutation.isPending ? <SpinnerGap size={18} className="animate-spin" /> : <FloppyDisk size={18} />}
              Save Settings
            </button>
          </div>
        </section>

        <section className="p-5" style={glass}>
          <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.1rem', marginBottom: 12 }}>
            Appearance
          </h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p style={{ color: 'var(--text)', fontSize: '0.95rem' }}>Theme mode</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Choose light, dark, or follow the system preference.</p>
            </div>
            <ThemeToggle
              value={(form.theme as ThemeMode | undefined) ?? 'system'}
              onChange={(theme) => setDraft((current) => ({ ...current, form: { ...current.form, theme } }))}
            />
          </div>
        </section>

        {feedback && (
          <div className="p-4 flex items-center gap-3" style={{ ...glass, borderColor: feedback.type === 'success' ? 'rgba(120,180,120,0.35)' : 'rgba(220,120,100,0.35)' }}>
            {feedback.type === 'success' ? (
              <CheckCircle size={20} weight="fill" style={{ color: 'var(--success)' }} />
            ) : (
              <WarningCircle size={20} weight="fill" style={{ color: 'var(--danger)' }} />
            )}
            <p style={{ color: 'var(--text)', fontSize: '0.92rem' }}>{feedback.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
