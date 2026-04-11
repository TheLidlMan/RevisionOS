import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getModules, importFromNotion, importFromGoogleDrive } from '../api/client';

const glass = {
  card: {
    background: 'rgba(255,248,240,0.04)',
    border: '1px solid rgba(139,115,85,0.15)',
    borderRadius: '12px',
    backdropFilter: 'blur(20px)',
  } as React.CSSProperties,
  input: {
    background: 'rgba(255,248,240,0.04)',
    border: '1px solid rgba(139,115,85,0.15)',
    borderRadius: '8px',
    color: '#f5f0e8',
    outline: 'none',
  } as React.CSSProperties,
  button: {
    background: '#c4956a',
    color: '#1a1714',
    borderRadius: '8px',
    fontWeight: 500,
    border: 'none',
  } as React.CSSProperties,
  serif: {
    fontFamily: "'Clash Display', sans-serif",
  } as React.CSSProperties,
  text: { color: '#f5f0e8', fontWeight: 300 } as React.CSSProperties,
  secondary: { color: 'rgba(245,240,232,0.5)' } as React.CSSProperties,
  accent: { color: '#c4956a' } as React.CSSProperties,
  success: { color: 'rgba(120,180,120,0.8)' } as React.CSSProperties,
  danger: { color: 'rgba(220,120,100,0.8)' } as React.CSSProperties,
};

export default function IntegrationsPage() {
  const { data: modules } = useQuery({ queryKey: ['modules'], queryFn: getModules });
  const [moduleId, setModuleId] = useState('');

  const [notionToken, setNotionToken] = useState('');
  const [notionPageId, setNotionPageId] = useState('');
  const notionMutation = useMutation({
    mutationFn: () => importFromNotion(notionToken, notionPageId, moduleId),
  });

  const [gdriveToken, setGdriveToken] = useState('');
  const [gdriveFileId, setGdriveFileId] = useState('');
  const gdriveMutation = useMutation({
    mutationFn: () => importFromGoogleDrive(gdriveToken, gdriveFileId, moduleId),
  });

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full" style={glass.text}>
      <div className="flex items-center gap-3 mb-8">
        <Link2 className="w-6 h-6" style={glass.accent} />
        <h1 style={{ ...glass.serif, color: '#f5f0e8', fontSize: '1.5rem', fontWeight: 300 }}>Integrations</h1>
      </div>

      <div className="mb-6">
        <label className="block text-sm mb-2" style={{ ...glass.secondary, fontWeight: 500 }}>Import to Module</label>
        <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}
          className="w-full px-3 py-2.5"
          style={glass.input}>
          <option value="">Choose a module…</option>
          {modules?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="p-6 mb-4" style={glass.card}>
        <h3 className="mb-4" style={{ ...glass.serif, color: '#f5f0e8', fontWeight: 500 }}>Notion Import</h3>
        <div className="space-y-3">
          <input value={notionToken} onChange={(e) => setNotionToken(e.target.value)} placeholder="Notion Integration Token"
            className="w-full px-3 py-2 text-sm font-mono"
            style={glass.input} />
          <input value={notionPageId} onChange={(e) => setNotionPageId(e.target.value)} placeholder="Notion Page ID"
            className="w-full px-3 py-2 text-sm font-mono"
            style={glass.input} />
          <button onClick={() => notionMutation.mutate()} disabled={!moduleId || !notionToken || !notionPageId || notionMutation.isPending}
            className="disabled:opacity-50 px-4 py-2 text-sm flex items-center gap-2"
            style={glass.button}>
            {notionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Import from Notion
          </button>
          {notionMutation.isSuccess && <div className="flex items-center gap-2 text-sm" style={glass.success}><CheckCircle className="w-4 h-4" /> Imported successfully!</div>}
          {notionMutation.isError && <div className="flex items-center gap-2 text-sm" style={glass.danger}><XCircle className="w-4 h-4" /> Import failed</div>}
        </div>
      </div>

      <div className="p-6" style={glass.card}>
        <h3 className="mb-4" style={{ ...glass.serif, color: '#f5f0e8', fontWeight: 500 }}>Google Drive Import</h3>
        <div className="space-y-3">
          <input value={gdriveToken} onChange={(e) => setGdriveToken(e.target.value)} placeholder="Google OAuth Access Token"
            className="w-full px-3 py-2 text-sm font-mono"
            style={glass.input} />
          <input value={gdriveFileId} onChange={(e) => setGdriveFileId(e.target.value)} placeholder="Google Drive File ID"
            className="w-full px-3 py-2 text-sm font-mono"
            style={glass.input} />
          <button onClick={() => gdriveMutation.mutate()} disabled={!moduleId || !gdriveToken || !gdriveFileId || gdriveMutation.isPending}
            className="disabled:opacity-50 px-4 py-2 text-sm flex items-center gap-2"
            style={glass.button}>
            {gdriveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Import from Google Drive
          </button>
          {gdriveMutation.isSuccess && <div className="flex items-center gap-2 text-sm" style={glass.success}><CheckCircle className="w-4 h-4" /> Imported successfully!</div>}
          {gdriveMutation.isError && <div className="flex items-center gap-2 text-sm" style={glass.danger}><XCircle className="w-4 h-4" /> Import failed</div>}
        </div>
      </div>
    </div>
  );
}
