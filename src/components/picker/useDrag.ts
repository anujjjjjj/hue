import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Shared pointer-drag handling for the picker controls. Works with mouse,
 * touch and pen via Pointer Events; pointer capture keeps the drag alive
 * even when the pointer leaves the element.
 */
export function useDrag(
  onMove: (e: PointerEvent | ReactPointerEvent, el: HTMLElement) => void,
) {
  const dragging = useRef(false);

  const handleDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      dragging.current = true;
      onMove(e, el);
    },
    [onMove],
  );

  const handleMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!dragging.current) return;
      onMove(e, e.currentTarget);
    },
    [onMove],
  );

  const handleUp = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return {
    onPointerDown: handleDown,
    onPointerMove: handleMove,
    onPointerUp: handleUp,
    onPointerCancel: handleUp,
    style: { touchAction: 'none' as const },
  };
}
