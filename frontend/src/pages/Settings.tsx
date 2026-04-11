import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, FloppyDisk, GearSix, SpinnerGap, WarningCircle } from '@phosphor-icons/react';
import { getSettings, updateSettings, validateApiKey } from '../api/client';
import type { SettingsUpdate } from '../types';
import Skeleton from '../components/Skeleton';
import { useAutosaveDraft } from '../hooks/useAutosaveDraft';
import { formatAutosaveStatus } from '../utils/formatters';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

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
              llm_model: settingsQuery.data.llm_model,
              questions_per_document: settingsQuery.data.questions_per_document,
              daily_new_cards_limit: settingsQuery.data.daily_new_cards_limit,
              desired_retention: settingsQuery.data.desired_retention,
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
      <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
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
  const canSave = Boolean(form.llm_model) && !saveMutation.isPending;
  const canValidateKey = draft.apiKey.trim().length > 0 && !validateAndSaveMutation.isPending;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
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
            Study Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>LLM model</span>
              <select value={form.llm_model ?? ''} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, llm_model: event.target.value } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
                <option value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B</option>
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                <option value="gemma2-9b-it">Gemma 2 9B</option>
              </select>
            </label>

            <label>
              <span className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Daily new cards limit</span>
              <input type="number" min={1} max={100} value={form.daily_new_cards_limit ?? 20} onChange={(event) => setDraft((current) => ({ ...current, form: { ...current.form, daily_new_cards_limit: Number(event.target.value) || 20 } }))} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }} />
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
