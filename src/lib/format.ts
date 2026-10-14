import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/** The system's "today" — fixed so the prototype reads consistently.
 *  Anchored to mid-morning so same-day activity reads as "x hours ago",
 *  not "in x hours". */
export const TODAY = dayjs('2026-09-22T09:30:00');

export const fmtDate = (d?: string | null) => (d ? dayjs(d).format('DD MMM YYYY') : '—');
export const fmtDateShort = (d?: string | null) => (d ? dayjs(d).format('DD MMM') : '—');
export const fmtLongDate = (d: dayjs.Dayjs = TODAY) => d.format('dddd, DD MMMM YYYY');
export const fmtRelative = (d: string) => dayjs(d).from(TODAY);

/** Days from TODAY until the given date. Negative = in the past. */
export const daysUntil = (d: string) => dayjs(d).startOf('day').diff(TODAY.startOf('day'), 'day');

export const fmtNumber = (n: number) => n.toLocaleString('en-US');

export const revLabel = (n: number) => `Rev. ${String(n).padStart(2, '0')}`;

export { dayjs };
