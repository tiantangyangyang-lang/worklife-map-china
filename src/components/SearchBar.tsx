'use client';

// ============================================================
// 顶部搜索栏
// ============================================================
import { Search, X } from 'lucide-react';
import { useMapStore } from '@/store/useMapStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SearchBar() {
  const keyword = useMapStore(s => s.filter.keyword);
  const setFilter = useMapStore(s => s.setFilter);

  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <Input
        type="text"
        placeholder="搜索公司名 / 城市 / 规则关键词..."
        value={keyword}
        onChange={e => setFilter({ keyword: e.target.value })}
        className="pl-9 pr-9 bg-white/80 backdrop-blur-sm border-slate-200 focus-visible:ring-emerald-500"
      />
      {keyword && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setFilter({ keyword: '' })}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-slate-100"
          aria-label="清除搜索"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
