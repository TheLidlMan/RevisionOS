import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { createModule } from '../api/client';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#00b4d8',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

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
      setName('');
      setDescription('');
      setColor(PRESET_COLORS[0]);
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-navy-light rounded-xl border border-gray-700 p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Create Module</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            mutation.mutate({ name: name.trim(), description, color });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Machine Learning"
              className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this module about?"
              rows={3}
              className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {mutation.isError && (
            <p className="text-red-400 text-sm">
              Failed to create module. Please try again.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || mutation.isPending}
              className="bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              {mutation.isPending ? 'Creating…' : 'Create Module'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
