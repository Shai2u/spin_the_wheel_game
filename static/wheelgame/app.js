const { useEffect, useMemo, useRef, useState } = React;

const STORAGE_KEY = "wheelgame_task_bank_v1";
const SLICE_COLORS = [
  "#ffadad",
  "#ffd6a5",
  "#fdffb6",
  "#caffbf",
  "#9bf6ff",
  "#a0c4ff",
  "#bdb2ff",
  "#ffc6ff",
];
const THEME_OPTIONS = ["auto", "morning", "dawn", "sunset", "night"];

function normalizeTaskLabel(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeLabelKey(value) {
  return normalizeTaskLabel(value).toLowerCase();
}

function isHebrewText(value) {
  return /[\u0590-\u05FF]/.test(value);
}

function getSavedState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { bankTasks: parsed };
    }
    return parsed || {};
  } catch {
    return {};
  }
}

function getAutoThemeByHour(hour) {
  if (hour >= 6 && hour < 10) return "dawn";
  if (hour >= 10 && hour < 17) return "morning";
  if (hour >= 17 && hour < 20) return "sunset";
  return "night";
}

function getRandomUnit() {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] / 4294967296;
  }
  return Math.random();
}

function getSkyObject(theme, hour) {
  function arcPosition(progress) {
    const clamped = Math.min(1, Math.max(0, progress));
    const angle = Math.PI - Math.PI * clamped;
    const radius = 44;
    const cx = 50;
    const cy = 58;
    return {
      left: cx + Math.cos(angle) * radius,
      top: cy - Math.sin(angle) * radius,
    };
  }

  if (theme === "dawn") {
    const pos = arcPosition(0.15);
    return { icon: "🌤️", ...pos };
  }
  if (theme === "morning") {
    const pos = arcPosition(0.5);
    return { icon: "☀️", ...pos };
  }
  if (theme === "sunset") {
    const pos = arcPosition(0.85);
    return { icon: "🌇", ...pos };
  }
  if (theme === "night") {
    const pos = arcPosition(0.62);
    return { icon: "🌙", ...pos };
  }

  // Auto mode: daytime sun and nighttime moon moving over the same upper-half arc.
  if (hour >= 6 && hour < 18) {
    const daytimeProgress = (hour - 6) / 12;
    const pos = arcPosition(daytimeProgress);
    return { icon: "☀️", ...pos };
  }

  const nightProgress = hour >= 18 ? (hour - 18) / 12 : (hour + 6) / 12;
  const pos = arcPosition(nightProgress);
  return { icon: "🌙", ...pos };
}

function hasMeaningfulState(state) {
  return (
    (Array.isArray(state.bankTasks) && state.bankTasks.length > 0) ||
    (Array.isArray(state.wheelTasks) && state.wheelTasks.length > 0) ||
    (Array.isArray(state.presets) && state.presets.length > 0) ||
    state.isMuted === true ||
    (typeof state.themeMode === "string" && state.themeMode !== "auto")
  );
}

function buildSliceLabelStyle(index, total) {
  const angleStep = 360 / total;
  const midAngleFromTop = index * angleStep + angleStep / 2;
  const angleFromRight = midAngleFromTop - 90;
  const radians = (angleFromRight * Math.PI) / 180;
  const radiusPercent = 33;
  const left = 50 + Math.cos(radians) * radiusPercent;
  const top = 50 + Math.sin(radians) * radiusPercent;
  const readableRotation =
    angleFromRight > 90 && angleFromRight < 270
      ? angleFromRight + 180
      : angleFromRight;

  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: `translate(-50%, -50%) rotate(${readableRotation}deg)`,
  };
}

function App() {
  const starterTasks = useMemo(
    () => [
      { id: crypto.randomUUID(), label: "Brush teeth" },
      { id: crypto.randomUUID(), label: "Story time" },
      { id: crypto.randomUUID(), label: "Tidy toys" },
      { id: crypto.randomUUID(), label: "Water plants" },
    ],
    []
  );
  const savedState = useMemo(() => getSavedState(), []);
  const [bankTasks, setBankTasks] = useState(() =>
    Array.isArray(savedState.bankTasks) ? savedState.bankTasks : starterTasks
  );
  const [wheelTasks, setWheelTasks] = useState(() =>
    Array.isArray(savedState.wheelTasks) ? savedState.wheelTasks : []
  );
  const [presets, setPresets] = useState(() =>
    Array.isArray(savedState.presets) ? savedState.presets : []
  );
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [error, setError] = useState("");
  const [draggingTask, setDraggingTask] = useState(null);
  const [wheelDropActive, setWheelDropActive] = useState(false);
  const [bankDropActive, setBankDropActive] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinDurationMs, setSpinDurationMs] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerTaskId, setWinnerTaskId] = useState(null);
  const [needleKick, setNeedleKick] = useState(false);
  const [isMuted, setIsMuted] = useState(() => Boolean(savedState.isMuted));
  const [themeMode, setThemeMode] = useState(() =>
    THEME_OPTIONS.includes(savedState.themeMode) ? savedState.themeMode : "auto"
  );
  const [clockHour, setClockHour] = useState(() => new Date().getHours());
  const [backendSyncReady, setBackendSyncReady] = useState(false);
  const hasLocalMeaningfulState = useMemo(
    () => hasMeaningfulState(savedState),
    [savedState]
  );
  const inputIsHebrew = isHebrewText(newTaskLabel);
  const wheelRef = useRef(null);
  const spinTimeoutRef = useRef(null);
  const frictionIntervalRef = useRef(null);
  const needleKickTimeoutRef = useRef(null);
  const backendSaveTimeoutRef = useRef(null);
  const spinPlanRef = useRef({
    startTime: 0,
    durationMs: 0,
    startRotation: 0,
    targetRotation: 0,
    lastBoundary: null,
    lastKickAt: 0,
  });
  const dragSpinRef = useRef({
    active: false,
    startAngle: 0,
    startRotation: 0,
    currentRotation: 0,
    lastAngle: 0,
    lastTs: 0,
    velocity: 0,
  });
  const wheelGradient = useMemo(() => {
    if (!wheelTasks.length) {
      return "radial-gradient(circle at 40% 30%, #fffde7, #ffe8d6)";
    }

    const angleStep = 360 / wheelTasks.length;
    const slices = wheelTasks.map((_, index) => {
      const start = index * angleStep;
      const end = start + angleStep;
      const color = SLICE_COLORS[index % SLICE_COLORS.length];
      return `${color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${slices.join(", ")})`;
  }, [wheelTasks]);
  const winnerTaskLabel = useMemo(
    () => wheelTasks.find((task) => task.id === winnerTaskId)?.label || "",
    [winnerTaskId, wheelTasks]
  );
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) || null,
    [presets, selectedPresetId]
  );
  const effectiveTheme = useMemo(
    () =>
      themeMode === "auto" ? getAutoThemeByHour(clockHour) : themeMode,
    [themeMode, clockHour]
  );
  const skyObject = useMemo(
    () => getSkyObject(effectiveTheme, clockHour),
    [effectiveTheme, clockHour]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStateFromBackend() {
      try {
        const response = await fetch("/api/state/");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (cancelled || !data?.state) {
          return;
        }

        const state = data.state;
        const shouldApplyBackend =
          hasMeaningfulState(state) || !hasLocalMeaningfulState;

        if (shouldApplyBackend) {
          if (Array.isArray(state.bankTasks)) {
            setBankTasks(state.bankTasks);
          }
          if (Array.isArray(state.wheelTasks)) {
            setWheelTasks(state.wheelTasks);
          }
          if (Array.isArray(state.presets)) {
            setPresets(state.presets);
          }
          if (typeof state.isMuted === "boolean") {
            setIsMuted(state.isMuted);
          }
          if (THEME_OPTIONS.includes(state.themeMode)) {
            setThemeMode(state.themeMode);
          }
        }
      } catch {
        // Keep local state if backend is unavailable.
      } finally {
        if (!cancelled) {
          setBackendSyncReady(true);
        }
      }
    }

    loadStateFromBackend();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bankTasks,
        wheelTasks,
        presets,
        isMuted,
        themeMode,
      })
    );
  }, [bankTasks, wheelTasks, presets, isMuted, themeMode]);

  useEffect(() => {
    if (!backendSyncReady) {
      return;
    }

    if (backendSaveTimeoutRef.current) {
      clearTimeout(backendSaveTimeoutRef.current);
    }
    backendSaveTimeoutRef.current = setTimeout(() => {
      fetch("/api/state/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bankTasks: bankTasks,
          wheelTasks: wheelTasks,
          presets: presets,
          isMuted: isMuted,
          themeMode: themeMode,
        }),
      }).catch(() => {
        // Keep app responsive when backend sync fails.
      });
      backendSaveTimeoutRef.current = null;
    }, 350);

    return () => {
      if (backendSaveTimeoutRef.current) {
        clearTimeout(backendSaveTimeoutRef.current);
        backendSaveTimeoutRef.current = null;
      }
    };
  }, [backendSyncReady, bankTasks, wheelTasks, presets, isMuted, themeMode]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockHour(new Date().getHours());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.body.classList.remove(
      "theme-morning",
      "theme-dawn",
      "theme-sunset",
      "theme-night"
    );
    document.body.classList.add(`theme-${effectiveTheme}`);
  }, [effectiveTheme]);

  useEffect(() => {
    if (
      selectedPresetId &&
      !presets.some((preset) => preset.id === selectedPresetId)
    ) {
      setSelectedPresetId(null);
      setPresetName("");
    }
  }, [presets, selectedPresetId]);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current);
      }
      if (frictionIntervalRef.current) {
        clearInterval(frictionIntervalRef.current);
      }
      if (needleKickTimeoutRef.current) {
        clearTimeout(needleKickTimeoutRef.current);
      }
      if (backendSaveTimeoutRef.current) {
        clearTimeout(backendSaveTimeoutRef.current);
      }
    };
  }, []);

  function getVoiceForLang(lang) {
    if (!window.speechSynthesis) {
      return null;
    }
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      return null;
    }
    return (
      voices.find((voice) =>
        voice.lang.toLowerCase().startsWith(lang.toLowerCase())
      ) || null
    );
  }

  function speakWinnerText(text) {
    if (!text || !window.speechSynthesis) {
      return;
    }

    const lang = isHebrewText(text) ? "he-IL" : "en-US";
    const spokenText =
      lang === "he-IL"
        ? `המשימה שנבחרה היא: ${text}`
        : `The selected task is: ${text}`;
    const utterance = new SpeechSynthesisUtterance(spokenText);
    const voice = getVoiceForLang(lang);
    utterance.lang = lang;
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = 0.93;
    utterance.pitch = 1.08;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (!winnerTaskLabel || isMuted) {
      return;
    }
    speakWinnerText(winnerTaskLabel);
  }, [winnerTaskLabel, isMuted]);

  function stopNeedleFriction() {
    if (frictionIntervalRef.current) {
      clearInterval(frictionIntervalRef.current);
      frictionIntervalRef.current = null;
    }
    if (needleKickTimeoutRef.current) {
      clearTimeout(needleKickTimeoutRef.current);
      needleKickTimeoutRef.current = null;
    }
    setNeedleKick(false);
  }

  function triggerNeedleKick(durationMs) {
    setNeedleKick(true);
    if (needleKickTimeoutRef.current) {
      clearTimeout(needleKickTimeoutRef.current);
    }
    needleKickTimeoutRef.current = setTimeout(() => {
      setNeedleKick(false);
      needleKickTimeoutRef.current = null;
    }, durationMs);
  }

  function startNeedleFriction(totalDurationMs) {
    stopNeedleFriction();
    const frictionWindowMs = 1700;

    frictionIntervalRef.current = setInterval(() => {
      const now = performance.now();
      const elapsed = now - spinPlanRef.current.startTime;
      const remaining = totalDurationMs - elapsed;
      if (remaining <= 0) {
        stopNeedleFriction();
        return;
      }
      if (remaining > frictionWindowMs) {
        return;
      }

      const progress = Math.min(1, Math.max(0, elapsed / totalDurationMs));
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const estimatedRotation =
        spinPlanRef.current.startRotation +
        (spinPlanRef.current.targetRotation - spinPlanRef.current.startRotation) *
          easedProgress;
      const currentBoundary = findWinnerIndexByRotation(
        estimatedRotation,
        wheelTasks.length
      );

      if (spinPlanRef.current.lastBoundary === null) {
        spinPlanRef.current.lastBoundary = currentBoundary;
        return;
      }
      if (currentBoundary !== spinPlanRef.current.lastBoundary) {
        const endProgress = (frictionWindowMs - remaining) / frictionWindowMs;
        const minGapMs = 55 + (1 - endProgress) * 45;
        if (now - spinPlanRef.current.lastKickAt >= minGapMs) {
          triggerNeedleKick(58 + endProgress * 72);
          spinPlanRef.current.lastKickAt = now;
        }
        spinPlanRef.current.lastBoundary = currentBoundary;
      }
    }, 40);
  }

  function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
  }

  function findWinnerIndexByRotation(rotationDeg, totalSlices) {
    if (!totalSlices) return -1;
    const normalized = normalizeDegrees(rotationDeg);
    const localAngleFromTop = (360 - normalized) % 360;
    const angleStep = 360 / totalSlices;
    return Math.floor(localAngleFromTop / angleStep) % totalSlices;
  }

  function finishSpin(finalRotation) {
    const winnerIndex = findWinnerIndexByRotation(finalRotation, wheelTasks.length);
    if (winnerIndex >= 0 && wheelTasks[winnerIndex]) {
      setWinnerTaskId(wheelTasks[winnerIndex].id);
    }
    stopNeedleFriction();
    setIsSpinning(false);
  }

  function spinTo(targetRotation, durationMs) {
    if (!wheelTasks.length) {
      setError("Add at least one task to the wheel first.");
      return;
    }
    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current);
    }

    setError("");
    setWinnerTaskId(null);
    setSpinDurationMs(durationMs);
    setIsSpinning(true);
    spinPlanRef.current = {
      startTime: performance.now(),
      durationMs,
      startRotation: wheelRotation,
      targetRotation,
      lastBoundary: null,
      lastKickAt: 0,
    };
    setWheelRotation(targetRotation);
    startNeedleFriction(durationMs);

    spinTimeoutRef.current = setTimeout(() => {
      finishSpin(targetRotation);
      spinTimeoutRef.current = null;
    }, durationMs + 30);
  }

  function spinByButton() {
    if (!wheelTasks.length) {
      setError("Add at least one task to the wheel first.");
      return;
    }
    if (isSpinning) return;

    const sliceCount = wheelTasks.length;
    const angleStep = 360 / sliceCount;
    let winnerIndex = Math.floor(getRandomUnit() * sliceCount);

    // Slight anti-streak smoothing so repeated immediate winners are less frequent.
    if (sliceCount > 2 && winnerTaskId) {
      const lastWinnerIndex = wheelTasks.findIndex(
        (task) => task.id === winnerTaskId
      );
      if (winnerIndex === lastWinnerIndex && getRandomUnit() < 0.75) {
        winnerIndex = (winnerIndex + 1 + Math.floor(getRandomUnit() * (sliceCount - 1))) % sliceCount;
      }
    }

    const centerAngleFromTop = winnerIndex * angleStep + angleStep / 2;
    const jitter = (getRandomUnit() * 2 - 1) * (angleStep * 0.18);
    const localTargetFromTop = centerAngleFromTop + jitter;
    const targetNormalized = normalizeDegrees(360 - localTargetFromTop);
    const currentNormalized = normalizeDegrees(wheelRotation);
    const clockwiseDelta = (targetNormalized - currentNormalized + 360) % 360;

    const turns = 7 + getRandomUnit() * 8;
    const targetRotation = wheelRotation + turns * 360 + clockwiseDelta;
    const durationMs = 4300 + getRandomUnit() * 2600;
    spinTo(targetRotation, durationMs);
  }

  function getPointerAngleDeg(event) {
    const wheelElement = wheelRef.current;
    if (!wheelElement) return 0;
    const rect = wheelElement.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  function normalizeDeltaAngle(nextAngle, prevAngle) {
    let delta = nextAngle - prevAngle;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }

  function onWheelPointerDown(event) {
    if (isSpinning) return;
    if (event.target.closest(".slice-label")) return;
    if (!wheelTasks.length) {
      setError("Drag tasks into the wheel first.");
      return;
    }

    const startAngle = getPointerAngleDeg(event);
    dragSpinRef.current = {
      active: true,
      startAngle,
      startRotation: wheelRotation,
      currentRotation: wheelRotation,
      lastAngle: startAngle,
      lastTs: performance.now(),
      velocity: 0,
    };

    const onPointerMove = (moveEvent) => {
      if (!dragSpinRef.current.active) return;
      const nextAngle = getPointerAngleDeg(moveEvent);
      const deltaFromStart = normalizeDeltaAngle(nextAngle, dragSpinRef.current.startAngle);
      const now = performance.now();
      const frameDeltaAngle = normalizeDeltaAngle(nextAngle, dragSpinRef.current.lastAngle);
      const dt = Math.max(1, now - dragSpinRef.current.lastTs);
      dragSpinRef.current.velocity = frameDeltaAngle / dt;
      dragSpinRef.current.lastAngle = nextAngle;
      dragSpinRef.current.lastTs = now;
      dragSpinRef.current.currentRotation =
        dragSpinRef.current.startRotation + deltaFromStart;
      setWheelRotation(dragSpinRef.current.currentRotation);
      setWinnerTaskId(null);
    };

    const onPointerUp = () => {
      const { velocity } = dragSpinRef.current;
      dragSpinRef.current.active = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      const speed = Math.min(Math.abs(velocity), 0.9);
      const direction = velocity >= 0 ? 1 : -1;
      const bonusRotation = direction * (360 * (2 + speed * 6));
      const durationMs = 2200 + speed * 1800;
      spinTo(dragSpinRef.current.currentRotation + bonusRotation, durationMs);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function addTask(event) {
    if (isSpinning) return;
    if (event) {
      event.preventDefault();
    }

    const normalizedLabel = normalizeTaskLabel(newTaskLabel);
    if (!normalizedLabel) {
      setError("Please write a task first.");
      return;
    }

    const exists = bankTasks.some(
      (task) => normalizeLabelKey(task.label) === normalizeLabelKey(normalizedLabel)
    );
    if (exists) {
      setError("This task already exists in the bank.");
      return;
    }

    const createdTask = { id: crypto.randomUUID(), label: normalizedLabel };
    setBankTasks((current) => [...current, createdTask]);
    setNewTaskLabel("");
    setSelectedTaskId(createdTask.id);
    setError("");
  }

  function editSelectedTask() {
    if (isSpinning) return;
    if (!selectedTaskId) {
      setError("Select one task, then press edit.");
      return;
    }

    const normalizedLabel = normalizeTaskLabel(newTaskLabel);
    if (!normalizedLabel) {
      setError("Write the updated text first.");
      return;
    }

    const exists = bankTasks.some(
      (task) =>
        task.id !== selectedTaskId &&
        normalizeLabelKey(task.label) === normalizeLabelKey(normalizedLabel)
    );
    if (exists) {
      setError("Another task already has this name.");
      return;
    }

    setBankTasks((current) =>
      current.map((task) =>
        task.id === selectedTaskId ? { ...task, label: normalizedLabel } : task
      )
    );
    setNewTaskLabel(normalizedLabel);
    setError("");
  }

  function deleteSelectedTask() {
    if (isSpinning) return;
    if (!selectedTaskId) {
      setError("Select one task, then press trash.");
      return;
    }

    setBankTasks((current) =>
      current.filter((task) => task.id !== selectedTaskId)
    );
    setSelectedTaskId(null);
    setNewTaskLabel("");
    setError("");
  }

  function moveTaskToWheel(taskId) {
    if (isSpinning) return;
    const task = bankTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    setBankTasks((current) => current.filter((item) => item.id !== taskId));
    setWheelTasks((current) => [...current, task]);

    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
      setNewTaskLabel("");
    }
    setError("");
  }

  function moveTaskToBank(taskId) {
    if (isSpinning) return;
    const task = wheelTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    setWheelTasks((current) => current.filter((item) => item.id !== taskId));
    setBankTasks((current) => [...current, task]);
    setError("");
  }

  function onTaskDragStart(source, taskId) {
    if (isSpinning) return;
    setDraggingTask({ source, taskId });
    setError("");
  }

  function onTaskDragEnd() {
    setDraggingTask(null);
    setWheelDropActive(false);
    setBankDropActive(false);
  }

  function onWheelDrop(event) {
    event.preventDefault();
    setWheelDropActive(false);
    if (!draggingTask || draggingTask.source !== "bank") {
      return;
    }
    moveTaskToWheel(draggingTask.taskId);
    setDraggingTask(null);
  }

  function onBankDrop(event) {
    event.preventDefault();
    setBankDropActive(false);
    if (!draggingTask || draggingTask.source !== "wheel") {
      return;
    }
    moveTaskToBank(draggingTask.taskId);
    setDraggingTask(null);
  }

  function resetWheel() {
    if (isSpinning) return;
    if (!wheelTasks.length) {
      setError("Wheel is already empty.");
      return;
    }

    setBankTasks((current) => [...current, ...wheelTasks]);
    setWheelTasks([]);
    setWinnerTaskId(null);
    setError("");
  }

  function savePresetAsNew() {
    if (isSpinning) return;
    const normalizedName = normalizeTaskLabel(presetName);
    if (!normalizedName) {
      setError("Write a preset name first.");
      return;
    }
    const duplicate = presets.some(
      (preset) => normalizeLabelKey(preset.name) === normalizeLabelKey(normalizedName)
    );
    if (duplicate) {
      setError("Preset name already exists.");
      return;
    }

    const preset = {
      id: crypto.randomUUID(),
      name: normalizedName,
      itemLabels: wheelTasks.map((task) => task.label),
    };
    setPresets((current) => [...current, preset]);
    setSelectedPresetId(preset.id);
    setPresetName(normalizedName);
    setError("");
  }

  function updateSelectedPreset() {
    if (isSpinning) return;
    if (!selectedPresetId) {
      setError("Select a preset first.");
      return;
    }

    const normalizedName = normalizeTaskLabel(presetName);
    if (!normalizedName) {
      setError("Write a preset name first.");
      return;
    }
    const duplicate = presets.some(
      (preset) =>
        preset.id !== selectedPresetId &&
        normalizeLabelKey(preset.name) === normalizeLabelKey(normalizedName)
    );
    if (duplicate) {
      setError("Another preset already has this name.");
      return;
    }

    setPresets((current) =>
      current.map((preset) =>
        preset.id === selectedPresetId
          ? {
              ...preset,
              name: normalizedName,
              itemLabels: wheelTasks.map((task) => task.label),
            }
          : preset
      )
    );
    setPresetName(normalizedName);
    setError("");
  }

  function deleteSelectedPreset() {
    if (isSpinning) return;
    if (!selectedPresetId) {
      setError("Select a preset first.");
      return;
    }

    setPresets((current) => current.filter((preset) => preset.id !== selectedPresetId));
    setSelectedPresetId(null);
    setPresetName("");
    setError("");
  }

  function applySelectedPreset() {
    if (isSpinning) return;
    if (!selectedPreset) {
      setError("Select a preset first.");
      return;
    }

    const pool = [...bankTasks, ...wheelTasks];
    const usedIds = new Set();
    const selected = [];

    selectedPreset.itemLabels.forEach((label) => {
      const match = pool.find(
        (task) =>
          !usedIds.has(task.id) &&
          normalizeLabelKey(task.label) === normalizeLabelKey(label)
      );
      if (match) {
        usedIds.add(match.id);
        selected.push(match);
      }
    });

    const remaining = pool.filter((task) => !usedIds.has(task.id));
    setWheelTasks(selected);
    setBankTasks(remaining);
    setWinnerTaskId(null);
    setError("");
  }

  function selectPreset(preset) {
    setSelectedPresetId(preset.id);
    setPresetName(preset.name);
    setError("");
  }

  return (
    <main className="app-shell">
      <section className="wheel-area">
        <div className="wheel-headline">
          <h1>Spin the Yarin!</h1>
          <p>Drag tasks into slices. Drag labels back to the bank to remove.</p>
          <span className="pill">Drag & Drop enabled</span>
          <div className="wheel-controls">
            <button
              type="button"
              className="spin-btn"
              onClick={spinByButton}
              disabled={isSpinning}
            >
              {isSpinning ? "Spinning..." : "Spin"}
            </button>
            <button
              type="button"
              className="reset-btn"
              onClick={resetWheel}
              disabled={isSpinning || !wheelTasks.length}
            >
              Reset Wheel
            </button>
            <label className="theme-label" htmlFor="theme-select">
              Theme
            </label>
            <select
              id="theme-select"
              className="theme-select"
              value={themeMode}
              onChange={(event) => setThemeMode(event.target.value)}
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option[0].toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="preset-editor">
            <p className="preset-title">Wheel Presets</p>
            <div className="preset-row">
              <input
                className={`preset-input ${isHebrewText(presetName) ? "rtl-text" : "ltr-text"}`}
                type="text"
                placeholder="Preset name..."
                value={presetName}
                disabled={isSpinning}
                onChange={(event) => setPresetName(event.target.value)}
                dir={isHebrewText(presetName) ? "rtl" : "ltr"}
              />
            </div>
            <div className="preset-actions">
              <button
                type="button"
                className="preset-btn"
                onClick={savePresetAsNew}
                disabled={isSpinning}
              >
                Save New
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={updateSelectedPreset}
                disabled={isSpinning || !selectedPresetId}
              >
                Save Edit
              </button>
              <button
                type="button"
                className="preset-btn danger"
                onClick={deleteSelectedPreset}
                disabled={isSpinning || !selectedPresetId}
              >
                Remove
              </button>
              <button
                type="button"
                className="preset-btn apply"
                onClick={applySelectedPreset}
                disabled={isSpinning || !selectedPresetId}
              >
                Apply
              </button>
            </div>
            <ul className="preset-list">
              {presets.length ? (
                presets.map((preset) => (
                  <li key={preset.id}>
                    <button
                      type="button"
                      className={`preset-item ${
                        selectedPresetId === preset.id ? "is-selected" : ""
                      } ${isHebrewText(preset.name) ? "rtl-text" : "ltr-text"}`}
                      onClick={() => selectPreset(preset)}
                    >
                      {preset.name}
                    </button>
                  </li>
                ))
              ) : (
                <li className="empty-state">No presets yet. Save current wheel as one.</li>
              )}
            </ul>
          </div>
          <p className="wheel-help">You can also drag the wheel to spin it.</p>
          {winnerTaskId ? (
            <>
              <p className="winner-line">Selected: {winnerTaskLabel}</p>
              <div className="speech-controls">
                <button
                  type="button"
                  className="speech-btn"
                  onClick={() => speakWinnerText(winnerTaskLabel)}
                >
                  Replay Voice
                </button>
                <button
                  type="button"
                  className="speech-btn"
                  onClick={() => setIsMuted((value) => !value)}
                >
                  {isMuted ? "Unmute Voice" : "Mute Voice"}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="sky-deco" aria-hidden="true">
          <span
            className="sky-object"
            style={{ left: `${skyObject.left}%`, top: `${skyObject.top}%` }}
          >
            {skyObject.icon}
          </span>
        </div>

        <div
          ref={wheelRef}
          className={`placeholder-wheel ${wheelDropActive ? "drop-active" : ""}`}
          onPointerDown={onWheelPointerDown}
          onDragOver={(event) => {
            if (isSpinning) return;
            event.preventDefault();
            if (draggingTask?.source === "bank") {
              setWheelDropActive(true);
            }
          }}
          onDragLeave={() => setWheelDropActive(false)}
          onDrop={onWheelDrop}
        >
          <div className={`wheel-needle ${needleKick ? "is-kick" : ""}`} />
          <div
            className="wheel-disc"
            style={{
              background: wheelGradient,
              transform: `rotate(${wheelRotation}deg)`,
              transition: isSpinning
                ? `transform ${spinDurationMs}ms cubic-bezier(0.08, 0.75, 0.2, 1)`
                : "none",
            }}
          >
            {wheelTasks.length ? (
              wheelTasks.map((task, index) => (
                <button
                  key={task.id}
                  type="button"
                  className={`slice-label ${
                    isHebrewText(task.label) ? "rtl-text" : "ltr-text"
                  } ${winnerTaskId === task.id ? "is-winner" : ""}`}
                  style={buildSliceLabelStyle(index, wheelTasks.length)}
                  draggable={!isSpinning}
                  onDragStart={() => onTaskDragStart("wheel", task.id)}
                  onDragEnd={onTaskDragEnd}
                  dir={isHebrewText(task.label) ? "rtl" : "ltr"}
                  title="Drag back to task bank"
                >
                  {task.label}
                </button>
              ))
            ) : (
              <p className="wheel-empty-state">Wheel is empty. Drop tasks here.</p>
            )}
          </div>
        </div>
      </section>

      <aside
        className={`task-bank ${bankDropActive ? "drop-active" : ""}`}
        onDragOver={(event) => {
          if (isSpinning) return;
          event.preventDefault();
          if (draggingTask?.source === "wheel") {
            setBankDropActive(true);
          }
        }}
        onDragLeave={() => setBankDropActive(false)}
        onDrop={onBankDrop}
      >
        <h2>Task Bank</h2>
        <p>Add, edit, remove, and drag tasks to the wheel.</p>

        <form className="task-input-row" onSubmit={addTask}>
          <input
            className={`task-input ${inputIsHebrew ? "rtl-text" : "ltr-text"}`}
            type="text"
            placeholder="Write a new task..."
            value={newTaskLabel}
            disabled={isSpinning}
            onChange={(event) => {
              setNewTaskLabel(event.target.value);
              if (error) setError("");
            }}
            aria-label="New task"
            dir={inputIsHebrew ? "rtl" : "ltr"}
          />
        </form>

        <div className="task-actions">
          <button className="add-btn" type="button" onClick={addTask} disabled={isSpinning}>
            Add
          </button>
          <button className="edit-btn" type="button" onClick={editSelectedTask} disabled={isSpinning}>
            Edit
          </button>
          <button
            className="trash-btn"
            type="button"
            onClick={deleteSelectedTask}
            disabled={isSpinning}
            title="Delete selected task"
            aria-label="Delete selected task"
          >
            🗑️
          </button>
        </div>

        {error ? <p className="task-error">{error}</p> : null}

        <ol className="task-list">
          {bankTasks.length ? (
            bankTasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className={`task-item ${
                    selectedTaskId === task.id ? "is-selected" : ""
                  } ${isHebrewText(task.label) ? "rtl-text" : "ltr-text"}`}
                  draggable={!isSpinning}
                  onDragStart={() => onTaskDragStart("bank", task.id)}
                  onDragEnd={onTaskDragEnd}
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setNewTaskLabel(task.label);
                    setError("");
                  }}
                  dir={isHebrewText(task.label) ? "rtl" : "ltr"}
                >
                  {task.label}
                </button>
              </li>
            ))
          ) : (
            <li className="empty-state">No tasks yet. Add one above.</li>
          )}
        </ol>
      </aside>
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
