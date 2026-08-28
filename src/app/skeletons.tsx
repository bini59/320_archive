export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} />;
}

export function HomeSkeleton() {
  return <main aria-busy="true" aria-label="사이트 등록" className="page"><p className="sr-only" role="status">사이트 등록을 불러오는 중입니다.</p><div className="page-head"><div><SkeletonBlock className="skeleton-heading" /><SkeletonBlock className="skeleton-text" /></div><SkeletonBlock className="skeleton-button" /></div><div className="card archive-form"><div className="card-head"><SkeletonBlock className="skeleton-label" /></div><div className="card-body skeleton-form"><SkeletonBlock className="skeleton-input" /><SkeletonBlock className="skeleton-input skeleton-input-short" /><SkeletonBlock className="skeleton-button" /></div></div></main>;
}

export function ArchivesSkeleton() {
  return <main aria-busy="true" aria-label="공개 아카이브" className="page"><p className="sr-only" role="status">공개 아카이브를 불러오는 중입니다.</p><div className="page-head"><div><SkeletonBlock className="skeleton-heading" /><SkeletonBlock className="skeleton-text" /></div><SkeletonBlock className="skeleton-button" /></div><div className="toolbar"><SkeletonBlock className="skeleton-input" /><SkeletonBlock className="skeleton-button" /></div><div className="card"><div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <article className="card card-body" key={index}><SkeletonBlock className="skeleton-label" /><SkeletonBlock className="skeleton-card-title" /><SkeletonBlock className="skeleton-url" /><SkeletonBlock className="skeleton-text skeleton-text-short" /></article>)}</div></div></main>;
}

export function LibrarySkeleton() {
  return <main aria-busy="true" aria-label="내 보관함" className="page"><p className="sr-only" role="status">내 보관함을 불러오는 중입니다.</p><div className="page-head"><div><SkeletonBlock className="skeleton-heading" /><SkeletonBlock className="skeleton-text" /></div></div><div className="card"><div className="card-head"><SkeletonBlock className="skeleton-label" /></div><div className="card-body skeleton-form"><SkeletonBlock className="skeleton-input" /><SkeletonBlock className="skeleton-button" /></div></div><section className="folder-section"><div className="section-heading"><SkeletonBlock className="skeleton-label" /></div><div className="folder-grid">{Array.from({ length: 6 }, (_, index) => <div className="folder-card" key={index}><SkeletonBlock className="skeleton-icon" /><SkeletonBlock className="skeleton-folder-name" /></div>)}</div></section></main>;
}

export function ArchiveDetailSkeleton() {
  return <main aria-busy="true" aria-label="아카이브 상세" className="page"><p className="sr-only" role="status">아카이브 상세를 불러오는 중입니다.</p><div className="page-head"><div><SkeletonBlock className="skeleton-heading" /><SkeletonBlock className="skeleton-text" /></div><SkeletonBlock className="skeleton-button" /></div><div className="detail-layout"><div className="card skeleton-viewer"><div className="card-head"><SkeletonBlock className="skeleton-tab" /><SkeletonBlock className="skeleton-tab" /></div><SkeletonBlock className="skeleton-frame" /></div><aside className="card detail-side"><div className="detail-section"><SkeletonBlock className="skeleton-label" /><SkeletonBlock className="skeleton-badge" /></div><div className="detail-section"><SkeletonBlock className="skeleton-label" /><SkeletonBlock className="skeleton-url" /></div><div className="detail-section"><SkeletonBlock className="skeleton-label" /><SkeletonBlock className="skeleton-text" /><SkeletonBlock className="skeleton-text skeleton-text-short" /></div></aside></div></main>;
}
