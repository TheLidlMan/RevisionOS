export function formatDays(value: number): string {
  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, "");
  const unit = Math.abs(value) === 1 ? "day" : "days";
  return `${rounded} ${unit}`;
}

export function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatRelativeTime(input?: string | Date | null): string {
  if (!input) {
    return "just now";
  }

  const value = typeof input === "string" ? new Date(input) : input;
  const diffMs = Date.now() - value.getTime();
  const diffSeconds = Math.max(0, Math.round(diffMs / 1000));

  if (diffSeconds < 5) {
    return "just now";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return value.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(input?: string | Date | null): string {
  if (!input) {
    return "Not available";
  }

  const value = typeof input === "string" ? new Date(input) : input;
  return value.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatAutosaveStatus(status: "idle" | "saving" | "saved" | "error", restored = false): string {
  if (status === "saving") {
    return "Saving draft...";
  }
  if (status === "saved") {
    return restored ? "Draft restored" : "Saved";
  }
  if (status === "error") {
    return "Failed to save";
  }
  return "Drafts save automatically";
}
