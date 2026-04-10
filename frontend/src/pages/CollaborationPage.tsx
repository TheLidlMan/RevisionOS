import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { getModules, createRoom, getRooms, deleteRoom } from '../api/client';
import { useAuthStore } from '../store/auth';

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
    <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold">Study Rooms</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-teal hover:bg-teal-dark text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Room
        </button>
      </div>

      {/* Create Room Form */}
      {showCreate && (
        <div className="bg-navy-light rounded-xl border border-gray-800 p-6 mb-6 space-y-4">
          <h3 className="font-medium">New Study Room</h3>
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Room name…"
            className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-teal"
          />
          <select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-teal"
          >
            <option value="">Select module…</option>
            {modules?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <div className="flex gap-2">
            {['study', 'quiz', 'review'].map((t) => (
              <button key={t} onClick={() => setRoomType(t)}
                className={`px-4 py-2 rounded-lg text-sm capitalize ${roomType === t ? 'bg-teal text-white' : 'bg-navy-lighter border border-gray-700 text-gray-300'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="bg-navy-lighter border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300">Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={!roomName || !moduleId || createMutation.isPending}
              className="bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal" /></div>
      ) : rooms?.length ? (
        <div className="space-y-3">
          {rooms.map((room: { id: string; name: string; room_type: string; host_name: string; participants: { user_id: string; display_name: string }[]; created_at: string }) => (
            <div key={room.id} className="bg-navy-light rounded-xl border border-gray-800 p-5 flex items-center justify-between">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  {room.name}
                  <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full capitalize">{room.room_type}</span>
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Host: {room.host_name} · {room.participants?.length || 0} participant(s)
                </p>
              </div>
              <div className="flex gap-2">
                <button className="bg-teal hover:bg-teal-dark text-white rounded-lg px-3 py-1.5 text-sm flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" /> Join
                </button>
                {user && room.host_name === user.display_name && (
                  <button onClick={() => deleteMutation.mutate(room.id)} className="text-gray-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-navy-light rounded-xl border border-gray-800">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No active study rooms. Create one to study together!</p>
        </div>
      )}
    </div>
  );
}
