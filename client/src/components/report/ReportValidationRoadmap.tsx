export function ReportValidationRoadmap(props: any) {
  const item = props.item || props;
  const steps = Array.isArray(item.entryFocus)
    ? item.entryFocus
    : ['Define target segment', 'Collect evidence', 'Run a 7-day validation test'];

  return (
    <section>
      <h2>Validation roadmap</h2>
      {steps.slice(0, 5).map((step: string, index: number) => (
        <p key={`${index}-${step}`}>Day {index + 1}: {step}</p>
      ))}
    </section>
  );
}
