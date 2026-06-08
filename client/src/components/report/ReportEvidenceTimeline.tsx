export function ReportEvidenceTimeline(props: any) {
  const item = props.item || props;
  const evidence = Array.isArray(item.evidence) ? item.evidence : [];

  return (
    <section>
      <h2>Evidence timeline</h2>
      {evidence.length === 0 ? <p>No evidence available yet.</p> : null}
      {evidence.slice(0, 5).map((entry: any, index: number) => (
        <p key={entry.url || entry.title || index}>{entry.title || entry.source || 'Evidence item'}</p>
      ))}
    </section>
  );
}
