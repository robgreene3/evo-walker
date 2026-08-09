import {
  DEFAULT_QUALITY_DIVERSITY_CONFIG,
  MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES,
  PRNG_IDENTITY,
  createQualityDiversityExperimentDocument,
  parseQualityDiversityExperimentJson,
  serializeQualityDiversityExperimentDocument,
  type QualityDiversityLineageRecord,
  type QualityDiversitySnapshot,
} from "@evowalker/core";
import type { EpisodeResult, FitnessComponents } from "@evowalker/sim";
import {
  WORKER_PROTOCOL_VERSION,
  type StartExplorationRequest,
  type WorkerResponse,
} from "@evowalker/worker/protocol";
import { useCallback, useEffect, useRef, useState } from "react";

import { ArchiveMap } from "./ArchiveMap.js";
import { ChampionScene } from "./ChampionScene.js";
import { FitnessChart } from "./FitnessChart.js";

type ExperimentStatus =
  | "initial"
  | "loading"
  | "running"
  | "pausing"
  | "paused"
  | "resuming"
  | "stopping"
  | "stopped"
  | "loaded"
  | "error";

interface EditableConfig {
  readonly seed: number;
  readonly initialPopulation: number;
  readonly archiveBins: number;
}

const INITIAL_CONFIG: EditableConfig = {
  seed: 42,
  initialPopulation: DEFAULT_QUALITY_DIVERSITY_CONFIG.initialPopulation,
  archiveBins: DEFAULT_QUALITY_DIVERSITY_CONFIG.archiveBins,
};
const LOCAL_STORAGE_KEY = "evowalker:experiment:v2";

const STATUS_TEXT: Readonly<Record<ExperimentStatus, string>> = {
  initial: "Ready to cultivate a deterministic gait archive.",
  loading: "Building the founder population in the physics worker…",
  running:
    "Exploration continues off the main thread until you pause or stop it.",
  pausing: "Pausing at the next complete creature evaluation…",
  paused: "Paused on a deterministic checkpoint boundary.",
  resuming: "Restoring the exact PRNG and archive state…",
  stopping: "Stopping after the current creature evaluation…",
  stopped: "Exploration stopped with a recoverable checkpoint retained.",
  loaded: "Validated archive loaded. Continue it or begin a new experiment.",
  error: "Exploration stopped because the worker reported an error.",
};

const JOINT_NAMES = [
  "Front-left hip",
  "Front-right hip",
  "Rear-left hip",
  "Rear-right hip",
  "Front-left knee",
  "Front-right knee",
  "Rear-left knee",
  "Rear-right knee",
] as const;

function localSaveExists(): boolean {
  try {
    return localStorage.getItem(LOCAL_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function formatNumber(value: number | null | undefined, digits = 3): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);
}

function ancestry(
  snapshot: QualityDiversitySnapshot | null,
): readonly QualityDiversityLineageRecord[] {
  if (snapshot?.champion === null || snapshot === null) return [];
  const records = new Map(
    snapshot.lineage.map((record) => [record.id, record]),
  );
  const pending = [snapshot.champion.lineageId];
  const result: QualityDiversityLineageRecord[] = [];
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
  const [snapshot, setSnapshot] = useState<QualityDiversitySnapshot | null>(
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
  const [discoveryMessage, setDiscoveryMessage] = useState("Awaiting founders");
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const statusRef = useRef<ExperimentStatus>("initial");
  const episodeRef = useRef<EpisodeResult | null>(null);
  const archiveSizeRef = useRef(0);

  const transition = useCallback((next: ExperimentStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const assignEpisode = useCallback((next: EpisodeResult | null) => {
    episodeRef.current = next;
    setEpisode(next);
  }, []);

  const receive = useCallback(
    ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.requestId !== requestIdRef.current) return;
      switch (data.kind) {
        case "exploration-progress": {
          const previousSize = archiveSizeRef.current;
          archiveSizeRef.current = data.snapshot.archive.length;
          setSnapshot(data.snapshot);
          if (
            data.championEpisode !== null &&
            (data.championChanged || episodeRef.current === null)
          ) {
            assignEpisode(data.championEpisode);
          }
          if (data.snapshot.archive.length > previousSize) {
            setDiscoveryMessage(
              `New gait niche discovered at evaluation ${String(data.snapshot.evaluations)}`,
            );
          } else if (data.championChanged) {
            setDiscoveryMessage(
              `New champion at evaluation ${String(data.snapshot.evaluations)}`,
            );
          }
          if (["loading", "resuming"].includes(statusRef.current)) {
            transition("running");
          }
          break;
        }
        case "exploration-paused":
          transition("paused");
          break;
        case "exploration-resumed":
          transition("running");
          break;
        case "exploration-stopped":
          setSnapshot(data.snapshot);
          if (data.championEpisode !== null)
            assignEpisode(data.championEpisode);
          transition("stopped");
          break;
        case "error":
          setErrorMessage(data.message);
          transition("error");
          break;
        case "evolution-progress":
        case "evolution-paused":
        case "evolution-resumed":
        case "evolution-completed":
        case "evolution-cancelled":
        case "progress":
        case "completed":
        case "cancelled":
          break;
      }
    },
    [assignEpisode, transition],
  );

  const createWorker = useCallback(() => {
    workerRef.current?.terminate();
    const worker = new Worker(
      new URL(
        "../../../packages/worker/src/browser-worker.ts",
        import.meta.url,
      ),
      { type: "module", name: "evowalker-exploration" },
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

  const start = (checkpoint?: QualityDiversitySnapshot) => {
    const worker = createWorker();
    const requestId = `exploration-${String(++requestSequence.current)}`;
    requestIdRef.current = requestId;
    if (checkpoint === undefined) {
      setSnapshot(null);
      archiveSizeRef.current = 0;
      assignEpisode(null);
      setDiscoveryMessage("Evaluating founder population");
    } else {
      setDiscoveryMessage(
        `Continuing from evaluation ${String(checkpoint.evaluations)}`,
      );
    }
    setErrorMessage(null);
    setPersistenceMessage(null);
    transition(checkpoint === undefined ? "loading" : "resuming");
    const base: StartExplorationRequest = {
      kind: "explore",
      protocolVersion: WORKER_PROTOCOL_VERSION,
      requestId,
      config: {
        seed: config.seed,
        ...DEFAULT_QUALITY_DIVERSITY_CONFIG,
        initialPopulation: config.initialPopulation,
        archiveBins: config.archiveBins,
      },
    };
    const request: StartExplorationRequest =
      checkpoint === undefined ? base : { ...base, checkpoint };
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

  const restoreDocument = (
    document: ReturnType<typeof parseQualityDiversityExperimentJson>,
  ) => {
    workerRef.current?.terminate();
    requestIdRef.current = null;
    setConfig({
      seed: document.snapshot.config.seed,
      initialPopulation: document.snapshot.config.initialPopulation,
      archiveBins: document.snapshot.config.archiveBins,
    });
    setSnapshot(document.snapshot);
    archiveSizeRef.current = document.snapshot.archive.length;
    assignEpisode(document.championEpisode);
    setErrorMessage(null);
    setDiscoveryMessage("Validated deterministic checkpoint");
    setPersistenceMessage(
      `Restored schema v${String(document.schemaVersion)} at evaluation ${String(document.snapshot.evaluations)}.`,
    );
    transition("loaded");
  };

  const currentDocument = () => {
    if (snapshot === null) {
      throw new Error("Run or load an experiment before saving it.");
    }
    return createQualityDiversityExperimentDocument(snapshot, episode);
  };

  const saveLocal = () => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        serializeQualityDiversityExperimentDocument(currentDocument()),
      );
      setHasLocalSave(true);
      setPersistenceMessage("Checkpoint saved locally in this browser.");
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
        throw new Error("No version-2 EvoWalker save was found.");
      restoreDocument(parseQualityDiversityExperimentJson(serialized));
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
      const serialized =
        serializeQualityDiversityExperimentDocument(currentDocument());
      const url = URL.createObjectURL(
        new Blob([serialized], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `evowalker-seed-${String(config.seed)}-evaluation-${String(snapshot?.evaluations ?? 0)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setPersistenceMessage("Exported a validated version-2 checkpoint.");
    } catch (error) {
      setPersistenceMessage(
        error instanceof Error ? error.message : "The JSON export failed.",
      );
    }
  };

  const importJson = async (file: File | null): Promise<void> => {
    if (file === null) return;
    try {
      if (file.size > MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES) {
        throw new Error(
          `Experiment exceeds the ${String(MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES)} byte limit.`,
        );
      }
      restoreDocument(parseQualityDiversityExperimentJson(await file.text()));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The JSON import failed.",
      );
      setPersistenceMessage(
        "The current experiment was kept. Choose a valid EvoWalker schema-v2 JSON file.",
      );
      transition("error");
    }
  };

  const activeWorker = [
    "loading",
    "running",
    "pausing",
    "paused",
    "resuming",
    "stopping",
  ].includes(status);
  const stateReplacementSafe = ![
    "loading",
    "running",
    "pausing",
    "resuming",
    "stopping",
    "paused",
  ].includes(status);
  const checkpointSafe =
    snapshot !== null && ["paused", "stopped", "loaded"].includes(status);
  const coverage = snapshot?.history.at(-1)?.archiveCoverage ?? 0;
  const champion = snapshot?.champion ?? null;
  const lineage = ancestry(snapshot);

  return (
    <div className="app-frame" data-status={status}>
      <header className="masthead">
        <a className="brand" href="#main-content" aria-label="EvoWalker home">
          <span className="brand-mark" aria-hidden="true">
            EW
          </span>
          <span>
            <strong>EvoWalker</strong>
            <small>Gait ecology</small>
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
            <p className="eyebrow">Continuous quality-diversity evolution</p>
            <h1 id="experiment-heading">Cultivate a gait ecology.</h1>
            <p className="hero-copy">
              Eight powered joints explore a living archive of stable
              locomotion. Fallen runners are rejected; every viable champion,
              niche, and parent remains inspectable and reproducible.
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
                disabled={activeWorker}
                onChange={(event) => {
                  setConfig({
                    ...config,
                    seed: event.currentTarget.valueAsNumber,
                  });
                }}
              />
            </label>
            <label>
              Founders
              <input
                type="number"
                min="4"
                max="256"
                value={config.initialPopulation}
                disabled={activeWorker}
                onChange={(event) => {
                  setConfig({
                    ...config,
                    initialPopulation: event.currentTarget.valueAsNumber,
                  });
                }}
              />
            </label>
            <label>
              Archive grid
              <input
                type="number"
                min="4"
                max="16"
                value={config.archiveBins}
                disabled={activeWorker}
                onChange={(event) => {
                  setConfig({
                    ...config,
                    archiveBins: event.currentTarget.valueAsNumber,
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
              onClick={() => {
                start();
              }}
              disabled={activeWorker}
            >
              {snapshot === null ? "Begin evolution" : "Start fresh"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (snapshot !== null) start(snapshot);
              }}
              disabled={activeWorker || snapshot === null}
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => {
                transition("pausing");
                postControl("pause");
              }}
              disabled={status !== "running"}
            >
              Pause
            </button>
            <button
              type="button"
              onClick={() => {
                transition("resuming");
                postControl("resume");
              }}
              disabled={status !== "paused"}
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => {
                transition("stopping");
                postControl("cancel");
              }}
              disabled={!activeWorker || status === "stopping"}
            >
              Stop
            </button>
          </div>
        </section>

        {errorMessage === null ? null : (
          <div className="error-banner" role="alert">
            <strong>Experiment error</strong>
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => {
                start();
              }}
            >
              Start fresh
            </button>
          </div>
        )}

        <section
          className="persistence-bar"
          aria-label="Save and restore experiment"
        >
          <div>
            <strong>Deterministic checkpoint</strong>
            <small role="status" aria-live="polite">
              {persistenceMessage ??
                "Schema v2 · archive and PRNG state · validated before replacement"}
            </small>
          </div>
          <div className="persistence-controls">
            <button
              type="button"
              onClick={saveLocal}
              disabled={!checkpointSafe}
            >
              Save local
            </button>
            <button
              type="button"
              onClick={loadLocal}
              disabled={!hasLocalSave || !stateReplacementSafe}
            >
              Load local
            </button>
            <button
              type="button"
              onClick={exportJson}
              disabled={!checkpointSafe}
            >
              Export JSON
            </button>
            <label
              className={`import-control${stateReplacementSafe ? "" : " disabled"}`}
            >
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                disabled={!stateReplacementSafe}
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
                <p className="eyebrow">Viable current best</p>
                <h2 id="champion-heading">Uninterrupted champion replay</h2>
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
              Drag to orbit · Scroll to zoom · Arrow keys rotate · new champions
              enter between loops
            </p>
          </section>

          <aside className="metrics-panel panel" aria-labelledby="run-heading">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Live ecology</p>
                <h2 id="run-heading">
                  {snapshot?.evaluations ?? 0} evaluations
                </h2>
              </div>
              <span className="seed-chip">seed {config.seed}</span>
            </div>
            <div className="discovery-strip" role="status" aria-live="polite">
              {discoveryMessage}
            </div>
            <div className="metric-cards">
              <div>
                <span>Best viable</span>
                <strong>{formatNumber(champion?.fitness)}</strong>
              </div>
              <div>
                <span>Gait niches</span>
                <strong>{snapshot?.archive.length ?? 0}</strong>
              </div>
              <div>
                <span>Coverage</span>
                <strong>{formatNumber(coverage * 100, 1)}%</strong>
              </div>
              <div>
                <span>Stability</span>
                <strong>{episode?.viable === true ? "full trial" : "—"}</strong>
              </div>
            </div>
            <FitnessChart history={snapshot?.history ?? []} />
            <ArchiveMap snapshot={snapshot} />
          </aside>
        </div>

        <div className="inspection-grid">
          <section
            className="panel inspection"
            aria-labelledby="fitness-heading"
          >
            <div className="panel-heading">
              <h2 id="fitness-heading">Fitness and gait</h2>
            </div>
            <p className="formula">
              progress + upright − fall − energy − lateral − invalid
            </p>
            <FitnessComponentsPanel components={episode?.components ?? null} />
            <div className="descriptor-row">
              <span>
                Ground contact{" "}
                <strong>{formatNumber(episode?.gait.dutyFactor, 3)}</strong>
              </span>
              <span>
                Diagonal rhythm{" "}
                <strong>
                  {formatNumber(episode?.gait.diagonalCoordination, 3)}
                </strong>
              </span>
            </div>
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
              <h2 id="genome-heading">Champion controller</h2>
            </div>
            {champion === null ? (
              <p className="empty-copy">
                No viable controller has entered the archive yet.
              </p>
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
                    {champion.genome.joints.map((joint, index) => (
                      <tr key={index}>
                        <th>{JOINT_NAMES[index]}</th>
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
              <span>{champion?.lineageId ?? "unassigned"}</span>
            </div>
            {lineage.length === 0 ? (
              <p className="empty-copy">
                Lineage appears after a viable founder enters the archive.
              </p>
            ) : (
              <ol className="lineage-list">
                {lineage.map((record) => (
                  <li key={record.id}>
                    <span>
                      <strong>{record.id}</strong>
                      <small>
                        seed {record.genomeSeed} · evaluation{" "}
                        {record.evaluation}
                      </small>
                    </span>
                    <span>
                      {record.origin === "offspring"
                        ? `${record.parentIds.length} parents`
                        : record.origin}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </main>
      <footer>
        <span>Fixed quadruped · deterministic Rapier · no telemetry</span>
        <span>Controller-first quality-diversity MVP</span>
      </footer>
    </div>
  );
}
