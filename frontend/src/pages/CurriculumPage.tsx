import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Loader2, BookOpen, Clock } from 'lucide-react';
import { getModules, generateCurriculum } from '../api/client';
import type { CurriculumData } from '../types';

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

const btnGold: React.CSSProperties = {
  background: '#c4956a',
  color: '#1a1714',
  borderRadius: '8px',
  fontWeight: 500,
  border: 'none',
};

const heading: React.CSSProperties = {
  fontFamily: "'Clash Display', sans-serif",
  color: '#f5f0e8',
};

export default function CurriculumPage() {
  const [searchParams] = useSearchParams();
  const preModule = searchParams.get('module') ?? '';
  const [moduleId, setModuleId] = useState(preModule);
  const [hoursPerWeek, setHoursPerWeek] = useState(5);
  const [examDate, setExamDate] = useState('');
  const [curriculum, setCurriculum] = useState<CurriculumData | null>(null);

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateCurriculum(moduleId, hoursPerWeek, examDate || undefined),
    onSuccess: (data) => setCurriculum(data),
  });

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full" style={{ fontWeight: 300 }}>
      <div className="flex items-center gap-3 mb-8">
        <Calendar className="w-6 h-6" style={{ color: '#c4956a' }} />
        <h1 className="text-2xl" style={{ ...heading, fontWeight: 700 }}>Study Plan</h1>
      </div>

      {/* Config */}
      <div className="p-6 mb-8 space-y-5" style={glass}>
        <div>
          <label className="block text-sm mb-2" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>Module</label>
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(196,149,106,0.6)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.15)'; }}
            className="w-full px-3 py-2.5"
          >
            <option value="">Choose a module…</option>
            {modules?.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>Hours per Week</label>
            <input
              type="number"
              min={1}
              max={40}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(parseInt(e.target.value) || 5)}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(196,149,106,0.6)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.15)'; }}
              className="w-full px-3 py-2.5"
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>
              Exam Date <span style={{ color: 'rgba(245,240,232,0.25)' }}>(optional)</span>
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(196,149,106,0.6)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.15)'; }}
              className="w-full px-3 py-2.5"
            />
          </div>
        </div>

        {generateMutation.isError && (
          <p className="text-sm" style={{ color: 'rgba(220,120,100,0.8)', fontWeight: 300 }}>Failed to generate study plan. Please try again.</p>
        )}

        <button
          onClick={() => generateMutation.mutate()}
          disabled={!moduleId || generateMutation.isPending}
          style={{ ...btnGold, opacity: (!moduleId || generateMutation.isPending) ? 0.5 : 1 }}
          className="w-full px-4 py-3 flex items-center justify-center gap-2 transition-opacity"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
          Generate Plan
        </button>
      </div>

      {/* Results */}
      {curriculum && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg" style={{ ...heading, fontWeight: 600 }}>{curriculum.module_name}</h2>
              <p className="text-sm" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>
                {curriculum.total_concepts} concepts · {curriculum.total_weeks} weeks · {curriculum.hours_per_week}h/week
                {curriculum.exam_date && ` · Exam: ${new Date(curriculum.exam_date).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {curriculum.weeks.map((week) => (
              <div key={week.week} className="p-5" style={glass}>
                <div className="flex items-center justify-between mb-3">
                  <h3 style={{ ...heading, fontWeight: 600 }}>Week {week.week}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {week.focus_areas.map((area) => (
                      <span
                        key={area}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(196,149,106,0.15)', color: '#c4956a' }}
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {week.sessions.map((session, si) => (
                    <div
                      key={si}
                      className="p-3 flex items-start gap-3"
                      style={{
                        background: 'rgba(255,248,240,0.04)',
                        border: '1px solid rgba(139,115,85,0.15)',
                        borderRadius: '8px',
                      }}
                    >
                      <div className="shrink-0 mt-0.5">
                        <div
                          className="w-8 h-8 flex items-center justify-center"
                          style={{ background: 'rgba(196,149,106,0.15)', borderRadius: '8px' }}
                        >
                          {session.activity.toLowerCase().includes('review') ? (
                            <BookOpen className="w-4 h-4" style={{ color: '#c4956a' }} />
                          ) : (
                            <Clock className="w-4 h-4" style={{ color: '#c4956a' }} />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm" style={{ color: '#f5f0e8', fontWeight: 500 }}>{session.day}</span>
                          <span className="text-xs" style={{ color: 'rgba(245,240,232,0.25)' }}>{session.duration_minutes} min</span>
                        </div>
                        <p className="text-sm" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>{session.activity}</p>
                        {session.concepts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {session.concepts.map((c) => (
                              <span
                                key={c}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{
                                  background: 'transparent',
                                  border: '1px solid rgba(139,115,85,0.15)',
                                  color: 'rgba(245,240,232,0.5)',
                                }}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
