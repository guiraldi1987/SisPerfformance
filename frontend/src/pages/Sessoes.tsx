import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { formatData } from '../lib/format';
import { ConfirmModal } from '../components/ConfirmModal';
import { EditSessaoModal } from '../components/EditSessaoModal';
import { useToast } from '../components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessaoRica {
  id: number;
  data: string;                  // YYYY-MM-DD
  tipo: string;                  // 'Treino' | 'Jogo'
  descricao: string | null;
  equipe: string | null;
  local: string | null;
  createdAt: string;
  atletasCount: number;          // com participação (dist > 0)
  atletasTotal: number;          // inclui N/A
  duracaoMax: number;            // segundos
  cargaMedia: number;
  cargaTotal: number;
  distMedia: number;
}

type ViewMode = 'lista' | 'calendario';
type TipoFiltro = 'Todos' | 'Treino' | 'Jogo';
type SortKey = 'dataDesc' | 'dataAsc' | 'cargaDesc' | 'atletasDesc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES_LONG = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const MESES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIAS_SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const monthKey  = (iso: string) => iso.slice(0, 7);          // 'YYYY-MM'
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${MESES_LONG[(m! - 1)]} ${y}`;
};

const fmtSec = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
};

const fmtNum = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Debounce em useState (SSR-safe)
function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

// ─── SVGs ─────────────────────────────────────────────────────────────────────

const Icon = {
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  ),
  Chevron: ({ open }: { open: boolean }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3 h-3">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.4 3.5-5 6.5-5s5.7 1.6 6.5 5" />
      <circle cx="17" cy="9" r="2.5" /><path d="M16 14.5c2.6.2 4.5 1.7 5 4" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3 h-3">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  Bolt: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3 h-3">
      <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7z" />
    </svg>
  ),
  ArrowL: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  ArrowR: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
};

// ─── Card de Sessão ──────────────────────────────────────────────────────────

const CargaBar: React.FC<{ value: number; max: number }> = ({ value, max }) => {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const color = ratio >= 0.85 ? '#dc2626' : ratio >= 0.65 ? '#f59e0b' : ratio >= 0.4 ? '#0d9488' : '#06b6d4';
  const gradEnd = ratio >= 0.85 ? '#ef4444' : ratio >= 0.65 ? '#fbbf24' : ratio >= 0.4 ? '#14b8a6' : '#22d3ee';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(ratio * 100, 4)}%`, background: `linear-gradient(90deg, ${color}, ${gradEnd})` }} />
      </div>
      <span className="text-[10px] font-extrabold tabular-nums shrink-0" style={{ color }}>
        {value > 0 ? fmtNum(value, 1) : '—'}
      </span>
    </div>
  );
};

const SessaoCard: React.FC<{
  sessao: SessaoRica;
  cargaMax: number;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}> = ({ sessao, cargaMax, onClick, onEdit, onDelete }) => {
  const isJogo = sessao.tipo === 'Jogo';
  const titulo = sessao.descricao || (isJogo ? 'Partida' : 'Treino');
  const ratio = cargaMax > 0 ? Math.min(sessao.cargaMedia / cargaMax, 1) : 0;
  const accentColor = isJogo ? '#cc1e1e' : ratio >= 0.7 ? '#f59e0b' : '#0d9488';
  return (
    <button onClick={onClick}
      className="group relative w-full text-left bg-card rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden hover:shadow-lg hover:border-slate-300 dark:hover:border-white/15 transition-all hover:-translate-y-0.5">
      {/* Accent bar lateral */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: accentColor }} />

      <div className="p-3.5 pl-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`flex flex-col items-center justify-center w-11 h-12 rounded-lg shrink-0 ${
              isJogo ? 'bg-club-red/10 border border-club-red/20' : 'bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06]'
            }`}>
              <span className={`text-[8px] font-extrabold uppercase leading-none ${
                isJogo ? 'text-club-red' : 'text-slate-400 dark:text-slate-500'
              }`}>
                {MESES_SHORT[Number(sessao.data.slice(5, 7)) - 1]}
              </span>
              <span className={`text-base font-extrabold tabular-nums leading-none mt-0.5 ${
                isJogo ? 'text-club-red' : 'text-slate-900 dark:text-white'
              }`}>
                {sessao.data.slice(8, 10)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-club-red transition-colors">
                {titulo}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                {sessao.local || sessao.equipe || formatData(sessao.data)}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider uppercase ${
            isJogo
              ? 'bg-club-red text-white'
              : 'bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/10'
          }`}>
            {isJogo && <span className="w-1.5 h-1.5 rounded-full bg-white/60" />}
            {isJogo ? 'JOGO' : 'Treino'}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-[10px] mb-2.5">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/15 flex items-center justify-center">
              <Icon.Users />
            </div>
            <span className="tabular-nums">
              <b className="text-slate-800 dark:text-slate-200">{sessao.atletasCount}</b>
              {sessao.atletasTotal > sessao.atletasCount && <span className="opacity-50">/{sessao.atletasTotal}</span>}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <div className="w-5 h-5 rounded-md bg-purple-50 dark:bg-purple-900/15 flex items-center justify-center">
              <Icon.Clock />
            </div>
            <span className="tabular-nums">{sessao.duracaoMax > 0 ? fmtSec(sessao.duracaoMax) : '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <div className="w-5 h-5 rounded-md bg-teal-50 dark:bg-teal-900/15 flex items-center justify-center">
              <Icon.Bolt />
            </div>
            <span className="tabular-nums">{sessao.distMedia > 0 ? `${(sessao.distMedia / 1000).toFixed(1)}k` : '—'}</span>
          </div>
        </div>

        {/* Carga média (barra) */}
        <CargaBar value={sessao.cargaMedia} max={cargaMax} />
      </div>

      {/* Edit + Trash */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-300">
        <button
          onClick={onEdit}
          aria-label={`Editar sessão ${sessao.descricao || sessao.data}`}
          title="Editar sessão"
          className="flex items-center justify-center w-7 h-7 rounded-full bg-white dark:bg-elevated text-indigo-500 border border-slate-200 dark:border-white/10 hover:bg-indigo-500 hover:text-white hover:border-indigo-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-sm hover:shadow-indigo-500/25 transition-all"
          onMouseDown={e => e.stopPropagation()}
        >
          <Icon.Edit />
        </button>
        <button
          onClick={onDelete}
          aria-label={`Remover sessão ${sessao.descricao || sessao.data}`}
          title="Remover sessão"
          className="flex items-center justify-center w-7 h-7 rounded-full bg-white dark:bg-elevated text-rose-500 border border-slate-200 dark:border-white/10 hover:bg-rose-500 hover:text-white hover:border-rose-500 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-rose-500 shadow-sm hover:shadow-rose-500/25 transition-all"
          onMouseDown={e => e.stopPropagation()}
        >
          <Icon.Trash />
        </button>
      </div>
    </button>
  );
};

// ─── Mês colapsável (vista lista) ─────────────────────────────────────────────

const MesSection: React.FC<{
  mesKey: string;
  sessoes: SessaoRica[];
  cargaMax: number;
  defaultOpen: boolean;
  onCardClick: (id: number) => void;
  onEdit: (sessao: SessaoRica) => void;
  onDelete: (id: number) => void;
}> = ({ mesKey, sessoes, cargaMax, defaultOpen, onCardClick, onEdit, onDelete }) => {
  const [open, setOpen] = useState(defaultOpen);

  const jogos   = sessoes.filter(s => s.tipo === 'Jogo').length;
  const cargaMediaMes = sessoes.length > 0
    ? sessoes.reduce((s, x) => s + x.cargaMedia, 0) / sessoes.length
    : 0;

  return (
    <section className="mb-3">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/10 transition-all group">
        <Icon.Chevron open={open} />
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white capitalize">
          {monthLabel(mesKey)}
        </h3>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
            {sessoes.length} sessões
          </span>
          {jogos > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-club-red/10 text-[10px] font-bold text-club-red">
              <span className="w-1.5 h-1.5 rounded-full bg-club-red" />
              {jogos} {jogos === 1 ? 'jogo' : 'jogos'}
            </span>
          )}
        </div>
        {cargaMediaMes > 0 && (
          <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
            Carga média <b className="text-slate-700 dark:text-slate-200">{cargaMediaMes.toFixed(1)}</b>
          </span>
        )}
      </button>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-2 px-1">
          {sessoes.map(s => (
            <SessaoCard
              key={s.id}
              sessao={s}
              cargaMax={cargaMax}
              onClick={() => onCardClick(s.id)}
              onEdit={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(s); }}
              onDelete={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(s.id); }}
            />
          ))}
        </div>
      )}
    </section>
  );
};

// ─── Vista Calendário ────────────────────────────────────────────────────────

const CalendarView: React.FC<{
  sessoes: SessaoRica[];
  cargaMax: number;
  onCardClick: (id: number) => void;
}> = ({ sessoes, cargaMax, onCardClick }) => {
  // Mês ativo: o mês mais recente que tem sessões; fallback = mês atual
  const [mesAtivo, setMesAtivo] = useState(() => {
    if (sessoes.length > 0) return monthKey(sessoes[0]!.data);
    return new Date().toISOString().slice(0, 7);
  });
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const [yStr, mStr] = mesAtivo.split('-');
  const y = Number(yStr), m = Number(mStr);

  const primeiroDia = new Date(Date.UTC(y, m - 1, 1));
  const diasNoMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offsetInicial = primeiroDia.getUTCDay(); // 0 = domingo

  // Map: dia (1-31) → array de sessões
  const porDia = new Map<number, SessaoRica[]>();
  for (const s of sessoes) {
    if (s.data.slice(0, 7) !== mesAtivo) continue;
    const dia = Number(s.data.slice(8, 10));
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia)!.push(s);
  }

  const navegarMes = (delta: number) => {
    const nv = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMesAtivo(nv.toISOString().slice(0, 7));
    setDiaSelecionado(null);
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  // Constrói células: leading offsets como vazias; depois 1..diasNoMes
  const totalCells = Math.ceil((offsetInicial + diasNoMes) / 7) * 7;
  const cells: Array<{ dia: number | null; iso: string | null }> = [];
  for (let i = 0; i < totalCells; i++) {
    const dia = i - offsetInicial + 1;
    if (dia < 1 || dia > diasNoMes) {
      cells.push({ dia: null, iso: null });
    } else {
      const iso = `${yStr}-${mStr}-${String(dia).padStart(2, '0')}`;
      cells.push({ dia, iso });
    }
  }

  const sessoesDoDia = diaSelecionado ? sessoes.filter(s => s.data === diaSelecionado) : [];

  return (
    <div className="space-y-4">
      {/* Header navegação */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-1">
          <button onClick={() => navegarMes(-1)}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <Icon.ArrowL />
          </button>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white capitalize min-w-[180px] text-center">
            {monthLabel(mesAtivo)}
          </h3>
          <button onClick={() => navegarMes(1)}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <Icon.ArrowR />
          </button>
        </div>
        <button onClick={() => {
          const today = new Date().toISOString().slice(0, 7);
          setMesAtivo(today);
          setDiaSelecionado(null);
        }}
          className="text-xs font-semibold text-club-red hover:underline">
          Hoje
        </button>
      </div>

      {/* Grid 7 colunas */}
      <div className="grid grid-cols-7 gap-1.5">
        {DIAS_SHORT.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 pb-1">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (cell.dia === null) {
            return <div key={i} />;
          }
          const sessoesNoDia = porDia.get(cell.dia) ?? [];
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === diaSelecionado;
          const temJogo = sessoesNoDia.some(s => s.tipo === 'Jogo');
          const cargaMediaDia = sessoesNoDia.length > 0
            ? sessoesNoDia.reduce((s, x) => s + x.cargaMedia, 0) / sessoesNoDia.length
            : 0;
          const intensidade = cargaMax > 0 ? cargaMediaDia / cargaMax : 0;
          const accentColor = temJogo ? '#cc1e1e' : intensidade >= 0.7 ? '#f59e0b' : intensidade >= 0.4 ? '#0d9488' : '#06b6d4';

          return (
            <button key={i}
              onClick={() => sessoesNoDia.length > 0 && setDiaSelecionado(cell.iso)}
              disabled={sessoesNoDia.length === 0}
              className={`group relative h-24 p-2 pl-3 rounded-xl border text-left transition-all overflow-hidden ${
                isSelected
                  ? 'border-club-red ring-1 ring-club-red/50 shadow-md shadow-club-red/10 bg-club-red/5'
                  : isToday
                    ? 'border-slate-400 dark:border-white/30 bg-slate-50 dark:bg-white/[0.02]'
                    : 'border-slate-200 dark:border-white/[0.06] bg-card'
              } ${sessoesNoDia.length > 0
                  ? 'cursor-pointer hover:border-slate-300 dark:hover:border-white/15 hover:shadow-lg hover:-translate-y-0.5'
                  : 'opacity-40 cursor-default'
              }`}
            >
              {sessoesNoDia.length > 0 && (
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accentColor }} />
              )}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-extrabold tabular-nums ${
                  isToday ? 'text-club-red' : 'text-slate-900 dark:text-white'
                }`}>
                  {cell.dia}
                </span>
                {temJogo && (
                  <span className="px-1.5 py-0.5 bg-club-red text-white text-[8px] font-extrabold rounded uppercase tracking-wider leading-none">JOGO</span>
                )}
              </div>
              {sessoesNoDia.length > 0 && (
                <div className="space-y-1 mt-1.5">
                  {sessoesNoDia.slice(0, 2).map(s => (
                    <div key={s.id} className={`truncate text-[9px] font-bold rounded-md px-1.5 py-0.5 ${
                      s.tipo === 'Jogo'
                        ? 'bg-club-red/10 text-club-red border border-club-red/10'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                    }`}>
                      {s.descricao || (s.tipo === 'Jogo' ? 'MD' : 'Treino')}
                    </div>
                  ))}
                  {sessoesNoDia.length > 2 && (
                    <div className="text-[9px] font-bold text-slate-400 px-1 mt-0.5">+{sessoesNoDia.length - 2}</div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Painel do dia selecionado */}
      {diaSelecionado && sessoesDoDia.length > 0 && (
        <div className="relative overflow-hidden bg-card border border-slate-200 dark:border-white/[0.06] rounded-xl p-5 shadow-lg mt-2">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-club-red via-orange-500 to-amber-400" />
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-club-red" />
              {formatData(diaSelecionado)}
              <span className="text-[11px] text-slate-400 font-medium ml-1">
                ({sessoesDoDia.length} {sessoesDoDia.length === 1 ? 'sessão' : 'sessões'})
              </span>
            </h4>
            <button onClick={() => setDiaSelecionado(null)}
              className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-club-red transition-colors">
              Fechar ✕
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessoesDoDia.map(s => (
              <SessaoCard
                key={s.id}
                sessao={s}
                cargaMax={cargaMax}
                onClick={() => onCardClick(s.id)}
                onEdit={() => {/* edit via lista — keep simple */}}
                onDelete={() => {/* delete via lista — keep simple */}}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Página principal ────────────────────────────────────────────────────────

export const Sessoes: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [sessoes, setSessoes] = useState<SessaoRica[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);

  const [view, setView]   = useState<ViewMode>('lista');
  const [busca, setBusca] = useState('');
  const buscaDeb = useDebouncedValue(busca, 200);

  const [tipo, setTipo] = useState<TipoFiltro>('Todos');
  const [sort, setSort] = useState<SortKey>('dataDesc');
  const [de,  setDe]  = useState<string>('');
  const [ate, setAte] = useState<string>('');

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [editingSessao, setEditingSessao] = useState<SessaoRica | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/sessoes/listagem`);
      if (!r.ok) throw new Error('Falha ao carregar sessões');
      setSessoes(await r.json());
      setErro(null);
    } catch (e) {
      setErro(String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { carregar(); }, []);

  const executarRemocao = async () => {
    if (pendingDeleteId == null) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      const r = await fetch(`${API_BASE}/sessoes/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('falhou');
      setSessoes(prev => prev.filter(s => s.id !== id));
      toast.success('Sessão removida');
    } catch {
      toast.error('Falha ao remover sessão');
    }
  };

  const executarEdicao = async (id: number, dados: { data: string; tipo: string; descricao: string; equipe: string; local: string }) => {
    const r = await fetch(`${API_BASE}/sessoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    if (!r.ok) {
      toast.error('Falha ao atualizar sessão');
      throw new Error('Falha ao atualizar sessão');
    }
    // Atualiza localmente sem refazer a listagem inteira
    setSessoes(prev => prev.map(s =>
      s.id === id
        ? { ...s, data: dados.data, tipo: dados.tipo, descricao: dados.descricao || null, equipe: dados.equipe || null, local: dados.local || null }
        : s
    ));
    toast.success('Sessão atualizada');
  };

  // ─── Filtragem + ordenação ──────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const q = buscaDeb.trim().toLowerCase();
    let out = sessoes.filter(s => {
      if (tipo !== 'Todos' && s.tipo !== tipo) return false;
      if (de  && s.data < de)  return false;
      if (ate && s.data > ate) return false;
      if (q) {
        const blob = `${s.descricao ?? ''} ${s.local ?? ''} ${s.equipe ?? ''} ${s.data}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    out = [...out].sort((a, b) => {
      switch (sort) {
        case 'dataDesc':    return b.data.localeCompare(a.data);
        case 'dataAsc':     return a.data.localeCompare(b.data);
        case 'cargaDesc':   return b.cargaMedia - a.cargaMedia;
        case 'atletasDesc': return b.atletasCount - a.atletasCount;
        default: return 0;
      }
    });
    return out;
  }, [sessoes, buscaDeb, tipo, de, ate, sort]);

  // Para colorir barras de carga em escala global (não por mês)
  const cargaMax = useMemo(
    () => Math.max(1, ...sessoes.map(s => s.cargaMedia)),
    [sessoes],
  );

  // Agrupamento por mês (vista lista)
  const porMes = useMemo(() => {
    const map = new Map<string, SessaoRica[]>();
    for (const s of filtradas) {
      const k = monthKey(s.data);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtradas]);

  // Stats de cabeçalho — sempre baseadas nos dados completos (não filtrados)
  const totalJogos   = sessoes.filter(s => s.tipo === 'Jogo').length;
  const totalTreinos = sessoes.length - totalJogos;

  const filtrosAtivos = !!buscaDeb.trim() || tipo !== 'Todos' || !!de || !!ate;

  const limparFiltros = () => {
    setBusca(''); setTipo('Todos'); setDe(''); setAte('');
  };

  // Mês mais recente fica aberto por padrão (se houver dados)
  const mesMaisRecente = porMes[0]?.[0] ?? null;

  return (
    <div className="min-h-screen bg-surface">
      <ConfirmModal
        open={pendingDeleteId !== null}
        message="Remover esta sessão e todas as suas métricas?"
        details={(() => {
          const s = sessoes.find(x => x.id === pendingDeleteId);
          if (!s) return undefined;
          const titulo = s.descricao || (s.tipo === 'Jogo' ? 'Partida' : 'Treino');
          return `${formatData(s.data)} · ${titulo}`;
        })()}
        onConfirm={executarRemocao}
        onCancel={() => setPendingDeleteId(null)}
      />

      <EditSessaoModal
        sessao={editingSessao}
        onClose={() => setEditingSessao(null)}
        onSave={executarEdicao}
      />

      {/* HEADER */}
      <header className="relative overflow-hidden bg-card border-b border-slate-200 dark:border-white/[0.06] px-8 py-5">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-club-red via-orange-500 to-amber-400" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">
              Arquivo de Sessões
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Sessões</h1>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">{sessoes.length}</span>
                <span className="text-[10px] text-slate-400">total</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-club-red/5 border border-club-red/15">
                <span className="w-2 h-2 rounded-full bg-club-red" />
                <span className="text-sm font-extrabold text-club-red tabular-nums">{totalJogos}</span>
                <span className="text-[10px] text-slate-400">{totalJogos === 1 ? 'jogo' : 'jogos'}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06]">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">{totalTreinos}</span>
                <span className="text-[10px] text-slate-400">{totalTreinos === 1 ? 'treino' : 'treinos'}</span>
              </div>
              {filtrosAtivos && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                  <span className="text-sm font-extrabold text-amber-600 tabular-nums">{filtradas.length}</span>
                  <span className="text-[10px] text-amber-500">filtrados</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={() => navigate('/upload')}
            className="bg-club-red text-white text-xs font-bold px-5 py-2.5 rounded-lg hover:opacity-90 accent-glow flex items-center gap-1.5 shadow-lg shadow-club-red/20">
            <Icon.Plus /> Nova sessão
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
          {/* Busca */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Icon.Search />
            <input
              type="text" value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar adversário, local, equipe ou data..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-input border border-slate-200 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-club-red"
            />
          </div>

          {/* Tipo */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg">
            {(['Todos', 'Jogo', 'Treino'] as TipoFiltro[]).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  tipo === t
                    ? 'bg-club-red text-white accent-glow'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}>
                {t}
              </button>
            ))}
          </div>

          {/* Range datas */}
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-widest">De</span>
            <input type="date" value={de} onChange={e => setDe(e.target.value)}
              className="px-2 py-1 text-[11px] bg-input border border-slate-200 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none focus:border-club-red" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Até</span>
            <input type="date" value={ate} onChange={e => setAte(e.target.value)}
              className="px-2 py-1 text-[11px] bg-input border border-slate-200 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none focus:border-club-red" />
          </div>

          {/* Sort (apenas vista lista) */}
          {view === 'lista' && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ordenar</span>
              <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
                className="px-2 py-1 text-[11px] bg-input border border-slate-200 dark:border-white/10 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none focus:border-club-red">
                <option value="dataDesc">Data ↓</option>
                <option value="dataAsc">Data ↑</option>
                <option value="cargaDesc">Carga ↓</option>
                <option value="atletasDesc">Atletas ↓</option>
              </select>
            </div>
          )}

          {filtrosAtivos && (
            <button onClick={limparFiltros}
              className="text-[11px] font-semibold text-club-red hover:underline">
              Limpar
            </button>
          )}

          {/* Toggle vista */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg ml-auto">
            <button onClick={() => setView('lista')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                view === 'lista' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}>
              Lista
            </button>
            <button onClick={() => setView('calendario')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                view === 'calendario' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}>
              Calendário
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        {loading && (
          <p className="text-center text-sm text-slate-400 py-12">Carregando sessões…</p>
        )}
        {erro && (
          <p className="text-center text-sm text-red-500 py-12">{erro}</p>
        )}

        {!loading && !erro && sessoes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Nenhuma sessão registrada ainda.
            </p>
            <button onClick={() => navigate('/upload')}
              className="bg-club-red text-white text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 accent-glow inline-flex items-center gap-1.5">
              <Icon.Plus /> Importar primeiro CSV
            </button>
          </div>
        )}

        {!loading && !erro && sessoes.length > 0 && filtradas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Nenhuma sessão corresponde aos filtros atuais.
            </p>
            <button onClick={limparFiltros}
              className="text-xs font-bold text-club-red hover:underline">
              Limpar filtros
            </button>
          </div>
        )}

        {!loading && !erro && filtradas.length > 0 && view === 'lista' && (
          <div>
            {porMes.map(([mes, lista]) => (
              <MesSection
                key={mes}
                mesKey={mes}
                sessoes={lista}
                cargaMax={cargaMax}
                defaultOpen={mes === mesMaisRecente || filtrosAtivos}
                onCardClick={(id) => navigate(`/sessao/${id}`)}
                onEdit={(sessao) => setEditingSessao(sessao)}
                onDelete={(id) => setPendingDeleteId(id)}
              />
            ))}
          </div>
        )}

        {!loading && !erro && filtradas.length > 0 && view === 'calendario' && (
          <CalendarView
            sessoes={filtradas}
            cargaMax={cargaMax}
            onCardClick={(id) => navigate(`/sessao/${id}`)}
          />
        )}
      </main>
    </div>
  );
};
