import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  /** Cabeçalho de grupo (estilo <optgroup>). Renderizado antes do 1º item do grupo. */
  group?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  /** Classes extras no botão-gatilho (largura, max-width). */
  className?: string;
}

interface Coords { left: number; width: number; top?: number; bottom?: number; }

/**
 * Dropdown temático (não-nativo) com fidelidade total ao tema da app.
 * Substitui o <select> nativo, cujo popup é desenhado pelo SO (cor sólida única,
 * barra de seleção azul do Windows). Reimplementa o padrão WAI-ARIA listbox.
 *
 * O popup vai num portal com posição `fixed` calculada a partir do gatilho, porque
 * o <main> da app é `overflow-y-auto` (contexto de clipping) — um popup absoluto
 * dentro dele seria cortado.
 */
export function Select({ value, onChange, options, ariaLabel, className = '' }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coords, setCoords] = useState<Coords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typeahead = useRef({ buf: '', t: 0 });
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optId = (i: number) => `${baseId}-opt-${i}`;

  const selectedIndex = options.findIndex(o => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : options[0];
  const isPlaceholder = value === '';

  function reposition() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 300 && r.top > spaceBelow;
    setCoords(openUp
      ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 }
      : { left: r.left, width: r.width, top: r.bottom + 4 });
  }

  function openMenu(toIndex?: number) {
    reposition();
    setActiveIndex(toIndex ?? (selectedIndex >= 0 ? selectedIndex : 0));
    setOpen(true);
  }
  function closeMenu(focusTrigger = true) {
    setOpen(false);
    setActiveIndex(-1);
    if (focusTrigger) triggerRef.current?.focus();
  }
  function commit(i: number) {
    const opt = options[i];
    if (opt) onChange(opt.value);
    closeMenu();
  }
  function move(delta: number) {
    setActiveIndex(i => {
      const n = options.length;
      if (n === 0) return -1;
      const next = i < 0 ? (delta > 0 ? 0 : n - 1) : i + delta;
      return Math.max(0, Math.min(n - 1, next));
    });
  }

  // Reposiciona enquanto aberto (scroll em qualquer container — capture — e resize)
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScrollOrResize = () => reposition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fecha ao clicar fora (gatilho + popup ficam em árvores diferentes por causa do portal)
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !popupRef.current?.contains(t)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    popupRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); open ? move(1) : openMenu(); break;
      case 'ArrowUp':   e.preventDefault(); open ? move(-1) : openMenu(); break;
      case 'Home':      if (open) { e.preventDefault(); setActiveIndex(0); } break;
      case 'End':       if (open) { e.preventDefault(); setActiveIndex(options.length - 1); } break;
      case 'Escape':    if (open) { e.preventDefault(); closeMenu(); } break;
      case 'Tab':       if (open) closeMenu(false); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) openMenu();
        else if (activeIndex >= 0) commit(activeIndex);
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const now = Date.now();
          typeahead.current.buf = now - typeahead.current.t > 600 ? e.key : typeahead.current.buf + e.key;
          typeahead.current.t = now;
          const q = typeahead.current.buf.toLowerCase();
          const n = options.length;
          const start = open && activeIndex >= 0 ? activeIndex : Math.max(0, selectedIndex);
          for (let k = 1; k <= n; k++) {
            const idx = (start + k) % n;
            if (options[idx]!.label.toLowerCase().startsWith(q)) {
              open ? setActiveIndex(idx) : openMenu(idx);
              break;
            }
          }
        }
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={open && activeIndex >= 0 ? optId(activeIndex) : undefined}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 bg-input focus:outline-none focus-visible:ring-2 focus-visible:ring-club-red/40 focus:border-club-red cursor-pointer transition-colors ${isPlaceholder ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'} ${className}`}
      >
        <span className="truncate">{selected?.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && coords && createPortal(
        <ul
          ref={popupRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          style={{ left: coords.left, top: coords.top, bottom: coords.bottom, minWidth: coords.width }}
          className="fixed z-[100] w-max max-w-[min(90vw,360px)] max-h-80 overflow-y-auto py-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141b26] dark:bg-gradient-to-b dark:from-white/[0.05] dark:to-transparent shadow-xl dark:shadow-[0_24px_60px_-16px_rgba(0,0,0,0.7)]"
        >
          {options.map((opt, i) => {
            const showHeader = opt.group && opt.group !== options[i - 1]?.group;
            const isSelected = opt.value === value;
            const isActive = i === activeIndex;
            return (
              <Fragment key={i}>
                {showHeader && (
                  <li role="presentation" className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {opt.group}
                  </li>
                )}
                <li
                  id={optId(i)}
                  data-idx={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => commit(i)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer ${isActive ? 'bg-slate-100 dark:bg-white/[0.07]' : ''} ${isSelected ? 'text-club-red font-bold' : 'text-slate-700 dark:text-slate-200'}`}
                >
                  <span className="flex-1">{opt.label}</span>
                  {isSelected && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 shrink-0">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
}
