export function ReportExecutionCards(props: any) {
  const item = props.item || props;
  const notes = Array.isArray(item.marketEntryNotes)
    ? item.marketEntryNotes
    : ['Run a small validation sprint before committing more resources.'];

  return (
    <section>
      <h2>Execution cards</h2>
      {notes.slice(0, 4).map((note: string) => (
        <p key={note}>{note}</p>
      ))}
    </section>
  );
}
