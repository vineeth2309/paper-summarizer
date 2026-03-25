export function formatDistanceToNow(date: Date) {
  const diff = Date.now() - date.getTime();
  const hours = Math.round(diff / (1000 * 60 * 60));

  if (hours < 24) {
    return `${Math.max(hours, 1)}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
