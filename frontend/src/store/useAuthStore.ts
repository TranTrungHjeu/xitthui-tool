import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  sessionId: string | null;
  isAuthenticated: boolean;
  classes: any[] | null;
  lastClassesFetch: number | null;
  classDetailsById: Record<string, any>;
  lastClassDetailsFetch: Record<string, number>;
  login: (user: User, token: string, sessionId: string) => void;
  updateToken: (token: string, sessionId?: string) => void;
  logout: () => void;
  setTeacherId: (teacherId: string) => void;
  setClasses: (classes: any[]) => void;
  mergeClassDetails: (classes: any[]) => void;
  clearClasses: () => void;
}

// Cap the persisted classes array to avoid blowing up the localStorage quota
// when a teacher has 1000+ classes. Full slot/student payloads are stripped
// down to lightweight metadata so each entry stays small.
const MAX_STORED_CLASSES = 200;

function toLightweightClass(cls: any): any {
  if (!cls || typeof cls !== "object") return cls;
  const { id, name, status, slots, slotCount, slotsCount, ...rest } = cls;
  const meta: Record<string, any> = { ...rest };
  if (id !== undefined) meta.id = id;
  if (name !== undefined) meta.name = name;
  if (status !== undefined) meta.status = status;
  const resolvedSlotsCount =
    typeof slotsCount === "number"
      ? slotsCount
      : typeof slotCount === "number"
        ? slotCount
        : Array.isArray(slots)
          ? slots.length
          : undefined;
  if (resolvedSlotsCount !== undefined) meta.slotsCount = resolvedSlotsCount;
  delete meta.slots;
  return meta;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      sessionId: null,
      isAuthenticated: false,
      classes: null,
      lastClassesFetch: null,
      classDetailsById: {},
      lastClassDetailsFetch: {},
      login: (user, token, sessionId) =>
        set({
          user,
          token,
          sessionId,
          isAuthenticated: true,
        }),
      updateToken: (token, sessionId) =>
        set((state) => ({
          token,
          sessionId: sessionId || state.sessionId,
        })),
      logout: () =>
        set({
          user: null,
          token: null,
          sessionId: null,
          isAuthenticated: false,
          classes: null,
          lastClassesFetch: null,
          classDetailsById: {},
          lastClassDetailsFetch: {},
        }),
      setTeacherId: (teacherId) =>
        set((state) => ({
          user: state.user ? { ...state.user, teacherId } : null,
        })),
      setClasses: (classes) =>
        set({
          // Slice to the first MAX_STORED_CLASSES items and strip deep per-slot
          // data so the persisted cache cannot exceed localStorage quota.
          classes: (classes || [])
            .slice(0, MAX_STORED_CLASSES)
            .map(toLightweightClass),
          lastClassesFetch: Date.now(),
        }),
      mergeClassDetails: (classes) =>
        set((state) => {
          const detailMap = { ...state.classDetailsById };
          const detailTimestamps = { ...state.lastClassDetailsFetch };
          const mergedClasses = (state.classes || []).map((existingClass) => {
            const detailedClass = classes.find(
              (cls) => cls.id === existingClass.id,
            );

            if (!detailedClass) return existingClass;

            detailMap[detailedClass.id] = detailedClass;
            detailTimestamps[detailedClass.id] = Date.now();

            return {
              ...existingClass,
              ...detailedClass,
            };
          });

          return {
            classes: mergedClasses,
            classDetailsById: detailMap,
            lastClassDetailsFetch: detailTimestamps,
          };
        }),
      clearClasses: () =>
        set({
          classes: null,
          lastClassesFetch: null,
          classDetailsById: {},
          lastClassDetailsFetch: {},
        }),
    }),
    {
      name: "auth-storage",
    },
  ),
);
