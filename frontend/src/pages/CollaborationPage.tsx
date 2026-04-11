import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { getModules, createRoom, getRooms, deleteRoom } from '../api/client';
import { useAuthStore } from '../store/auth';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

const tokens = {
  text: '#f5f0e8',
  secondary: 'rgba(245,240,232,0.5)',
  tertiary: 'rgba(245,240,232,0.25)',
  accent: '#c4956a',
  accentSoft: 'rgba(196,149,106,0.15)',
  serif: "'Clash Display', sans-serif",
  danger: 'rgba(220,120,100,0.8)',
  success: 'rgba(120,180,120,0.8)',
  hover: 'rgba(255,248,240,0.08)',
} as const;

const inputStyle = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '8px',
  color: tokens.text,
} as const;

const goldButton = {
  background: tokens.accent,
  color: '#1a1714',
  borderRadius: '8px',
  fontWeight: 500,
} as const;

export default function CollaborationPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [roomType, setRoomType] = useState('study');

  const { data: modules } = useQuery({ queryKey: ['modules'], queryFn: getModules });
  const { data: rooms, isLoading } = useQuery({ queryKey: ['rooms'], queryFn: getRooms });

  const createMutation = useMutation({
    mutationFn: () => createRoom(moduleId, roomName, roomType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setShowCreate(false);
      setRoomName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full" style={{ color: tokens.text, fontWeight: 300 }}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6" style={{ color: tokens.accent }} />
          <h1 className="text-2xl" style={{ fontFamily: tokens.serif, fontWeight: 600, color: tokens.text }}>
            Study Rooms
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm flex items-center gap-2 transition-colors"
          style={goldButton}
        >
          <Plus className="w-4 h-4" /> Create Room
        </button>
      </div>

      {showCreate && (
        <div className="p-6 mb-6 space-y-4" style={{ ...glass }}>
          <h3 style={{ fontWeight: 500, color: tokens.text }}>New Study Room</h3>
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Room name…"
            className="w-full px-3 py-2.5 focus:outline-none"
            style={{ ...inputStyle }}
          />
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            className="w-full px-3 py-2.5 focus:outline-none"
            style={{ ...inputStyle }}
          >
            <option value="">Select module…</option>
            {modules?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <div className="flex gap-2">
            {['study', 'quiz', 'review'].map((t) => (
              <button
                key={t}
                onClick={() => setRoomType(t)}
                className="px-4 py-2 text-sm capitalize"
                style={
                  roomType === t
                    ? { background: tokens.accent, color: '#1a1714', borderRadius: '8px', fontWeight: 500 }
                    : { ...glass, borderRadius: '8px', color: tokens.secondary }
                }
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm"
              style={{ ...glass, borderRadius: '8px', color: tokens.secondary }}
            >
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!roomName || !moduleId || createMutation.isPending}
              className="px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              style={goldButton}
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: tokens.accent }} />
        </div>
      ) : rooms?.length ? (
        <div className="space-y-3">
          {rooms.map((room: { id: string; name: string; room_type: string; host_name: string; participants: { user_id: string; display_name: string }[]; created_at: string }) => (
            <div key={room.id} className="p-5 flex items-center justify-between" style={{ ...glass }}>
              <div>
                <h3 className="flex items-center gap-2" style={{ fontWeight: 500, color: tokens.text }}>
                  {room.name}
                  <span
                    className="text-xs px-2 py-0.5 rounded-full capitalize"
                    style={{ background: tokens.accentSoft, color: tokens.accent }}
                  >
                    {room.room_type}
                  </span>
                </h3>
                <p className="text-sm mt-1" style={{ color: tokens.secondary }}>
                  Host: {room.host_name} · {room.participants?.length || 0} participant(s)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 text-sm flex items-center gap-1"
                  style={goldButton}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Join
                </button>
                {user && room.host_name === user.display_name && (
                  <button
                    onClick={() => deleteMutation.mutate(room.id)}
                    className="flex items-center justify-center p-1.5 transition-colors"
                    style={{ color: tokens.secondary, borderRadius: '6px' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = tokens.danger; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = tokens.secondary; }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12" style={{ ...glass }}>
          <Users className="w-12 h-12 mx-auto mb-3" style={{ color: tokens.tertiary }} />
          <p style={{ color: tokens.secondary }}>No active study rooms. Create one to study together!</p>
        </div>
      )}
    </div>
  );
}
