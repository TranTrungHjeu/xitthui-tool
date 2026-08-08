import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  classes: any[] | null;
  lastClassesFetch: number | null;
  classDetailsById: Record<string, any>;
  lastClassDetailsFetch: Record<string, number>;
  login: (user: User) => void;
  logout: () => void;
  setTeacherId: (teacherId: string) => void;
  setClasses: (classes: any[]) => void;
  mergeClassDetails: (classes: any[]) => void;
  clearClasses: () => void;
}

// Cap the persisted classes array to avoid blowing up the sessionStorage
// quota when a teacher has 1000+ classes. Full slot/student payloads are
// stripped down to lightweight metadata so each entry stays small.
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

/**
 * Notes on the migration from `localStorage` → `sessionStorage`:
 *
 *   * Before, this store used `persist` with the default `localStorage`
 *     adapter, which also covered the LMS token + sessionId. That caused
 *     a hydration race on every reload: the dashboard fired its first
 *     `useEffect` before `token`/`sessionId` were rehydrated, the axios
 *     interceptor read `null`, and the backend returned 400 "Token is
 *     required".
 *   * The auth tokens now live in httpOnly cookies set by the server.
 *     The store only carries non-secret UI state (user, classes cache).
 *   * We switched to `sessionStorage` so closing the tab clears the UI
 *     cache as well — the user must re-login, but at that point the FE
 *     knows there's no user anywhere and shows the login screen instead
 *     of pretending to be authenticated.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      classes: null,
      lastClassesFetch: null,
      classDetailsById: {},
      lastClassDetailsFetch: {},
      login: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
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
          // data so the persisted cache cannot exceed sessionStorage quota.
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
      storage: createJSONStorage(() =>
        // sessionStorage.clear() once the tab/window closes — see file
        // header comment for why this is intentional.
        typeof window !== "undefined" ? window.sessionStorage : (undefined as any),
      ),
    },
  ),
);
