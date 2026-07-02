import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional content to keep fixed at the top of the sheet. */
  header?: React.ReactNode;
  /** Array of heights for different snap states, e.g. [140, '75vh']. 
   *  Indices correspond to snap positions. */
  snapPoints?: (number | string)[];
  /** The current snap point index. */
  snapIndex?: number;
  /** Triggered when the user snaps to a new position. */
  onSnapIndexChange?: (index: number) => void;
  /** Height of the sheet as a CSS value, e.g. '70vh'. Defaults to '75vh' if snapPoints not used. */
  height?: string;
  /** If true, a dark backdrop is shown and clicking it calls onClose. */
  withBackdrop?: boolean;
}

/**
 * A slide-up bottom sheet for mobile. It supports multiple snap points (peek vs expanded)
 * and animates smoothly using CSS transitions.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  header,
  snapPoints,
  snapIndex: externalSnapIndex,
  onSnapIndexChange,
  height = '75vh',
  withBackdrop = true,
}) => {
  const [internalSnapIndex, setInternalSnapIndex] = useState(0);
  const snapIndex = externalSnapIndex !== undefined ? externalSnapIndex : internalSnapIndex;
  
  // Reset snap index when props change, but allow external control
  useEffect(() => {
    if (externalSnapIndex === undefined && !isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets uncontrolled snap state when the sheet closes
      setInternalSnapIndex(0);
    }
  }, [isOpen, externalSnapIndex]);

  const setSnapIndex = (idx: number) => {
    setInternalSnapIndex(idx);
    onSnapIndexChange?.(idx);
  };

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const currentSnapYRef = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

  // Snapshot height when the sheet opens. Do NOT listen for resize while open —
  // keyboard appearing fires resize and would reposition the sheet mid-interaction.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- snapshots the viewport size at open time, ignored while open
    if (isOpen) setViewportHeight(window.innerHeight);
  }, [isOpen]);

  // Convert snapPoints to pixel values relative to viewport height
  const getSnapY = useCallback((point: number | string) => {
    if (typeof point === 'number') return viewportHeight - point;
    if (point.endsWith('vh')) {
      const vh = parseFloat(point);
      return viewportHeight - (vh * viewportHeight) / 100;
    }
    return 0;
  }, [viewportHeight]);

  const resolvedSnapPoints = useMemo(() => {
    if (!snapPoints) return [getSnapY(isOpen ? height : 0)];
    return snapPoints.map(getSnapY);
  }, [snapPoints, height, isOpen, getSnapY]);

  const currentSnapTargetY = resolvedSnapPoints[snapIndex] ?? 0;

  // Reset drag position when sheet opens/closes via props
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets drag/snap state so the next open starts fresh
      setDragY(0);
      setInternalSnapIndex(0);
    }
  }, [isOpen]);

  // Lock body scroll ONLY when expanded (last snap point)
  useEffect(() => {
    const isExpanded = isOpen && (snapPoints ? snapIndex === snapPoints.length - 1 : true);
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, snapIndex, snapPoints]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    currentSnapYRef.current = currentSnapTargetY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - startYRef.current;
    setDragY(delta);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    const finalY = currentSnapTargetY + dragY;
    
    const lowestSnapY = Math.max(...resolvedSnapPoints);
    if (finalY > lowestSnapY + 100 || (snapPoints?.length === 1 && finalY > resolvedSnapPoints[0] + 50)) {
      onClose();
      setDragY(0);
      return;
    }

    // Find the closest snap point
    let closestIndex = 0;
    let minDistance = Math.abs(finalY - resolvedSnapPoints[0]);

    resolvedSnapPoints.forEach((pY, idx) => {
      const dist = Math.abs(finalY - pY);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    setSnapIndex(closestIndex);
    setDragY(0);
  };


  const currentHeight = snapPoints 
    ? (typeof snapPoints[snapPoints.length - 1] === 'number' 
        ? `${snapPoints[snapPoints.length - 1]}px` 
        : (snapPoints[snapPoints.length - 1] as string))
    : height;

  const currentTranslateY = isOpen
    ? currentSnapTargetY + dragY
    : viewportHeight;

  return (
    <>
      {withBackdrop && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 190,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            opacity: (isOpen && snapIndex === (snapPoints?.length ?? 1) - 1) 
              ? (isDragging ? Math.max(0, 1 - dragY / 400) : 1) 
              : 0,
            pointerEvents: (isOpen && snapIndex === (snapPoints?.length ?? 1) - 1) ? 'auto' : 'none',
            transition: isDragging ? 'none' : 'opacity 300ms ease',
          }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          height: `calc(${currentHeight} + env(safe-area-inset-bottom))`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgb(18 18 18 / 0.98)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
          transform: `translate3d(0, ${currentTranslateY}px, 0)`,
          transition: isDragging 
            ? 'none' 
            : 'transform 600ms cubic-bezier(0.19, 1, 0.22, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          // Important: only capture pointer events if it's open, 
          // and let them pass through to the globe otherwise.
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {(snapPoints?.length ?? 1) > 1 && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => {
              if (!isDragging && snapPoints && snapIndex < snapPoints.length - 1) {
                const nextIndex = snapIndex + 1;
                setSnapIndex(nextIndex);
              }
            }}
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'none',
              zIndex: 10,
            }}
          >
            <div
              style={{
                padding: '12px 0 8px',
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 5,
                  borderRadius: 99,
                  background: 'rgba(255,255,255,0.25)',
                }}
              />
            </div>

            {header && (
              <div style={{ flexShrink: 0 }}>
                {header}
              </div>
            )}
          </div>
        )}
        
        {(snapPoints?.length ?? 1) <= 1 && header && (
          <div style={{ flexShrink: 0, padding: '12px' }}>
            {header}
          </div>
        )}


        <div 
          style={{ 
            flex: 1, 
            overflowY: snapIndex === (snapPoints?.length ?? 1) - 1 ? 'auto' : 'hidden', 
            overflowX: 'hidden',
            touchAction: snapIndex === (snapPoints?.length ?? 1) - 1 ? 'pan-y' : 'none',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'calc(40px + env(safe-area-inset-bottom))',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

