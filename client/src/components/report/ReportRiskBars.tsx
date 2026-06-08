export function ReportRiskBars(props: any) {
  const item = props.item || props;
  const risks = [
    ['Payment', item.paymentRisk],
    ['Localization', item.localizationRisk],
    ['Compliance', item.complianceRisk],
    ['Acquisition', item.acquisitionRisk],
    ['Competition', item.competitionRisk],
  ];

  return (
    <section>
      <h2>Risk bars</h2>
      {risks.map(([label, value]) => (
        <p key={String(label)}>{label}: {String(value ?? 'Pending')}</p>
      ))}
    </section>
  );
}
