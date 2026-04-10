import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getModules, importFromNotion, importFromGoogleDrive } from '../api/client';

export default function IntegrationsPage() {
  const { data: modules } = useQuery({ queryKey: ['modules'], queryFn: getModules });
  const [moduleId, setModuleId] = useState('');

  // Notion
  const [notionToken, setNotionToken] = useState('');
  const [notionPageId, setNotionPageId] = useState('');
  const notionMutation = useMutation({
    mutationFn: () => importFromNotion(notionToken, notionPageId, moduleId),
  });

  // Google Drive
  const [gdriveToken, setGdriveToken] = useState('');
  const [gdriveFileId, setGdriveFileId] = useState('');
  const gdriveMutation = useMutation({
    mutationFn: () => importFromGoogleDrive(gdriveToken, gdriveFileId, moduleId),
  });

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <Link2 className="w-6 h-6 text-teal" />
        <h1 className="text-2xl font-bold">Integrations</h1>
      </div>

      {/* Module selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">Import to Module</label>
        <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}
          className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-teal">
          <option value="">Choose a module…</option>
          {modules?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Notion */}
      <div className="bg-navy-light rounded-xl border border-gray-800 p-6 mb-4">
        <h3 className="font-medium mb-4">📝 Notion Import</h3>
        <div className="space-y-3">
          <input value={notionToken} onChange={(e) => setNotionToken(e.target.value)} placeholder="Notion Integration Token"
            className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-teal text-sm font-mono" />
          <input value={notionPageId} onChange={(e) => setNotionPageId(e.target.value)} placeholder="Notion Page ID"
            className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-teal text-sm font-mono" />
          <button onClick={() => notionMutation.mutate()} disabled={!moduleId || !notionToken || !notionPageId || notionMutation.isPending}
            className="bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
            {notionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Import from Notion
          </button>
          {notionMutation.isSuccess && <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle className="w-4 h-4" /> Imported successfully!</div>}
          {notionMutation.isError && <div className="flex items-center gap-2 text-red-400 text-sm"><XCircle className="w-4 h-4" /> Import failed</div>}
        </div>
      </div>

      {/* Google Drive */}
      <div className="bg-navy-light rounded-xl border border-gray-800 p-6">
        <h3 className="font-medium mb-4">📁 Google Drive Import</h3>
        <div className="space-y-3">
          <input value={gdriveToken} onChange={(e) => setGdriveToken(e.target.value)} placeholder="Google OAuth Access Token"
            className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-teal text-sm font-mono" />
          <input value={gdriveFileId} onChange={(e) => setGdriveFileId(e.target.value)} placeholder="Google Drive File ID"
            className="w-full bg-navy-lighter border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-teal text-sm font-mono" />
          <button onClick={() => gdriveMutation.mutate()} disabled={!moduleId || !gdriveToken || !gdriveFileId || gdriveMutation.isPending}
            className="bg-teal hover:bg-teal-dark disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
            {gdriveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Import from Google Drive
          </button>
          {gdriveMutation.isSuccess && <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle className="w-4 h-4" /> Imported successfully!</div>}
          {gdriveMutation.isError && <div className="flex items-center gap-2 text-red-400 text-sm"><XCircle className="w-4 h-4" /> Import failed</div>}
        </div>
      </div>
    </div>
  );
}
