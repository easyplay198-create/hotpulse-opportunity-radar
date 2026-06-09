import styles from './ProgressStepper.module.css';

type StepItem = {
  id: string;
  label: string;
  status: 'done' | 'active' | 'pending';
  description?: string;
};

type Props = {
  steps: StepItem[];
};

export function ProgressStepper({ steps }: Props) {
  return (
    <section className={styles.root} aria-label="进度步骤">
      <div className={styles.header}>
        <h3 className={styles.title}>Progress Stepper</h3>
        <span className={styles.subtitle}>{steps.length} 步</span>
      </div>

      {steps.length > 0 ? (
        <div className={styles.steps}>
          {steps.map((step) => (
            <article key={step.id} className={`${styles.step} ${styles[step.status]}`}>
              <span className={styles.dot} aria-hidden="true" />
              <div className={styles.body}>
                <div className={styles.rowTop}>
                  <span className={styles.label}>{step.label}</span>
                  <span className={styles.state}>{step.status}</span>
                </div>
                {step.description ? <div className={styles.description}>{step.description}</div> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.body}>
          <span className={styles.description}>暂无步骤。</span>
        </div>
      )}
    </section>
  );
}
