import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ActHeader } from '../components/ActHeader';
import { StageStepper, StageId } from '../components/finance/StageStepper';
import { MessStage } from '../components/finance/MessStage';
import { TrustStage } from '../components/finance/TrustStage';
import { DecideStage } from '../components/finance/DecideStage';
import { PredictStage } from '../components/finance/PredictStage';
import { AskStage } from '../components/finance/AskStage';
import { api } from '../lib/api';
import { IconRefresh } from '../icons';

const STAGE_COMPONENTS: Record<StageId, () => JSX.Element> = {
  mess: MessStage,
  trust: TrustStage,
  decide: DecideStage,
  predict: PredictStage,
  ask: AskStage,
};

export default function Act9Finance() {
  const [stage, setStage] = useState<StageId>('mess');
  const [resetting, setResetting] = useState(false);
  const [llmOk, setLlmOk] = useState<boolean | null>(null);
  const Stage = STAGE_COMPONENTS[stage];

  useEffect(() => {
    api.finLlmHealth().then((h) => setLlmOk(!!h.ok)).catch(() => setLlmOk(false));
  }, []);

  const reset = async () => {
    if (!confirm('Wipe + reseed the finance warehouse? This is the lecture panic button.')) return;
    setResetting(true);
    try {
      await api.finReseed();
      await api.finRunPipeline();
      // Force a refresh of the active stage by remounting it.
      const cur = stage;
      setStage('mess');
      setTimeout(() => setStage(cur), 0);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <ActHeader
        actNumber="09"
        eyebrow="CFO Finance Lab"
        title="MESS · TRUST · DECIDE · PREDICT · ASK"
        subtitle="One CFO storyline. Five stages. Watch messy expense feeds become a trustable warehouse, drive BI dashboards, surface anomalies, and finally answer plain-English questions over your own data using a local LLM."
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip chip-gold">SQLite · synthetic data</span>
          <span className={`chip ${llmOk ? 'chip-emerald' : llmOk === false ? 'chip-rose' : ''}`}>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                llmOk === null ? 'bg-zinc-400' : llmOk ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
              aria-hidden
            />
            {llmOk === null ? 'checking LLM…' : llmOk ? 'local LLM ready' : 'LLM offline'}
          </span>
          <button onClick={reset} disabled={resetting} className="btn btn-ghost text-xs ml-auto">
            <IconRefresh size={12} /> {resetting ? 'Resetting…' : 'Reset demo'}
          </button>
        </div>
      </ActHeader>

      <div className="mb-6">
        <StageStepper active={stage} onSelect={setStage} />
      </div>

      <motion.div
        key={stage}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        <Stage />
      </motion.div>
    </div>
  );
}
