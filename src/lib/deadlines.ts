import { dayjs } from './format';

/** How a point in time that something is due at reads right now. */
export interface DueState {
  /** "Overdue by 2 days", "Due today", "Due in 3 days" */
  text: string;
  /** late: the time has passed. soon: it ends within a day. ok: there is time. */
  tone: 'late' | 'soon' | 'ok';
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** Says how much time is left until `dueAt`, or by how much it has been missed. */
export function describeDue(dueAt: string, now = dayjs()): DueState {
  const due = dayjs(dueAt);
  const hours = due.diff(now, 'hour', true);
  if (hours < 0) {
    const late = -hours;
    return { text: `Overdue by ${late < 24 ? plural(Math.max(1, Math.round(late)), 'hour') : plural(Math.floor(late / 24), 'day')}`, tone: 'late' };
  }
  if (hours < 24) return { text: due.isSame(now, 'day') ? 'Due today' : 'Due tomorrow', tone: 'soon' };
  return { text: `Due in ${plural(Math.ceil(hours / 24), 'day')}`, tone: 'ok' };
}

/** "3 days to decide", for a step that has not started its clock; empty when it has no limit. */
export const describeLimit = (dueDays: number) => (dueDays > 0 ? `${plural(dueDays, 'day')} to decide` : '');

export const DUE_TONE: Record<DueState['tone'], string> = {
  late: 'bg-danger-soft text-danger-strong ring-danger-ring',
  soon: 'bg-warn-soft text-[#A16207] ring-[#FEF08A]',
  ok: 'bg-[#F4F4F5] text-ink-2 ring-[#E4E4E7]',
};

/** How many days ahead a document counts as about to expire */
export const EXPIRING_SOON_DAYS = 30;

/** Whole days from today to the last day a document is valid; negative once that day is over. */
export const daysUntilExpiry = (validUntil: string) => dayjs(validUntil).startOf('day').diff(dayjs().startOf('day'), 'day');
