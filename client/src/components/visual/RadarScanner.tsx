import './VisualPrimitives.css';

const SIGNALS = ['HN', 'App Store', 'GitHub', 'Product Hunt', 'Local Seed'] as const;

export function RadarScanner({ source = 'mock', opportunityCount = 0 }: { source?: 'real' | 'mock' | 'fallback'; opportunityCount?: number }) {
  return (
    <section className="radarScanner" aria-label="市场雷达扫描">
      <div className="radarScanner__shell">
        <div className="radarScanner__ring">
          <div className="radarScanner__grid" />
          <div className="radarScanner__sweep" />
          <div className="radarScanner__glow" />
          <div className="radarScanner__center">
            <strong>{opportunityCount}</strong>
            <span>opportunities</span>
          </div>
          <div className="radarScanner__points">
            {SIGNALS.map((item, index) => (
              <span key={item} className={`radarScanner__point radarScanner__point--${index + 1}`}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="radarScanner__footer">
        <span className="radarScanner__badge">{source}</span>
        <span className="radarScanner__meta">Signal Radar Active</span>
        <p className="radarScanner__note">示例结构，不代表真实市场结论。</p>
      </div>
    </section>
  );
}
