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
          classes,
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
