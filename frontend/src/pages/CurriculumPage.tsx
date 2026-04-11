import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CalendarDots, SpinnerGap } from '@phosphor-icons/react';
import { getCurriculum, getModule, getModules, updateModule } from '../api/client';
import { usePersistentState } from '../hooks/usePersistentState';
import { formatRelativeTime } from '../utils/formatters';

const glass = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
} as const;

export default function CurriculumPage() {
  const [searchParams] = useSearchParams();
  const preselectedModule = searchParams.get('module') ?? '';
  const [storedModuleId, setStoredModuleId] = usePersistentState('curriculum:module', preselectedModule);
  const [moduleId, setModuleId] = useState(storedModuleId || preselectedModule);
  const [examDateDraft, setExamDateDraft] = useState<string | null>(null);

  const modulesQuery = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const moduleQuery = useQuery({
    queryKey: ['module', moduleId],
    queryFn: () => getModule(moduleId),
    enabled: Boolean(moduleId),
  });

  const curriculumQuery = useQuery({
    queryKey: ['curriculum', moduleId],
    queryFn: () => getCurriculum(moduleId),
    enabled: Boolean(moduleId) && Boolean(moduleQuery.data?.has_study_plan),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { exam_date?: string }) => updateModule(moduleId, payload),
    onSuccess: () => {
      moduleQuery.refetch();
      curriculumQuery.refetch();
    },
  });

  useEffect(() => {
    setStoredModuleId(moduleId);
  }, [moduleId, setStoredModuleId]);

  const examDate = examDateDraft ?? (moduleQuery.data?.exam_date ? moduleQuery.data.exam_date.slice(0, 10) : '');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <CalendarDots size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.8rem' }}>Study Plan</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Plans are built automatically from topic order and study weight.</p>
        </div>
      </div>

      <div className="p-5 mb-6 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_auto] gap-3 items-end" style={glass}>
        <div>
          <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Module</label>
          <select value={moduleId} onChange={(event) => {
            setModuleId(event.target.value);
            setExamDateDraft(null);
          }} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }}>
            <option value="">Choose a module…</option>
            {modulesQuery.data?.map((module) => (
              <option key={module.id} value={module.id}>
                {module.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Exam date</label>
          <input type="date" value={examDate} onChange={(event) => setExamDateDraft(event.target.value)} className="w-full px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)' }} />
        </div>
        <button type="button" className="scholar-btn" disabled={!moduleId} onClick={() => updateMutation.mutate({ exam_date: examDate || undefined })}>
          Save Date
        </button>
      </div>

      {!moduleId ? (
        <div className="p-10 text-center" style={glass}>
          <p style={{ color: 'var(--text-secondary)' }}>Choose a module to view its study plan.</p>
        </div>
      ) : moduleQuery.isLoading || curriculumQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <SpinnerGap size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : curriculumQuery.data ? (
        <div className="space-y-4">
          <div className="p-5" style={glass}>
            <p style={{ color: 'var(--text)', fontSize: '1rem' }}>
              {curriculumQuery.data.total_concepts} topics across {curriculumQuery.data.total_weeks} weeks
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Generated for {curriculumQuery.data.exam_date}
            </p>
            {curriculumQuery.data.generated_at ? (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginTop: 6 }}>
                Updated {formatRelativeTime(curriculumQuery.data.generated_at)}
              </p>
            ) : null}
          </div>
          {curriculumQuery.data.weeks.map((week) => (
            <div key={week.week} className="p-5" style={glass}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <h2 style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.1rem' }}>Week {week.week}</h2>
                <div className="flex flex-wrap gap-2">
                  {week.focus_areas.map((area) => (
                    <span key={area} className="px-2 py-1 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '0.8rem' }}>
                      {area}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {week.sessions.map((session) => (
                  <div key={`${week.week}-${session.day}-${session.activity}`} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <p style={{ color: 'var(--text)', fontSize: '0.92rem' }}>{session.day}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{session.duration_minutes} min</p>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 6 }}>{session.activity}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-10 text-center" style={glass}>
          <p style={{ color: 'var(--text)', marginBottom: 8 }}>No study plan yet.</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Add an exam date and upload documents so the backend has topics to schedule.
          </p>
        </div>
      )}
    </div>
  );
}
