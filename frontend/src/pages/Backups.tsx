import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';

interface BackupMeta {
  filename: string;
  size: number;
  createdAt: string;
  source: 'auto' | 'manual';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "apexpro-backup-manual-2026-06-17_1430.zip" -> "17/06/2026 14:30"
function formatFromName(filename: string): string {
  const m = filename.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/);
  if (!m) return filename;
  const [, y, mo, d, h, mi] = m;
  return `${d}/${mo}/${y} ${h}:${mi}`;
}

export const Backups = () => {
  const toast = useToast();
  const [list, setList] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      const res = await fetch(`${API_BASE}/backups`);
      if (!res.ok) throw new Error();
      setList(await res.json());
    } catch {
      toast.error('Falha ao carregar a lista de backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/backups`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Backup criado com sucesso');
      await fetchList();
    } catch {
      toast.error('Falha ao criar o backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (filename: string) => {
    setDownloading(filename);
    try {
      const res = await fetch(`${API_BASE}/backups/${filename}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Falha ao baixar o backup');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmTarget) return;
    const filename = confirmTarget;
    setConfirmTarget(null);
    try {
      const res = await fetch(`${API_BASE}/backups/${filename}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Backup excluído');
      await fetchList();
    } catch {
      toast.error('Falha ao excluir o backup');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administração"
        title="Backups"
        subtitle="Backup automático diário às 03:00. Mantém os últimos 5 automáticos; os manuais ficam até serem excluídos."
        actions={
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Criando…' : 'Criar backup agora'}
          </Button>
        }
      />

      <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {loading ? (
        <p className="text-slate-500 dark:text-slate-400 text-sm">Carregando…</p>
      ) : list.length === 0 ? (
        <EmptyState
          title="Nenhum backup ainda"
          description={'Clique em “Criar backup agora” para gerar o primeiro backup do banco.'}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/[0.02] text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-500 font-extrabold">
              <tr>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Origem</th>
                <th className="text-left px-4 py-3">Tamanho</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {list.map(b => (
                <tr key={b.filename} className="text-slate-700 dark:text-slate-200">
                  <td className="px-4 py-3 font-semibold">{formatFromName(b.filename)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      b.source === 'auto'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    }`}>
                      {b.source === 'auto' ? 'Automático' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatSize(b.size)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownload(b.filename)}
                        disabled={downloading === b.filename}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-club-red hover:bg-club-red/5 transition-colors disabled:opacity-60"
                      >
                        {downloading === b.filename ? 'Baixando…' : 'Baixar'}
                      </button>
                      <button
                        onClick={() => setConfirmTarget(b.filename)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={confirmTarget !== null}
        message="Tem certeza que deseja excluir este backup? Esta ação não pode ser desfeita."
        details={confirmTarget ? formatFromName(confirmTarget) : undefined}
        confirmLabel="Sim, excluir"
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
      </div>
    </div>
  );
};
