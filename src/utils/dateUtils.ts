import { format, formatDistanceToNow, isToday, isYesterday, startOfWeek, endOfWeek, eachDayOfInterval, subDays } from 'date-fns';

export function formatDate(date: Date | string, formatStr: string = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, formatStr);
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';

  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'h:mm a');
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM d, yyyy h:mm a');
}

export function getWeekDays(date: Date = new Date(), startOn: 0 | 1 = 1): Date[] {
  const start = startOfWeek(date, { weekStartsOn: startOn });
  const end = endOfWeek(date, { weekStartsOn: startOn });
  return eachDayOfInterval({ start, end });
}

export function getLast7Days(): Date[] {
  return Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
}

export function getLast30Days(): Date[] {
  return Array.from({ length: 30 }, (_, i) => subDays(new Date(), 29 - i));
}

export function getLast90Days(): Date[] {
  return Array.from({ length: 90 }, (_, i) => subDays(new Date(), 89 - i));
}

export function getDateRange(days: number): { start: Date; end: Date } {
  return {
    start: subDays(new Date(), days - 1),
    end: new Date(),
  };
}

export function formatDayOfWeek(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'EEE');
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return format(date1, 'yyyy-MM-dd') === format(date2, 'yyyy-MM-dd');
}

export function getMonthDays(year: number, month: number): Date[] {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return eachDayOfInterval({ start, end });
}
