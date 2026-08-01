import {
  DEFAULT_GA_CONFIG,
  MAX_EXPERIMENT_BYTES,
  PRNG_IDENTITY,
  createExperimentDocument,
  parseExperimentJson,
  serializeExperimentDocument,
  type ControllerEvolutionSnapshot,
  type ControllerLineageRecord,
} from "@evowalker/core";
import type { EpisodeResult, FitnessComponents } from "@evowalker/sim";
import {
  WORKER_PROTOCOL_VERSION,
  type StartEvolutionRequest,
  type WorkerResponse,
} from "@evowalker/worker/protocol";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChampionScene } from "./ChampionScene.js";
import { FitnessChart } from "./FitnessChart.js";

type ExperimentStatus =
  | "initial"
  | "loading"
  | "running"
  | "pausing"
  | "paused"
  | "resuming"
  | "completed"
  | "loaded"
  | "cancelling"
  | "cancelled"
  | "error";

interface EditableConfig {
  readonly seed: number;
  readonly populationSize: number;
  readonly generations: number;
}

const INITIAL_CONFIG: EditableConfig = {
  seed: 42,
  populationSize: DEFAULT_GA_CONFIG.populationSize,
  generations: DEFAULT_GA_CONFIG.generations,
};
const LOCAL_STORAGE_KEY = "evowalker:experiment:v1";

function localSaveExists(): boolean {
  try {
    return localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

const STATUS_TEXT: Readonly<Record<ExperimentStatus, string>> = {
  initial: "Ready for a deterministic experiment.",
  loading: "Loading the physics worker…",
  running: "Evolution is running off the main thread.",
  pausing: "Pausing at the next generation boundary…",
  paused: "Paused at a complete generation boundary.",
  resuming: "Resuming evolution…",
  completed: "Experiment complete. Champion ready for inspection.",
  loaded: "Saved experiment loaded for inspection or a deterministic restart.",
  cancelling: "Cancelling at the next generation boundary…",
  cancelled:
    "Experiment cancelled with the latest complete generation retained.",
  error: "Experiment stopped because the worker reported an error.",
};

function formatNumber(value: number | undefined, digits = 3): string {
  return value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);
}

function ancestry(
  snapshot: ControllerEvolutionSnapshot | null,
): readonly ControllerLineageRecord[] {
  if (snapshot === null) return [];
  const records = new Map(
    snapshot.lineage.map((record) => [record.id, record]),
  );
  const pending = [snapshot.champion.lineageId];
  const result: ControllerLineageRecord[] = [];
  const visited = new Set<string>();
  while (pending.length > 0 && result.length < 18) {
    const id = pending.shift();
    if (id === undefined || visited.has(id)) continue;
    visited.add(id);
    const record = records.get(id);
    if (record === undefined) continue;
    result.push(record);
    pending.push(...record.parentIds);
  }
  return result;
}

function FitnessComponentsPanel({
  components,
}: {
  readonly components: FitnessComponents | null;
}) {
  const rows: readonly [string, number | undefined, "positive" | "penalty"][] =
    [
      ["Forward progress", components?.forwardProgress, "positive"],
      ["Upright bonus", components?.uprightBonus, "positive"],
      ["Fall penalty", components?.fallPenalty, "penalty"],
      ["Energy penalty", components?.actuationEnergyPenalty, "penalty"],
      ["Lateral penalty", components?.lateralDriftPenalty, "penalty"],
      ["Invalid penalty", components?.invalidPenalty, "penalty"],
    ];
  return (
    <dl className="component-list">
      {rows.map(([label, value, kind]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={kind}>{formatNumber(value, 4)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function App() {
  const [config, setConfig] = useState<EditableConfig>(INITIAL_CONFIG);
  const [status, setStatus] = useState<ExperimentStatus>("initial");
  const [snapshot, setSnapshot] = useState<ControllerEvolutionSnapshot | null>(
    null,
  );
  const [episode, setEpisode] = useState<EpisodeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [replayToken, setReplayToken] = useState(0);
  const [hasLocalSave, setHasLocalSave] = useState(localSaveExists);
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(
    null,
  );
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const statusRef = useRef<ExperimentStatus>("initial");

  const transition = useCallback((next: ExperimentStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const receive = useCallback(
    ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.requestId !== requestIdRef.current) return;
      switch (data.kind) {
        case "evolution-progress":
          setSnapshot(data.snapshot);
          setEpisode(data.championEpisode);
          if (["loading", "resuming"].includes(statusRef.current)) {
            transition("running");
          }
          break;
        case "evolution-paused":
          transition("paused");
          break;
        case "evolution-resumed":
          transition("running");
          break;
        case "evolution-completed":
          setSnapshot(data.snapshot);
          setEpisode(data.championEpisode);
          transition("completed");
          break;
        case "evolution-cancelled":
          setSnapshot(data.snapshot);
          setEpisode(data.championEpisode);
          transition("cancelled");
          break;
        case "error":
          setErrorMessage(data.message);
          transition("error");
          break;
        case "progress":
        case "completed":
        case "cancelled":
          break;
      }
    },
    [transition],
  );

  const createWorker = useCallback(() => {
    workerRef.current?.terminate();
    const worker = new Worker(
      new URL(
        "../../../packages/worker/src/browser-worker.ts",
        import.meta.url,
      ),
      { type: "module", name: "evowalker-evolution" },
    );
    worker.addEventListener("message", receive);
    worker.addEventListener("error", (event) => {
      setErrorMessage(event.message || "The browser worker failed to start.");
      transition("error");
    });
    workerRef.current = worker;
    return worker;
  }, [receive, transition]);

  useEffect(() => {
    createWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [createWorker]);

  const start = () => {
    const worker = createWorker();
    const requestId = `evolution-${String(++requestSequence.current)}`;
    requestIdRef.current = requestId;
    setSnapshot(null);
    setEpisode(null);
    setErrorMessage(null);
    transition("loading");
    const request: StartEvolutionRequest = {
      kind: "evolve",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId,
      config: {
        seed: config.seed,
        ...DEFAULT_GA_CONFIG,
        populationSize: config.populationSize,
        generations: config.generations,
        eliteCount: Math.min(
          DEFAULT_GA_CONFIG.eliteCount,
          config.populationSize - 1,
        ),
        tournamentSize: Math.min(
          DEFAULT_GA_CONFIG.tournamentSize,
          config.populationSize,
        ),
      },
    };
    worker.postMessage(request);
  };

  const postControl = (kind: "pause" | "resume" | "cancel") => {
    const requestId = requestIdRef.current;
    if (requestId === null) return;
    workerRef.current?.postMessage({
      kind,
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId,
    });
  };

  const pause = () => {
    transition("pausing");
    postControl("pause");
  };
  const resume = () => {
    transition("resuming");
    postControl("resume");
  };
  const cancel = () => {
    transition("cancelling");
    postControl("cancel");
  };

  const restoreDocument = (
    document: ReturnType<typeof parseExperimentJson>,
  ) => {
    requestIdRef.current = null;
    setConfig({
      seed: document.snapshot.config.seed,
      populationSize: document.snapshot.config.populationSize,
      generations: document.snapshot.config.generations,
    });
    setSnapshot(document.snapshot);
    setEpisode(document.championEpisode);
    setErrorMessage(null);
    setPersistenceMessage(
      `Restored schema v${String(document.schemaVersion)} at generation ${String(document.snapshot.generation)}.`,
    );
    transition(document.snapshot.complete ? "completed" : "loaded");
  };

  const currentDocument = () => {
    if (snapshot === null || episode === null) {
      throw new Error("Run or load an experiment before saving it.");
    }
    return createExperimentDocument(snapshot, episode);
  };

  const saveLocal = () => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        serializeExperimentDocument(currentDocument()),
      );
      setHasLocalSave(true);
      setPersistenceMessage("Saved locally in this browser.");
    } catch (error) {
      setPersistenceMessage(
        error instanceof Error ? error.message : "The local save failed.",
      );
    }
  };

  const loadLocal = () => {
    try {
      const serialized = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (serialized === null)
        throw new Error("No local EvoWalker save was found.");
      restoreDocument(parseExperimentJson(serialized));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The local save could not be loaded.",
      );
      transition("error");
    }
  };

  const exportJson = () => {
    try {
      const serialized = serializeExperimentDocument(currentDocument());
      const url = URL.createObjectURL(
        new Blob([serialized], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `evowalker-seed-${String(config.seed)}-generation-${String(snapshot?.generation ?? 0)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setPersistenceMessage("Exported a validated JSON experiment.");
    } catch (error) {
      setPersistenceMessage(
        error instanceof Error ? error.message : "The JSON export failed.",
      );
    }
  };

  const importJson = async (file: File | null): Promise<void> => {
    if (file === null) return;
    try {
      if (file.size > MAX_EXPERIMENT_BYTES) {
        throw new Error(
          `Experiment exceeds the ${String(MAX_EXPERIMENT_BYTES)} byte limit.`,
        );
      }
      restoreDocument(parseExperimentJson(await file.text()));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The JSON import failed.",
      );
      setPersistenceMessage(
        "The current experiment was kept. Choose a valid version-1 EvoWalker JSON file or restart.",
      );
      transition("error");
    }
  };

  const active = [
    "loading",
    "running",
    "pausing",
    "paused",
    "resuming",
    "cancelling",
  ].includes(status);
  const replaceable = ![
    "loading",
    "running",
    "pausing",
    "resuming",
    "cancelling",
  ].includes(status);
  const summary = snapshot?.history.at(-1);
  const lineage = ancestry(snapshot);
  const generation = snapshot?.generation ?? 0;

  return (
    <div className="app-frame" data-status={status}>
      <header className="masthead">
        <a className="brand" href="#main-content" aria-label="EvoWalker home">
          <span className="brand-mark" aria-hidden="true">
            EW
          </span>
          <span>
            <strong>EvoWalker</strong>
            <small>Controller laboratory</small>
          </span>
        </a>
        <div className="provenance">
          <span>Local only</span>
          <span>{PRNG_IDENTITY}</span>
          <span>Protocol v{WORKER_PROTOCOL_VERSION}</span>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" aria-labelledby="experiment-heading">
          <div>
            <p className="eyebrow">Deterministic evolutionary locomotion</p>
            <h1 id="experiment-heading">Shape a gait, not a creature.</h1>
            <p className="hero-copy">
              Evolve sixteen periodic controller genes against one fixed
              articulated biped. Every score, parent, and replay stays
              inspectable.
            </p>
          </div>
          <div
            className="experiment-controls"
            aria-label="Experiment configuration"
          >
            <label>
              Seed
              <input
                type="number"
                value={config.seed}
                disabled={active}
                onChange={(event) => {
                  setConfig({
                    ...config,
                    seed: event.currentTarget.valueAsNumber,
                  });
                }}
              />
            </label>
            <label>
              Population
              <input
                type="number"
                min="4"
                max="64"
                value={config.populationSize}
                disabled={active}
                onChange={(event) => {
                  setConfig({
                    ...config,
                    populationSize: event.currentTarget.valueAsNumber,
                  });
                }}
              />
            </label>
            <label>
              Generations
              <input
                type="number"
                min="1"
                max="100"
                value={config.generations}
                disabled={active}
                onChange={(event) => {
                  setConfig({
                    ...config,
                    generations: event.currentTarget.valueAsNumber,
                  });
                }}
              />
            </label>
          </div>
        </section>

        <section className="status-bar" aria-label="Experiment controls">
          <div className="status-copy" role="status" aria-live="polite">
            <span
              className={`status-dot status-${status}`}
              aria-hidden="true"
            />
            <span>
              <strong>{status}</strong>
              <small>{STATUS_TEXT[status]}</small>
            </span>
          </div>
          <div className="control-row">
            <button
              className="primary"
              type="button"
              onClick={start}
              disabled={active}
            >
              {snapshot === null ? "Start experiment" : "Restart"}
            </button>
            <button
              type="button"
              onClick={pause}
              disabled={status !== "running"}
            >
              Pause
            </button>
            <button
              type="button"
              onClick={resume}
              disabled={status !== "paused"}
            >
              Resume
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={!active || status === "cancelling"}
            >
              Cancel
            </button>
          </div>
        </section>

        {errorMessage === null ? null : (
          <div className="error-banner" role="alert">
            <strong>Experiment error</strong>
            <span>{errorMessage}</span>
            <button type="button" onClick={start}>
              Start a fresh experiment
            </button>
          </div>
        )}

        <section
          className="persistence-bar"
          aria-label="Save and restore experiment"
        >
          <div>
            <strong>Experiment file</strong>
            <small role="status" aria-live="polite">
              {persistenceMessage ??
                "Versioned JSON · validated before state replacement"}
            </small>
          </div>
          <div className="persistence-controls">
            <button
              type="button"
              onClick={saveLocal}
              disabled={snapshot === null || !replaceable}
            >
              Save local
            </button>
            <button
              type="button"
              onClick={loadLocal}
              disabled={!hasLocalSave || !replaceable}
            >
              Load local
            </button>
            <button
              type="button"
              onClick={exportJson}
              disabled={snapshot === null || !replaceable}
            >
              Export JSON
            </button>
            <label
              className={`import-control${replaceable ? "" : " disabled"}`}
            >
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                disabled={!replaceable}
                onChange={(event) => {
                  void importJson(event.currentTarget.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </section>

        <div className="workspace-grid">
          <section
            className="viewer-panel panel"
            aria-labelledby="champion-heading"
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Current best</p>
                <h2 id="champion-heading">Champion replay</h2>
              </div>
              <div className="replay-controls">
                <label>
                  Speed
                  <select
                    value={playbackSpeed}
                    onChange={(event) => {
                      setPlaybackSpeed(Number(event.currentTarget.value));
                    }}
                  >
                    <option value="0.5">0.5×</option>
                    <option value="1">1×</option>
                    <option value="2.5">2.5×</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={episode === null}
                  onClick={() => {
                    setReplayToken((token) => token + 1);
                  }}
                >
                  Replay
                </button>
              </div>
            </div>
            <ChampionScene
              episode={episode}
              playbackSpeed={playbackSpeed}
              replayToken={replayToken}
            />
            <p className="scene-help">
              Drag to orbit · Scroll to zoom · Arrow keys rotate
            </p>
          </section>

          <aside className="metrics-panel panel" aria-labelledby="run-heading">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Live telemetry</p>
                <h2 id="run-heading">Generation {generation}</h2>
              </div>
              <span className="seed-chip">seed {config.seed}</span>
            </div>
            <label className="progress-label">
              <span>Evolution progress</span>
              <strong>
                {generation} / {config.generations}
              </strong>
              <progress value={generation} max={config.generations} />
            </label>
            <div className="metric-cards">
              <div>
                <span>Best</span>
                <strong>{formatNumber(summary?.bestFitness)}</strong>
              </div>
              <div>
                <span>Median</span>
                <strong>{formatNumber(summary?.medianFitness)}</strong>
              </div>
              <div>
                <span>Diversity</span>
                <strong>{formatNumber(summary?.meanGenotypeDistance)}</strong>
              </div>
              <div>
                <span>Duplicates</span>
                <strong>
                  {formatNumber(
                    summary === undefined
                      ? undefined
                      : summary.duplicateRate * 100,
                    1,
                  )}
                  %
                </strong>
              </div>
            </div>
            <FitnessChart history={snapshot?.history ?? []} />
          </aside>
        </div>

        <div className="inspection-grid">
          <section
            className="panel inspection"
            aria-labelledby="fitness-heading"
          >
            <div className="panel-heading">
              <h2 id="fitness-heading">Fitness components</h2>
            </div>
            <p className="formula">
              progress + upright − fall − energy − lateral − invalid
            </p>
            <FitnessComponentsPanel components={episode?.components ?? null} />
            <div className="aggregate">
              <span>Aggregate fitness</span>
              <strong>{formatNumber(episode?.aggregateFitness, 5)}</strong>
            </div>
          </section>

          <section
            className="panel inspection"
            aria-labelledby="genome-heading"
          >
            <div className="panel-heading">
              <h2 id="genome-heading">Champion genome</h2>
            </div>
            {snapshot === null ? (
              <p className="empty-copy">No champion genome is available yet.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Joint</th>
                      <th>Amp</th>
                      <th>Hz</th>
                      <th>Phase</th>
                      <th>Offset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.champion.genome.joints.map((joint, index) => (
                      <tr key={index}>
                        <th>{["L hip", "R hip", "L knee", "R knee"][index]}</th>
                        <td>{formatNumber(joint.amplitude)}</td>
                        <td>{formatNumber(joint.frequencyHz)}</td>
                        <td>{formatNumber(joint.phaseRadians)}</td>
                        <td>{formatNumber(joint.offset)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section
            className="panel inspection lineage-panel"
            aria-labelledby="lineage-heading"
          >
            <div className="panel-heading">
              <h2 id="lineage-heading">Champion ancestry</h2>
              <span>{snapshot?.champion.lineageId ?? "unassigned"}</span>
            </div>
            {lineage.length === 0 ? (
              <p className="empty-copy">
                Lineage appears after generation zero is evaluated.
              </p>
            ) : (
              <ol className="lineage-list">
                {lineage.map((record) => (
                  <li key={record.id}>
                    <span>
                      <strong>{record.id}</strong>
                      <small>genome seed {record.genomeSeed}</small>
                    </span>
                    <span>
                      {record.eliteCarryover
                        ? "elite"
                        : record.parentIds.length === 0
                          ? "founder"
                          : `${record.parentIds.length} parents`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </main>
      <footer>
        <span>Fixed morphology · deterministic Rapier · no telemetry</span>
        <span>Controller-first MVP</span>
      </footer>
    </div>
  );
}
