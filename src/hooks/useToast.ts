import { useCallback, useRef, useState } from 'react';

export function useToast() {
  const [toast, setToast] = useState({ message: '', visible: false });
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((message: string) => {
    window.clearTimeout(timer.current);
    setToast({ message, visible: true });
    timer.current = window.setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 3000);
  }, []);

  return { toast, notify };
}
