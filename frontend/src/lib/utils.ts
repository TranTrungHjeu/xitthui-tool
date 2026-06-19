import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isKhiemAccount(user: any): boolean {
  if (!user) return false;
  return (
    user.username === "lekhiem2002" ||
    user.username === "I3470" ||
    user.email === "lekhiem2002@mindx.net.vn" ||
    user.email === "lethekhiem2002@mindx.net.vn" ||
    user.email === "khiemlt@mindx.com.vn" ||
    user.email === "khiemlt@mindx.net.vn"
  );
}
