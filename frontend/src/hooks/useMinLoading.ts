import { useState, useEffect, useRef } from "react";

export function useMinLoading(isLoading: boolean, minDuration: number = 500) {
  const [showLoading, setShowLoading] = useState(isLoading);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isLoading) {
      startTimeRef.current = Date.now();
      setShowLoading(true);
    } else {
      const elapsed = Date.now() - startTimeRef.current;
      const delay = Math.max(0, minDuration - elapsed);

      if (delay > 0) {
        timeout = setTimeout(() => {
          setShowLoading(false);
        }, delay);
      } else {
        setShowLoading(false);
      }
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading, minDuration]);

  return showLoading;
}
