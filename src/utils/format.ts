import type { IndicatorSignal, OverallTechnicalRating } from '../../shared/types.ts';

export function formatINR(value: number, showSign = false): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value < 0) return `-₹${formatted}`;
  if (showSign && value > 0) return `+₹${formatted}`;
  return `₹${formatted}`;
}

export function formatPrice(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSigned(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

export function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function getSignalTextClass(
  signal: IndicatorSignal | OverallTechnicalRating,
): string {
  if (signal === 'Strong Buy' || signal === 'Buy') {
    return 'text-[#4CAF50] dark:text-[#4ADE80]';
  }
  if (signal === 'Strong Sell' || signal === 'Sell') {
    return 'text-[#DF514C] dark:text-[#F87171]';
  }
  return 'text-[#9B9B9B] dark:text-[#8B909E]';
}

export function getChangeColorClass(value: number): string {
  if (value > 0) return 'text-[#4CAF50] dark:text-[#4ADE80]';
  if (value < 0) return 'text-[#DF514C] dark:text-[#F87171]';
  return 'text-[#666666] dark:text-[#8B909E]';
}
