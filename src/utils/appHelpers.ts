let idCounter = 0;

export function generateUniqueId(): string {
  return `${Date.now()}-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getStatusGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return '夜深了，注意休息';
  if (hour < 9) return '早安，新的一天';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了，早点休息';
}

export function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function openSafeUrl(url: string): void {
  if (isHttpUrl(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
