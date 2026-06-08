export function ReportScoreSummary(props: any) {
  const item = props.item || props;
  const score = item.valueScore ?? item.score ?? 0;

  return (
    <section>
      <h2>Score summary</h2>
      <strong>{score}</strong>
    </section>
  );
}
