export function formatDate(dateInput: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date(dateInput));
}

export function formatDateTime(dateInput: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date(dateInput));
}

export function formatTimeNow() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date());
}
