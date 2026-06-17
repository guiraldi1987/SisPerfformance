import React, { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessaoEditavel {
  id: number;
  data: string;
  tipo: string;
  descricao: string | null;
  equipe: string | null;
  local: string | null;
}

export interface EditSessaoModalProps {
  sessao: SessaoEditavel | null;
  onClose: () => void;
  onSave: (id: number, dados: { data: string; tipo: string; descricao: string; equipe: string; local: string }) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditSessaoModal: React.FC<EditSessaoModalProps> = ({ sessao, onClose, onSave }) => {
  const [data, setData]           = useState('');
  const [tipo, setTipo]           = useState('Treino');
  const [descricao, setDescricao] = useState('');
  const [equipe, setEquipe]       = useState('');
  const [local, setLocal]         = useState('');
  const [saving, setSaving]       = useState(false);

  // Tipo original — para detectar mudança e exibir aviso
  const [tipoOriginal, setTipoOriginal] = useState('');

  useEffect(() => {
    if (sessao) {
      setData(sessao.data);
      setTipo(sessao.tipo);
      setTipoOriginal(sessao.tipo);
      setDescricao(sessao.descricao ?? '');
      setEquipe(sessao.equipe ?? '');
      setLocal(sessao.local ?? '');
    }
  }, [sessao]);

  if (!sessao) return null;

  const tipoMudou = tipo !== tipoOriginal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(sessao.id, { data, tipo, descricao, equipe, local });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm bg-input border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-club-red transition-colors';
  const labelCls = 'block text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all" onClick={onClose}>
      <div
        role="dialog" aria-modal="true"
        className="bg-elevated rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200 dark:border-white/[0.06] animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-indigo-600 dark:text-indigo-500">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            Editar Sessão
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div>
            <label className={labelCls}>Tipo</label>
            <div className="flex items-center gap-2">
              {(['Treino', 'Jogo'] as const).map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                    tipo === t
                      ? t === 'Jogo'
                        ? 'bg-club-red/10 text-club-red border-club-red/30'
                        : 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white border-slate-300 dark:border-white/20'
                      : 'bg-transparent text-slate-400 border-slate-200 dark:border-white/10 hover:border-slate-300'
                  }`}>
                  {t === 'Jogo' ? 'Jogo (MD)' : 'Treino'}
                </button>
              ))}
            </div>

            {/* Aviso quando o tipo muda */}
            {tipoMudou && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 shrink-0">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Atenção: mudar o tipo afeta cálculos
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400/80 mt-1 leading-relaxed">
                  O tipo da sessão ({tipoOriginal} → {tipo}) influencia o <b>ACWR</b>, <b>microciclo MD±N</b>,
                  {' '}<b>benchmarks por posição</b>, <b>detecção de anomalias</b> e o <b>histórico comparativo</b>.
                  Certifique-se de que a mudança está correta.
                </p>
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className={labelCls}>{tipo === 'Jogo' ? 'Adversário / Descrição' : 'Descrição'}</label>
            <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder={tipo === 'Jogo' ? 'Ex: XV de Jaú x Paulista' : 'Ex: Treino tático'}
              className={inputCls} />
          </div>

          {/* Data */}
          <div>
            <label className={labelCls}>Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className={inputCls} required />
          </div>

          {/* Equipe + Local (2 colunas) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Equipe</label>
              <input type="text" value={equipe} onChange={e => setEquipe(e.target.value)}
                placeholder="Paulista FC" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Local</label>
              <input type="text" value={local} onChange={e => setLocal(e.target.value)}
                placeholder="CT do Paulista" className={inputCls} />
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-50">
              {saving ? 'Salvando…' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
