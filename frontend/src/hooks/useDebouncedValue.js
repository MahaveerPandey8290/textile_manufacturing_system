import { useEffect, useState } from 'react';

/** Returns `value` only after it has stopped changing for `delayMs` — used to avoid a request per keystroke. */
export function useDebouncedValue(value, delayMs = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debouncedValue;
}
