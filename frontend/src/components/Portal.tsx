import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

/**
 * Renders children at document.body level, outside all scroll containers.
 * Safe to use for permanently-mounted content like modals.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (!containerRef.current) {
    containerRef.current = document.createElement('div');
    containerRef.current.className = 'modal-portal';
    document.body.appendChild(containerRef.current);
  }

  useEffect(() => {
    return () => {
      const container = containerRef.current;
      if (container?.parentNode === document.body) {
        document.body.removeChild(container);
        containerRef.current = null;
      }
    };
  }, []);

  return ReactDOM.createPortal(children, containerRef.current);
}