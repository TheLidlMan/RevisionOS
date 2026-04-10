import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { createModule } from '../api/client';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#c4956a', '#ef4444', '#f59e0b', '#10b981',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

const glass = { background: 'rgba(255,248,240,0.04)', border: '1px solid rgba(139,115,85,0.15)', borderRadius: '12px', backdropFilter: 'blur(20px)' } as const;
const inputStyle: React.CSSProperties = { background: 'rgba(255,248,240,0.04)', border: '1px solid rgba(139,115,85,0.15)', borderRadius: '8px', color: '#f5f0e8', outline: 'none', fontWeight: 300, width: '100%', padding: '0.5rem 0.75rem' };
const headingFont: React.CSSProperties = { fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8' };

export default function CreateModuleModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setName(''); setDescription(''); setColor(PRESET_COLORS[0]);
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(26,23,20,0.8)' }}>
      <div className="relative w-full max-w-md mx-4 p-6" style={glass}>
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ ...headingFont, fontSize: '1.25rem', fontWeight: 700 }}>Create Module</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.5)', cursor: 'pointer' }}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; mutation.mutate({ name: name.trim(), description, color }); }} className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Machine Learning" style={inputStyle} onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(196,149,106,0.6)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.15)'; }} autoFocus />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this module about?" rows={3} style={{ ...inputStyle, resize: 'none' }} onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(196,149,106,0.6)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.15)'; }} />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: c, border: color === c ? '2px solid #f5f0e8' : '2px solid transparent', transform: color === c ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.2s', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
          {mutation.isError && <p style={{ color: 'rgba(220,120,100,0.8)', fontSize: '0.875rem' }}>Failed to create module.</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.5)', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
            <button type="submit" disabled={!name.trim() || mutation.isPending} style={{ background: '#c4956a', color: '#1a1714', borderRadius: '8px', fontWeight: 500, border: 'none', padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: 'pointer', opacity: (!name.trim() || mutation.isPending) ? 0.5 : 1 }}>
              {mutation.isPending ? 'Creating…' : 'Create Module'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
