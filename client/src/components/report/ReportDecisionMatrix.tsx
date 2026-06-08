export function ReportDecisionMatrix(props: any) {
  const item = props.item || props;

  return (
    <section>
      <h2>Decision matrix</h2>
      <p>Verdict: {item.verdict || 'watch'}</p>
      <p>Target market: {item.targetMarket || 'Pending'}</p>
    </section>
  );
}
