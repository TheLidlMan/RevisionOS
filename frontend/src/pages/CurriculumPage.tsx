import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Loader2, BookOpen, Clock } from 'lucide-react';
import { getModules, generateCurriculum } from '../api/client';
import type { CurriculumData } from '../types';

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
    <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <Calendar className="w-6 h-6 text-teal" />
        <h1 className="text-2xl font-bold">Study Plan</h1>
      </div>

      {/* Config */}
      <div className="bg-navy-light rounded-xl border border-gray-800 p-6 mb-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Module</label>
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-teal transition-colors"
          >
            <option value="">Choose a module…</option>
            {modules?.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Hours per Week</label>
            <input
              type="number"
              min={1}
              max={40}
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(parseInt(e.target.value) || 5)}
              className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-teal transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Exam Date <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-teal transition-colors"
            />
          </div>
        </div>

        {generateMutation.isError && (
          <p className="text-red-400 text-sm">Failed to generate study plan. Please try again.</p>
        )}

        <button
          onClick={() => generateMutation.mutate()}
          disabled={!moduleId || generateMutation.isPending}
          className="w-full bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-lg px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2"
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
              <h2 className="text-lg font-semibold">{curriculum.module_name}</h2>
              <p className="text-sm text-gray-400">
                {curriculum.total_concepts} concepts · {curriculum.total_weeks} weeks · {curriculum.hours_per_week}h/week
                {curriculum.exam_date && ` · Exam: ${new Date(curriculum.exam_date).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {curriculum.weeks.map((week) => (
              <div key={week.week} className="bg-navy-light rounded-xl border border-gray-800 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Week {week.week}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {week.focus_areas.map((area) => (
                      <span key={area} className="text-xs bg-teal/10 text-teal px-2 py-0.5 rounded-full">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {week.sessions.map((session, si) => (
                    <div key={si} className="bg-navy-lighter rounded-lg p-3 flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
                          {session.activity.toLowerCase().includes('review') ? (
                            <BookOpen className="w-4 h-4 text-teal" />
                          ) : (
                            <Clock className="w-4 h-4 text-teal" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{session.day}</span>
                          <span className="text-xs text-gray-500">{session.duration_minutes} min</span>
                        </div>
                        <p className="text-sm text-gray-400">{session.activity}</p>
                        {session.concepts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {session.concepts.map((c) => (
                              <span key={c} className="text-xs bg-navy-light border border-gray-700 px-1.5 py-0.5 rounded text-gray-400">
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
