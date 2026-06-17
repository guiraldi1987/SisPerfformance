import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';

export const Upload: React.FC = () => {
  const [file, setFile]     = useState<File | null>(null);
  const [tipo, setTipo]     = useState<'Treino' | 'Jogo'>('Treino');
  const [jogo, setJogo]     = useState('');
  const [equipe, setEquipe] = useState('Paulista FC');
  const [local, setLocal]   = useState('');
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string; sessaoId?: number; dataSessao?: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const navigate = useNavigate();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setEnviando(true);
    setResultado(null);
    const fd = new FormData();
    fd.append('file',   file);
    fd.append('tipo',   tipo);
    fd.append('jogo',   jogo);
    fd.append('equipe', equipe);
    fd.append('local',  local);
    try {
      const res = await fetch(`${API_BASE}/upload-gps`, { method: 'POST', body: fd });
      const j = await res.json();
      if (res.ok) {
        const [y, m, d] = (j.dataSessao as string).split('-');
        const dataFormatada = `${d}/${m}/${y}`;
        setResultado({
          ok: true,
          msg: `${dataFormatada} · ${j.registros} registros importados · ${j.jogadoresCriados} jogadores criados.`,
          sessaoId: j.sessaoId,
          dataSessao: j.dataSessao,
        });
      } else {
        setResultado({ ok: false, msg: j.error ?? 'Erro desconhecido.' });
      }
    } catch (err: any) {
      setResultado({ ok: false, msg: err.message ?? 'Erro de conexão. O backend está rodando?' });
    } finally {
      setEnviando(false);
    }
  };

  const inputCls = 'border border-slate-300 dark:border-white/10 bg-input dark:text-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:border-club-red';
  const labelCls = 'block text-xs font-bold tracking-wider uppercase mb-1.5 text-slate-500 dark:text-slate-400';

  return (
    <div className="max-w-2xl mx-auto px-8 py-6">
      <h1 className="text-2xl font-extrabold mb-1 text-slate-900 dark:text-white">
        Upload de Relatório GPS
      </h1>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">
        Importar arquivo Catapult (.csv) — a data é lida automaticamente do arquivo.
      </p>

      <form onSubmit={enviar} className="space-y-5 bg-card p-6 rounded-xl border border-slate-200 dark:border-white/[0.06]">

        {/* Arquivo */}
        <div>
          <label className={labelCls}>Arquivo CSV (Catapult)</label>
          <input
            type="file" accept=".csv"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            required
            className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-club-red/10 file:text-club-red file:px-3 file:py-1.5 file:text-xs file:font-bold file:cursor-pointer hover:file:bg-club-red/20"
          />
        </div>

        {/* Tipo */}
        <div>
          <label className={labelCls}>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as 'Treino' | 'Jogo')} className={inputCls}>
            <option>Treino</option>
            <option>Jogo</option>
          </select>
        </div>

        <div className="border-t border-slate-100 dark:border-white/[0.06]" />

        {/* Jogo */}
        <div>
          <label className={labelCls}>
            Jogo <span className="normal-case font-normal text-slate-400">(adversário / descrição)</span>
          </label>
          <input
            type="text" value={jogo}
            onChange={e => setJogo(e.target.value)}
            placeholder="Ex: XV de Jaú x Paulista FC"
            className={inputCls}
          />
        </div>

        {/* Equipe + Local */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Equipe</label>
            <input
              type="text" value={equipe}
              onChange={e => setEquipe(e.target.value)}
              placeholder="Ex: Paulista FC"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Local</label>
            <input
              type="text" value={local}
              onChange={e => setLocal(e.target.value)}
              placeholder="Ex: Zezinho Magalhães"
              className={inputCls}
            />
          </div>
        </div>

        <button
          disabled={enviando}
          className="w-full bg-club-red text-white font-bold rounded-lg px-6 py-2.5 text-sm hover:opacity-90 disabled:opacity-50 accent-glow transition-opacity"
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </form>

      {resultado && (
        <div className={`mt-4 p-4 rounded-xl border text-sm ${
          resultado.ok
            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
            : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
        }`}>
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
