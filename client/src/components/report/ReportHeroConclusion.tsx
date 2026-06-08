export function ReportHeroConclusion(props: any) {
  const item = props.item || props;

  return (
    <section>
      <h2>{item.title || 'Opportunity validation report'}</h2>
      <p>{item.summary || 'This report summarizes the current opportunity, evidence, risk, and next validation action.'}</p>
    </section>
  );
}
