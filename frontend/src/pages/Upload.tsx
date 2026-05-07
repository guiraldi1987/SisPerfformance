import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { API_BASE } from '../lib/api';

export const Upload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState('');
  const [tipo, setTipo] = useState<'Treino' | 'Jogo'>('Treino');
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string; sessaoId?: number } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const navigate = useNavigate();
  const { recarregarSessoes } = useOutletContext<{ recarregarSessoes: () => void }>();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setEnviando(true);
    setResultado(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('data', data);
    fd.append('tipo', tipo);
    try {
      const res = await fetch(`${API_BASE}/upload-gps`, { method: 'POST', body: fd });
      const j = await res.json();
      if (res.ok) {
        setResultado({ ok: true, msg: `${j.registros} registros importados · ${j.jogadoresCriados} jogadores criados.`, sessaoId: j.sessaoId });
        recarregarSessoes();
      } else {
        setResultado({ ok: false, msg: j.error ?? 'Erro desconhecido.' });
      }
    } catch (err: any) {
      setResultado({ ok: false, msg: err.message ?? 'Erro de conexão. O backend está rodando?' });
    } finally {
      setEnviando(false);
    }
  };

  const inputCls = 'border border-slate-300 dark:border-white/10 bg-white dark:bg-[#11161d] dark:text-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-neon-cyan';

  return (
    <div className="max-w-2xl mx-auto px-8 py-6">
      <h1 className="text-2xl font-extrabold mb-6">
        Upload de <span className="neon-text-cyan">Relatório GPS</span>
      </h1>
      <form onSubmit={enviar} className="space-y-4 bg-slate-50 dark:bg-white/[0.02] p-6 rounded-xl border border-slate-200 dark:border-white/5">
        <div>
          <label className="block text-xs font-bold tracking-wider uppercase mb-2 text-slate-500 dark:text-slate-400">Arquivo CSV (Catapult)</label>
          <input
            type="file"
            accept=".csv"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            required
            className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-neon-cyan/20 file:text-neon-cyan file:px-3 file:py-1.5 file:font-semibold file:cursor-pointer"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold tracking-wider uppercase mb-2 text-slate-500 dark:text-slate-400">Data da sessão</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-wider uppercase mb-2 text-slate-500 dark:text-slate-400">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as 'Treino' | 'Jogo')} className={inputCls}>
              <option>Treino</option>
              <option>Jogo</option>
            </select>
          </div>
        </div>
        <button disabled={enviando} className="bg-neon-cyan text-slate-900 font-bold rounded-lg px-6 py-2.5 text-sm hover:opacity-90 disabled:opacity-50 neon-glow-cyan">
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
      {resultado && (
        <div className={`mt-4 p-4 rounded-xl border text-sm ${resultado.ok ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'}`}>
          {resultado.msg}
          {resultado.ok && resultado.sessaoId && (
            <button
              onClick={() => navigate(`/sessao/${resultado.sessaoId}`)}
              className="ml-4 underline font-semibold hover:no-underline"
            >
              Ver relatório →
            </button>
          )}
        </div>
      )}
    </div>
  );
};
