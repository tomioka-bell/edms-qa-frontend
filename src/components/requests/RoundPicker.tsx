import { useState } from 'react';
import { Dropdown } from 'antd';
import { Check, ChevronDown, ChevronLeft, ChevronRight, History } from 'lucide-react';
import type { DocumentRequest, RequestRound } from '../../types/documentRequest';
import { dayjs } from '../../lib/format';
import { cn } from '../../lib/cn';

interface Props {
  request: Pick<DocumentRequest, 'rounds' | 'round' | 'status' | 'history'>;
  /** The round being shown */
  value: number;
  onChange: (round: number) => void;
}

type Tone = 'now' | 'ok' | 'back' | 'off';

const TONE: Record<Tone, string> = {
  now: 'bg-info-soft text-info',
  ok: 'bg-ok-soft text-[#15803D]',
  back: 'bg-warn-soft text-[#A16207]',
  off: 'bg-[#F4F4F5] text-ink-2',
};

/** How one round ended, in a few words: sent back by whom and why, taken back, approved, or still going. */
function outcomeOf(request: Props['request'], round: RequestRound): { tone: Tone; label: string; detail: string } {
  const ending = request.history.find((h) => h.round === round.round && (h.action === 'REJECT' || h.action === 'RECALL' || h.action === 'CANCEL'));
  if (ending?.action === 'REJECT') {
    return { tone: 'back', label: 'Sent back', detail: `${ending.actor_name || ending.actor_code}${ending.comment ? `: “${ending.comment}”` : ''}` };
  }
  if (ending?.action === 'RECALL') return { tone: 'off', label: 'Taken back', detail: 'The requester took it back to change it' };
  if (ending?.action === 'CANCEL') return { tone: 'off', label: 'Cancelled', detail: `By ${ending.actor_name || ending.actor_code}` };
  if (round.round === request.round && request.status === 'APPROVED') return { tone: 'ok', label: 'Approved', detail: 'Every step passed' };
  return { tone: 'now', label: 'In approval', detail: 'With the approvers now' };
}

/**
 * Chooses which sending of a document to look at. A document that was sent back and sent again has
 * one version per round; this steps between them, and its list says how each round ended.
 */
export default function RoundPicker({ request, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rounds = request.rounds;
  const index = Math.max(
    rounds.findIndex((r) => r.round === value),
    0,
  );
  const shown = rounds[index];
  if (!shown) return null;

  const isCurrent = shown.round === request.round;
  const outcome = outcomeOf(request, shown);
  const arrow =
    'flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-2 transition-colors hover:border-[#D4D4D8] hover:bg-[#FAFAFB] disabled:pointer-events-none disabled:opacity-35';

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <button type="button" onClick={() => onChange(rounds[index - 1].round)} disabled={index === 0} aria-label="Earlier version" title="Earlier version" className={arrow}>
        <ChevronLeft size={15} />
      </button>

      <Dropdown
        open={open}
        onOpenChange={setOpen}
        trigger={['click']}
        placement="bottomLeft"
        popupRender={() => (
          <div className="w-88 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
            <p className="border-b border-line px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">
              Versions <span className="tnum font-medium text-faint normal-case">· sent {request.round} {request.round === 1 ? 'time' : 'times'}</span>
            </p>
            <ul className="slim-scroll max-h-80 overflow-y-auto py-1" role="listbox" aria-label="Versions of this document">
              {/* Newest first: the one in force is what people look for most */}
              {[...rounds].reverse().map((r) => {
                const end = outcomeOf(request, r);
                const active = r.round === shown.round;
                return (
                  <li key={r.round}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(r.round);
                        setOpen(false);
                      }}
                      className={cn('flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors', active ? 'bg-brand-50/70' : 'hover:bg-[#FAFAFB]')}
                    >
                      <span
                        className={cn(
                          'tnum mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold',
                          active ? 'bg-brand-500 text-white' : 'bg-[#F4F4F5] text-ink-2',
                        )}
                      >
                        {r.round}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-[13px] font-semibold text-ink">Round {r.round}</span>
                          <span className={cn('rounded px-1.5 py-px text-[10.5px] font-semibold tracking-[0.02em] uppercase', TONE[end.tone])}>{end.label}</span>
                          {r.round === request.round && <span className="text-[11px] font-medium text-brand-600">Current</span>}
                        </span>
                        <span className="tnum mt-0.5 block text-[11.5px] text-muted">Sent {dayjs(r.sent_at).format('DD MMM YYYY HH:mm')}</span>
                        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-ink-2">{end.detail}</span>
                      </span>
                      {active && <Check size={15} className="mt-1 shrink-0 text-brand-600" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {/* Rounds sent before versions were kept have nothing to show */}
            {rounds[0].round > 1 && (
              <p className="border-t border-line bg-[#FAFAFB] px-4 py-2 text-[11.5px] leading-relaxed text-muted">
                {rounds[0].round === 2 ? 'Round 1 was' : `Rounds 1 to ${rounds[0].round - 1} were`} sent before versions were kept, so there is no copy to show.
              </p>
            )}
          </div>
        )}
      >
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Version shown: round ${shown.round} of ${request.round}. Choose another`}
          className={cn(
            'flex h-8 min-w-0 items-center gap-2 rounded-md border px-2.5 text-[12.5px] transition-colors',
            isCurrent ? 'border-line bg-surface hover:border-[#D4D4D8] hover:bg-[#FAFAFB]' : 'border-[#FDE68A] bg-warn-soft hover:bg-[#FEF9C3]',
          )}
        >
          <History size={14} className={cn('shrink-0', isCurrent ? 'text-muted' : 'text-[#A16207]')} />
          <span className="font-semibold whitespace-nowrap text-ink">Round {shown.round}</span>
          <span className="tnum whitespace-nowrap text-muted">of {request.round}</span>
          <span className={cn('rounded px-1.5 py-px text-[10.5px] font-semibold tracking-[0.02em] whitespace-nowrap uppercase', TONE[outcome.tone])}>
            {isCurrent ? 'Current' : outcome.label}
          </span>
          <ChevronDown size={14} className="shrink-0 text-muted" />
        </button>
      </Dropdown>

      <button
        type="button"
        onClick={() => onChange(rounds[index + 1].round)}
        disabled={index === rounds.length - 1}
        aria-label="Later version"
        title="Later version"
        className={arrow}
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
