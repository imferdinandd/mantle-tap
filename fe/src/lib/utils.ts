import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toWsUrl(httpUrl: string): string {
  if (httpUrl.startsWith('wss://') || httpUrl.startsWith('ws://')) return httpUrl;
  if (httpUrl.startsWith('https://')) return httpUrl.replace('https://', 'wss://');
  if (httpUrl.startsWith('http://')) return httpUrl.replace('http://', 'ws://');
  return `ws://${httpUrl}`;
}
