import {
  DEFAULT_QUALITY_DIVERSITY_CONFIG,
  EPISODE_DURATION_OPTIONS,
  TERRAIN_GENERATOR_VERSION,
  TERRAIN_KINDS,
  MAX_QUALITY_DIVERSITY_EXPERIMENT_BYTES,
  PRNG_IDENTITY,
  createQualityDiversityExperimentDocument,
  parseQualityDiversityExperimentJson,
  serializeQualityDiversityExperimentDocument,
  type QualityDiversityArchiveEntry,
  type QualityDiversityLineageRecord,
  type QualityDiversitySnapshot,
  type EpisodeDurationSeconds,
  type TerrainConfig,
  type TerrainKind,
} from "@evowalker/core";
import type { EpisodeResult, FitnessComponents } from "@evowalker/sim";
import {
  WORKER_PROTOCOL_VERSION,
  type ReplayEpisodeRequest,
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
  readonly episodeDurationSeconds: EpisodeDurationSeconds;
  readonly terrainKind: TerrainKind;
  readonly terrainSeed: number;
}

const INITIAL_CONFIG: EditableConfig = {
  seed: 42,
  initialPopulation: DEFAULT_QUALITY_DIVERSITY_CONFIG.initialPopulation,
  archiveBins: DEFAULT_QUALITY_DIVERSITY_CONFIG.archiveBins,
  episodeDurationSeconds:
    DEFAULT_QUALITY_DIVERSITY_CONFIG.episodeDurationSeconds,
  terrainKind: "flat",
  terrainSeed: 42,
};
const LOCAL_STORAGE_KEY = "evowalker:experiment:v4";
const LEGACY_LOCAL_STORAGE_KEYS = [
  "evowalker:experiment:v3",
  "evowalker:experiment:v2",
] as const;

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
    return (
      localStorage.getItem(LOCAL_STORAGE_KEY) !== null ||
      LEGACY_LOCAL_STORAGE_KEYS.some(
        (key) => localStorage.getItem(key) !== null,
      )
    );
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
  lineageId: string | null,
): readonly QualityDiversityLineageRecord[] {
  if (snapshot === null || lineageId === null) return [];
  const records = new Map(
    snapshot.lineage.map((record) => [record.id, record]),
  );
  const pending = [lineageId];
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
  const [selectedEntry, setSelectedEntry] =
    useState<QualityDiversityArchiveEntry | null>(null);
  const [inspectionEpisode, setInspectionEpisode] =
    useState<EpisodeResult | null>(null);
  const [inspectionState, setInspectionState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [replayToken, setReplayToken] = useState(0);
  const [hasLocalSave, setHasLocalSave] = useState(localSaveExists);
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(
    null,
  );
  const [discoveryMessage, setDiscoveryMessage] = useState("Awaiting founders");
  const workerRef = useRef<Worker | null>(null);
  const inspectionWorkerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const inspectionSequence = useRef(0);
  const statusRef = useRef<ExperimentStatus>("initial");
  const episodeRef = useRef<EpisodeResult | null>(null);
  const archiveSizeRef = useRef(0);
  const editableTerrain: TerrainConfig = {
    kind: config.terrainKind,
    seed: config.terrainSeed,
    generatorVersion: TERRAIN_GENERATOR_VERSION,
  };
  const experimentTerrain = snapshot?.config.terrain ?? editableTerrain;
  const experimentDurationSeconds =
    snapshot?.config.episodeDurationSeconds ?? config.episodeDurationSeconds;

  const transition = useCallback((next: ExperimentStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const assignEpisode = useCallback((next: EpisodeResult | null) => {
    episodeRef.current = next;
    setEpisode(next);
  }, []);

  const clearInspection = useCallback(() => {
    inspectionWorkerRef.current?.terminate();
    inspectionWorkerRef.current = null;
    setSelectedEntry(null);
    setInspectionEpisode(null);
    setInspectionState("idle");
    setInspectionError(null);
    setReplayToken((token) => token + 1);
  }, []);

  const inspectEntry = useCallback(
    (entry: QualityDiversityArchiveEntry) => {
      inspectionWorkerRef.current?.terminate();
      const worker = new Worker(
        new URL(
          "../../../packages/worker/src/browser-worker.ts",
          import.meta.url,
        ),
        { type: "module", name: "evowalker-gait-inspection" },
      );
      const requestId = `gait-${entry.lineageId}-${String(++inspectionSequence.current)}`;
      setSelectedEntry(entry);
      setInspectionEpisode(null);
      setInspectionState("loading");
      setInspectionError(null);
      worker.addEventListener(
        "message",
        ({ data }: MessageEvent<WorkerResponse>) => {
          if (data.requestId !== requestId) return;
          if (data.kind === "error") {
            setInspectionState("error");
            setInspectionError(data.message);
            return;
          }
          if (data.kind !== "replay-completed") return;
          const fitnessMatches =
            Math.abs(data.episode.aggregateFitness - entry.fitness) <= 1e-9;
          const behaviorMatches =
            Math.abs(
              data.episode.gait.dutyFactor - entry.behavior.dutyFactor,
            ) <= 1e-9 &&
            Math.abs(
              data.episode.gait.diagonalCoordination -
                entry.behavior.diagonalCoordination,
            ) <= 1e-9;
          if (!fitnessMatches || !behaviorMatches || !data.episode.viable) {
            setInspectionState("error");
            setInspectionError(
              "This specimen did not reproduce its archived score and was not displayed.",
            );
            return;
          }
          setInspectionEpisode(data.episode);
          setInspectionState("ready");
          setReplayToken((token) => token + 1);
        },
      );
      worker.addEventListener("error", (event) => {
        setInspectionState("error");
        setInspectionError(
          event.message || "The gait inspection worker failed.",
        );
      });
      inspectionWorkerRef.current = worker;
      const request: ReplayEpisodeRequest = {
        kind: "replay",
        protocolVersion: WORKER_PROTOCOL_VERSION,
        requestId,
        genome: entry.genome,
        terrain: experimentTerrain,
        episodeDurationSeconds: experimentDurationSeconds,
      };
      worker.postMessage(request);
    },
    [experimentDurationSeconds, experimentTerrain],
  );

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
        case "replay-completed":
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
      inspectionWorkerRef.current?.terminate();
      inspectionWorkerRef.current = null;
    };
  }, [createWorker]);

  const start = (checkpoint?: QualityDiversitySnapshot) => {
    clearInspection();
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
        terrain: editableTerrain,
        episodeDurationSeconds: config.episodeDurationSeconds,
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
    clearInspection();
    workerRef.current?.terminate();
    requestIdRef.current = null;
    setConfig({
      seed: document.snapshot.config.seed,
      initialPopulation: document.snapshot.config.initialPopulation,
      archiveBins: document.snapshot.config.archiveBins,
      episodeDurationSeconds: document.snapshot.config.episodeDurationSeconds,
      terrainKind: document.snapshot.config.terrain.kind,
      terrainSeed: document.snapshot.config.terrain.seed,
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
      const serialized =
        localStorage.getItem(LOCAL_STORAGE_KEY) ??
        LEGACY_LOCAL_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(
          (value) => value !== null,
        ) ??
        null;
      if (serialized === null)
        throw new Error("No EvoWalker checkpoint was found.");
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
      setPersistenceMessage("Exported a validated version-4 checkpoint.");
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
        "The current experiment was kept. Choose a valid EvoWalker schema-v2, schema-v3, or schema-v4 JSON file.",
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
  const displayEpisode = selectedEntry === null ? episode : inspectionEpisode;
  const displayedEntry = selectedEntry ?? champion;
  const lineage = ancestry(snapshot, displayedEntry?.lineageId ?? null);

  return (
    <div
      className="app-frame"
      data-status={status}
      data-terrain={experimentTerrain.kind}
      data-episode-seconds={experimentDurationSeconds}
    >
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
            <label>
              Episode
              <select
                value={config.episodeDurationSeconds}
                disabled={activeWorker}
                onChange={(event) => {
                  setConfig({
                    ...config,
                    episodeDurationSeconds: Number(
                      event.currentTarget.value,
                    ) as EpisodeDurationSeconds,
                  });
                }}
              >
                {EPISODE_DURATION_OPTIONS.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration === 6
                      ? "6 seconds · quick"
                      : "30 seconds · endurance"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Terrain
              <select
                value={config.terrainKind}
                disabled={activeWorker}
                onChange={(event) => {
                  setConfig({
                    ...config,
                    terrainKind: event.currentTarget.value as TerrainKind,
                  });
                }}
              >
                {TERRAIN_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind === "flat"
                      ? "Flat ground"
                      : kind === "gentle-ramp"
                        ? "Gentle rise"
                        : kind === "curb-trail"
                          ? "Curb trail"
                          : "Uneven trail"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Course seed
              <input
                type="number"
                value={config.terrainSeed}
                disabled={activeWorker}
                onChange={(event) => {
                  setConfig({
                    ...config,
                    terrainSeed: event.currentTarget.valueAsNumber,
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
                "Schema v4 · duration, terrain, archive, and PRNG state · validated before replacement"}
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
            aria-labelledby="replay-heading"
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">
                  {selectedEntry === null
                    ? "Viable current best"
                    : "Gait atlas specimen"}
                </p>
                <h2 id="replay-heading">
                  {selectedEntry === null
                    ? "Uninterrupted champion replay"
                    : `Niche ${String(selectedEntry.xIndex + 1)} × ${String(selectedEntry.yIndex + 1)}`}
                </h2>
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
                  disabled={displayEpisode === null}
                  onClick={() => {
                    setReplayToken((token) => token + 1);
                  }}
                >
                  Replay
                </button>
              </div>
            </div>
            {selectedEntry === null ? null : (
              <div className="specimen-ribbon" role="status">
                <span>
                  <strong>Archive specimen</strong>
                  <small>
                    evaluation {selectedEntry.evaluation} · fitness{" "}
                    {formatNumber(selectedEntry.fitness)}
                  </small>
                </span>
                <span className={`inspection-state ${inspectionState}`}>
                  {inspectionState === "loading"
                    ? "Reproducing…"
                    : inspectionState === "ready"
                      ? "Score reproduced"
                      : inspectionState === "error"
                        ? inspectionError
                        : "Selected"}
                </span>
                <button type="button" onClick={clearInspection}>
                  Follow live champion
                </button>
              </div>
            )}
            <ChampionScene
              episode={displayEpisode}
              terrain={experimentTerrain}
              playbackSpeed={playbackSpeed}
              replayToken={replayToken}
              label={
                selectedEntry === null
                  ? "Champion replay"
                  : "Selected gait specimen replay"
              }
            />
            <p className="scene-help">
              Drag to orbit · Scroll to zoom · Arrow keys rotate ·{" "}
              {selectedEntry === null
                ? "new champions enter between loops"
                : "evolution continues while this specimen loops"}
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
                <strong>
                  {displayEpisode?.viable === true
                    ? `full ${String(experimentDurationSeconds)}s`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Terrain</span>
                <strong>{displayEpisode?.terrain.label ?? "—"}</strong>
              </div>
              <div>
                <span>Cleared</span>
                <strong>
                  {displayEpisode === null
                    ? "—"
                    : `${String(displayEpisode.terrain.obstaclesCleared)}/${String(displayEpisode.terrain.obstaclesTotal)}`}
                </strong>
              </div>
            </div>
            <FitnessChart history={snapshot?.history ?? []} />
            <ArchiveMap
              snapshot={snapshot}
              selectedLineageId={selectedEntry?.lineageId ?? null}
              onSelect={inspectEntry}
            />
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
            <FitnessComponentsPanel
              components={displayEpisode?.components ?? null}
            />
            <div className="descriptor-row">
              <span>
                Ground contact{" "}
                <strong>
                  {formatNumber(displayEpisode?.gait.dutyFactor, 3)}
                </strong>
              </span>
              <span>
                Diagonal rhythm{" "}
                <strong>
                  {formatNumber(displayEpisode?.gait.diagonalCoordination, 3)}
                </strong>
              </span>
            </div>
            <div className="aggregate">
              <span>Aggregate fitness</span>
              <strong>
                {formatNumber(displayEpisode?.aggregateFitness, 5)}
              </strong>
            </div>
          </section>

          <section
            className="panel inspection"
            aria-labelledby="genome-heading"
          >
            <div className="panel-heading">
              <h2 id="genome-heading">
                {selectedEntry === null
                  ? "Champion controller"
                  : "Specimen controller"}
              </h2>
            </div>
            {displayedEntry === null ? (
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
                    {displayedEntry.genome.joints.map((joint, index) => (
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
              <h2 id="lineage-heading">
                {selectedEntry === null
                  ? "Champion ancestry"
                  : "Specimen ancestry"}
              </h2>
              <span>{displayedEntry?.lineageId ?? "unassigned"}</span>
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
