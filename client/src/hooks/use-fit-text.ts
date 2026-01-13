import { useLayoutEffect, useRef, useState, useCallback } from "react";

interface UseFitTextOptions {
  maxFontSize?: number;
  minFontSize?: number;
}

export function useFitText({ maxFontSize = 30, minFontSize = 14 }: UseFitTextOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  const calculateFit = useCallback(() => {
    const container = containerRef.current;
    const text = textRef.current;
    
    if (!container || !text) return;

    const containerWidth = container.clientWidth;
    let currentSize = maxFontSize;

    text.style.fontSize = `${currentSize}px`;
    
    while (text.scrollWidth > containerWidth && currentSize > minFontSize) {
      currentSize -= 1;
      text.style.fontSize = `${currentSize}px`;
    }

    setFontSize(currentSize);
  }, [maxFontSize, minFontSize]);

  useLayoutEffect(() => {
    calculateFit();

    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      calculateFit();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateFit]);

  return { containerRef, textRef, fontSize };
}
