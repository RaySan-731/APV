import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  // Without Tailwind build, simple clsx merging is sufficient.
  return clsx(inputs);
}
