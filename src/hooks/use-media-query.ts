'use client';

// ============================================================
// 响应式断点 Hook (基于 window.matchMedia)
// ============================================================
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** 是否为移动端 (< md, 即 < 768px) */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/** 是否为平板 (< lg, 即 < 1024px) */
export function useIsTablet(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
