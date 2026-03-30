import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function sanitizeText(input: string) {
  return input
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function sanitizeJsonValue<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizeJsonValue(nestedValue)])
    ) as T;
  }

  return value;
}

export function truncate(input: string, length = 220) {
  if (input.length <= length) {
    return input;
  }

  return `${input.slice(0, length).trimEnd()}...`;
}

export function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(16);
}

export function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
