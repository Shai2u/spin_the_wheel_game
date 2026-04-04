const { useEffect, useMemo, useRef, useState } = React;

const IS_TOUCH_DEVICE = navigator.maxTouchPoints > 0 || "ontouchstart" in window;

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

const HELP_STEPS = [
  { sel: '[data-help="wheel"]',        text: "זה הגלגל! לחץ עליו כדי לסובב אותו" },
  { sel: '[data-help="bank"]',         text: "זה בנק המשימות. כאן שומרים את כל המשימות" },
  { sel: '[data-help="task-input"]',   text: "כאן כותבים שם של משימה חדשה" },
  { sel: '[data-help="task-actions"]', text: "הוסף, ערוך, מחק, ואפס משימות עם הכפתורים האלה" },
  { sel: '[data-help="task-list"]',    text: "לחץ על החץ הירוק כדי לשים משימה על הגלגל" },
  { sel: '[data-help="preset-editor"]',text: "כאן שומרים תבניות של משימות לגלגל" },
  { sel: '[data-help="mute-btn"]',     text: "לחץ על הרמקול כדי להשתיק או להפעיל את הקול" },
];

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
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed) return null;
    // v1 → v2: migrate flat structure into roles object
    if (!parsed.version || parsed.version < 2) {
      const bankTasks = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.bankTasks) ? parsed.bankTasks : []);
      return {
        version: 2,
        currentRole: "יארין",
        rolesPassword: null,
        roles: {
          "יארין": {
            bankTasks,
            wheelTasks: Array.isArray(parsed.wheelTasks) ? parsed.wheelTasks : [],
            presets: Array.isArray(parsed.presets) ? parsed.presets : [],
          },
        },
        isMuted: Boolean(parsed.isMuted),
        themeMode: typeof parsed.themeMode === "string" ? parsed.themeMode : "auto",
      };
    }
    return parsed;
  } catch {
    return null;
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
  const upperRightSun = { left: 84, top: 16 };

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
    return { icon: "🌤️", ...upperRightSun };
  }
  if (theme === "morning") {
    return { icon: "☀️", ...upperRightSun };
  }
  if (theme === "sunset") {
    return { icon: "🌇", ...upperRightSun };
  }
  if (theme === "night") {
    const pos = arcPosition(0.62);
    return { icon: "🌙", ...pos };
  }

  // Auto mode: daytime sun and nighttime moon moving over the same upper-half arc.
  if (hour >= 6 && hour < 18) {
    return { icon: "☀️", ...upperRightSun };
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
  const [bankTasks, setBankTasks] = useState(() => {
    const role = savedState?.currentRole || "יארין";
    const d = savedState?.roles?.[role] || {};
    return Array.isArray(d.bankTasks) ? d.bankTasks : starterTasks;
  });
  const [wheelTasks, setWheelTasks] = useState(() => {
    const role = savedState?.currentRole || "יארין";
    const d = savedState?.roles?.[role] || {};
    return Array.isArray(d.wheelTasks) ? d.wheelTasks : [];
  });
  const [presets, setPresets] = useState(() => {
    const role = savedState?.currentRole || "יארין";
    const d = savedState?.roles?.[role] || {};
    return Array.isArray(d.presets) ? d.presets : [];
  });
  const [roles, setRoles] = useState(() => savedState?.roles || { "יארין": {} });
  const [currentRole, setCurrentRole] = useState(() => savedState?.currentRole || "יארין");
  const [rolesPassword, setRolesPassword] = useState(() => savedState?.rolesPassword || null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleModalStep, setRoleModalStep] = useState("list");
  const [roleModalInput, setRoleModalInput] = useState("");
  const [roleModalPasswordInput, setRoleModalPasswordInput] = useState("");
  const [roleModalError, setRoleModalError] = useState("");
  const [pendingRoleAction, setPendingRoleAction] = useState(null);
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
  const [isMuted, setIsMuted] = useState(() => Boolean(savedState?.isMuted));
  const [themeMode, setThemeMode] = useState(() =>
    THEME_OPTIONS.includes(savedState?.themeMode) ? savedState.themeMode : "auto"
  );
  const [clockHour, setClockHour] = useState(() => new Date().getHours());
  const [backendSyncReady, setBackendSyncReady] = useState(false);
  const [floatingWord, setFloatingWord] = useState(null);
  const [helpMode, setHelpMode] = useState(false);
  const [helpStep, setHelpStep] = useState(0);
  const [helpRect, setHelpRect] = useState(null);
  const hasLocalMeaningfulState = useMemo(() => {
    const role = savedState?.currentRole || "יארין";
    const d = savedState?.roles?.[role] || {};
    return hasMeaningfulState(d);
  }, [savedState]);
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
  const spinQueueRef = useRef([]);
  const floatingWordTimeoutRef = useRef(null);
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
        version: 2,
        currentRole,
        rolesPassword,
        roles: { ...roles, [currentRole]: { bankTasks, wheelTasks, presets } },
        isMuted,
        themeMode,
      })
    );
  }, [bankTasks, wheelTasks, presets, isMuted, themeMode, currentRole, roles, rolesPassword]);

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
    spinQueueRef.current = [];
  }, [wheelTasks]);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
      if (frictionIntervalRef.current) clearInterval(frictionIntervalRef.current);
      if (needleKickTimeoutRef.current) clearTimeout(needleKickTimeoutRef.current);
      if (backendSaveTimeoutRef.current) clearTimeout(backendSaveTimeoutRef.current);
      if (floatingWordTimeoutRef.current) clearTimeout(floatingWordTimeoutRef.current);
    };
  }, []);

  function getVoiceForLang(lang) {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    return voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase())) || null;
  }

  function speakRaw(text, lang) {
    if (!text || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getVoiceForLang(lang);
    utterance.lang = lang;
    if (voice) utterance.voice = voice;
    utterance.rate = 0.93;
    utterance.pitch = 1.08;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function speakWinnerText(text) {
    if (!text) return;
    const lang = isHebrewText(text) ? "he-IL" : "en-US";
    const spokenText = lang === "he-IL"
      ? `המשימה שנבחרה היא: ${text}`
      : `The selected task is: ${text}`;
    speakRaw(spokenText, lang);
  }

  function speakWord(text) {
    if (!text) return;
    if (floatingWordTimeoutRef.current) clearTimeout(floatingWordTimeoutRef.current);
    setFloatingWord({ text, key: Date.now() });
    floatingWordTimeoutRef.current = setTimeout(() => {
      setFloatingWord(null);
      floatingWordTimeoutRef.current = null;
    }, 2800);
    if (!isMuted) {
      const lang = isHebrewText(text) ? "he-IL" : "en-US";
      speakRaw(text, lang);
    }
  }

  useEffect(() => {
    if (!winnerTaskLabel) return;
    if (floatingWordTimeoutRef.current) clearTimeout(floatingWordTimeoutRef.current);
    setFloatingWord({ text: winnerTaskLabel, key: Date.now() });
    floatingWordTimeoutRef.current = setTimeout(() => {
      setFloatingWord(null);
      floatingWordTimeoutRef.current = null;
    }, 2800);
    if (!isMuted) speakWinnerText(winnerTaskLabel);
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

  function getNextWinnerIndex(taskCount) {
    if (!spinQueueRef.current.length) {
      const arr = Array.from({ length: taskCount }, (_, i) => i);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(getRandomUnit() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      spinQueueRef.current = arr;
    }
    return spinQueueRef.current.pop();
  }

  function spinRandom(holdMs) {
    if (!wheelTasks.length) {
      setError("Add tasks to the wheel first.");
      return;
    }
    if (isSpinning) return;

    const sliceCount = wheelTasks.length;
    const angleStep = 360 / sliceCount;
    const winnerIndex = getNextWinnerIndex(sliceCount);

    const centerAngleFromTop = winnerIndex * angleStep + angleStep / 2;
    const jitter = (getRandomUnit() * 2 - 1) * (angleStep * 0.18);
    const localTargetFromTop = centerAngleFromTop + jitter;
    const targetNormalized = normalizeDegrees(360 - localTargetFromTop);
    const currentNormalized = normalizeDegrees(wheelRotation);
    const clockwiseDelta = (targetNormalized - currentNormalized + 360) % 360;

    // Longer hold = more rotations and longer spin duration.
    const holdFactor = Math.min(1, (holdMs || 0) / 2000);
    const turns = 7 + holdFactor * 8 + getRandomUnit() * 3;
    const targetRotation = wheelRotation + turns * 360 + clockwiseDelta;
    const durationMs = 4300 + holdFactor * 2000 + getRandomUnit() * 1500;
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
      setError("Use → to add tasks to the wheel first.");
      return;
    }

    const pointerDownTime = performance.now();
    const downX = event.clientX;
    const downY = event.clientY;
    let hasDragged = false;

    const startAngle = getPointerAngleDeg(event);
    dragSpinRef.current = {
      active: true,
      startAngle,
      startRotation: wheelRotation,
      currentRotation: wheelRotation,
      lastAngle: startAngle,
      lastTs: pointerDownTime,
      velocity: 0,
    };

    const onPointerMove = (moveEvent) => {
      if (!dragSpinRef.current.active) return;
      const dx = moveEvent.clientX - downX;
      const dy = moveEvent.clientY - downY;
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        hasDragged = true;
      }
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
      const holdMs = performance.now() - pointerDownTime;
      dragSpinRef.current.active = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      if (!hasDragged) {
        spinRandom(holdMs);
        return;
      }

      const { velocity } = dragSpinRef.current;
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

  function duplicateSelectedPreset() {
    if (isSpinning) return;
    if (!selectedPreset) { setError("Select a preset first."); return; }
    let newName = `Copy of ${selectedPreset.name}`;
    let counter = 2;
    while (presets.some((p) => normalizeLabelKey(p.name) === normalizeLabelKey(newName))) {
      newName = `Copy of ${selectedPreset.name} (${counter++})`;
    }
    const newPreset = { id: crypto.randomUUID(), name: newName, itemLabels: [...selectedPreset.itemLabels] };
    setPresets((current) => [...current, newPreset]);
    setSelectedPresetId(newPreset.id);
    setPresetName(newName);
    setError("");
  }

  function switchRole(name) {
    if (name === currentRole) { setShowRoleModal(false); return; }
    const newRoleData = roles[name] || {};
    setRoles((prev) => ({ ...prev, [currentRole]: { bankTasks, wheelTasks, presets } }));
    setBankTasks(Array.isArray(newRoleData.bankTasks) ? newRoleData.bankTasks : []);
    setWheelTasks(Array.isArray(newRoleData.wheelTasks) ? newRoleData.wheelTasks : []);
    setPresets(Array.isArray(newRoleData.presets) ? newRoleData.presets : []);
    setCurrentRole(name);
    setSelectedTaskId(null);
    setNewTaskLabel("");
    setPresetName("");
    setSelectedPresetId(null);
    setWinnerTaskId(null);
    setShowRoleModal(false);
  }

  function openRoleModal() {
    setRoleModalStep("list");
    setRoleModalInput("");
    setRoleModalPasswordInput("");
    setRoleModalError("");
    setPendingRoleAction(null);
    setShowRoleModal(true);
  }

  function startAddRole() {
    setRoleModalInput("");
    setRoleModalPasswordInput("");
    setRoleModalError("");
    setPendingRoleAction({ type: "add" });
    setRoleModalStep(rolesPassword ? "verify-password" : "set-password");
  }

  function startDeleteRole(name) {
    setRoleModalInput("");
    setRoleModalPasswordInput("");
    setRoleModalError("");
    setPendingRoleAction({ type: "delete", name });
    setRoleModalStep(rolesPassword ? "verify-password" : "set-password");
  }

  function confirmSetPassword() {
    const pw = roleModalPasswordInput.trim();
    const confirm = roleModalInput.trim();
    if (!pw) { setRoleModalError("Enter a password."); return; }
    if (pw !== confirm) { setRoleModalError("Passwords do not match."); return; }
    setRolesPassword(pw);
    setRoleModalPasswordInput("");
    setRoleModalInput("");
    setRoleModalError("");
    if (pendingRoleAction?.type === "add") setRoleModalStep("new-name");
    else if (pendingRoleAction?.type === "delete") confirmDeleteRole(pendingRoleAction.name);
  }

  function verifyRolesPassword() {
    if (roleModalPasswordInput !== rolesPassword) { setRoleModalError("Wrong password."); return; }
    setRoleModalPasswordInput("");
    setRoleModalError("");
    if (pendingRoleAction?.type === "add") {
      setRoleModalInput("");
      setRoleModalStep("new-name");
    } else if (pendingRoleAction?.type === "delete") {
      confirmDeleteRole(pendingRoleAction.name);
    }
  }

  function confirmAddRole() {
    const name = roleModalInput.trim();
    if (!name) { setRoleModalError("Enter a name."); return; }
    if (roles[name]) { setRoleModalError("Role already exists."); return; }
    setRoles((prev) => ({ ...prev, [name]: { bankTasks: [], wheelTasks: [], presets: [] } }));
    setRoleModalStep("list");
    setRoleModalInput("");
    setRoleModalError("");
    setPendingRoleAction(null);
  }

  function confirmDeleteRole(name) {
    const allRoles = { ...roles };
    if (Object.keys(allRoles).length <= 1) { setRoleModalError("Cannot delete the only role."); return; }
    delete allRoles[name];
    setRoles(allRoles);
    if (name === currentRole) {
      const fallback = Object.keys(allRoles)[0];
      const d = allRoles[fallback] || {};
      setBankTasks(Array.isArray(d.bankTasks) ? d.bankTasks : []);
      setWheelTasks(Array.isArray(d.wheelTasks) ? d.wheelTasks : []);
      setPresets(Array.isArray(d.presets) ? d.presets : []);
      setCurrentRole(fallback);
      setSelectedTaskId(null);
      setNewTaskLabel("");
      setPresetName("");
      setSelectedPresetId(null);
      setWinnerTaskId(null);
    }
    setRoleModalStep("list");
    setPendingRoleAction(null);
    setRoleModalPasswordInput("");
    setRoleModalError("");
  }

  function exitHelp() {
    setHelpMode(false);
    setHelpStep(0);
    setHelpRect(null);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function enterHelpStep(step) {
    if (step >= HELP_STEPS.length) {
      exitHelp();
      return;
    }
    setHelpStep(step);
    requestAnimationFrame(() => {
      const el = document.querySelector(HELP_STEPS[step].sel);
      if (el) {
        const r = el.getBoundingClientRect();
        const pad = 10;
        setHelpRect({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
      } else {
        setHelpRect(null);
      }
    });
    speakRaw(HELP_STEPS[step].text, "he-IL");
  }

  function startHelp() {
    setHelpMode(true);
    enterHelpStep(0);
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

  return (
    <main className="app-shell">
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="role-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" type="button" onClick={() => setShowRoleModal(false)}>×</button>

            {roleModalStep === "list" && (
              <>
                <h3 className="modal-title">Roles</h3>
                <ul className="role-list">
                  {Object.keys(roles).map((name) => (
                    <li key={name} className={`role-item ${name === currentRole ? "is-current" : ""}`}>
                      <button className="role-name-btn" type="button" onClick={() => switchRole(name)}>
                        {name === currentRole && <span className="role-current-dot">●</span>}
                        {name}
                      </button>
                      {Object.keys(roles).length > 1 && (
                        <button
                          className="role-delete-btn"
                          type="button"
                          onClick={() => startDeleteRole(name)}
                          title={`Delete ${name}`}
                        >
                          🗑️
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <button className="role-add-btn" type="button" onClick={startAddRole}>+ Add Role</button>
              </>
            )}

            {roleModalStep === "set-password" && (
              <>
                <h3 className="modal-title">Set Manager Password</h3>
                <p className="modal-desc">Protects adding and removing roles.</p>
                <input className="modal-input" type="password" placeholder="New password..." value={roleModalPasswordInput} autoFocus onChange={(e) => setRoleModalPasswordInput(e.target.value)} />
                <input className="modal-input" type="password" placeholder="Confirm password..." value={roleModalInput} onChange={(e) => setRoleModalInput(e.target.value)} />
                {roleModalError && <p className="modal-error">{roleModalError}</p>}
                <div className="modal-actions">
                  <button className="modal-cancel-btn" type="button" onClick={() => { setRoleModalStep("list"); setRoleModalError(""); }}>Cancel</button>
                  <button className="modal-confirm-btn" type="button" onClick={confirmSetPassword}>Set Password</button>
                </div>
              </>
            )}

            {roleModalStep === "verify-password" && (
              <>
                <h3 className="modal-title">{pendingRoleAction?.type === "add" ? "Add Role" : `Delete "${pendingRoleAction?.name}"`}</h3>
                <input className="modal-input" type="password" placeholder="Manager password..." value={roleModalPasswordInput} autoFocus onChange={(e) => setRoleModalPasswordInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verifyRolesPassword()} />
                {roleModalError && <p className="modal-error">{roleModalError}</p>}
                <div className="modal-actions">
                  <button className="modal-cancel-btn" type="button" onClick={() => { setRoleModalStep("list"); setRoleModalError(""); setRoleModalPasswordInput(""); }}>Cancel</button>
                  <button className="modal-confirm-btn" type="button" onClick={verifyRolesPassword}>Continue</button>
                </div>
              </>
            )}

            {roleModalStep === "new-name" && (
              <>
                <h3 className="modal-title">New Role Name</h3>
                <input className="modal-input" type="text" placeholder="e.g. Daddy, Mommy..." value={roleModalInput} autoFocus onChange={(e) => setRoleModalInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmAddRole()} />
                {roleModalError && <p className="modal-error">{roleModalError}</p>}
                <div className="modal-actions">
                  <button className="modal-cancel-btn" type="button" onClick={() => { setRoleModalStep("list"); setRoleModalError(""); setRoleModalInput(""); }}>Cancel</button>
                  <button className="modal-confirm-btn" type="button" onClick={confirmAddRole}>Add Role</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {floatingWord && (
        <div key={floatingWord.key} className="floating-callout" aria-live="assertive">
          <span className={`floating-callout-word ${isHebrewText(floatingWord.text) ? "rtl-text" : "ltr-text"}`}>
            {floatingWord.text}
          </span>
        </div>
      )}
      {helpMode && helpRect && (
        <div
          className="help-spotlight"
          style={{ top: helpRect.top, left: helpRect.left, width: helpRect.width, height: helpRect.height }}
        />
      )}
      {helpMode && (
        <div className="help-bubble" dir="rtl">
          <p className="help-step-counter">{helpStep + 1} / {HELP_STEPS.length}</p>
          <p className="help-bubble-text">{HELP_STEPS[helpStep].text}</p>
          <div className="help-bubble-actions">
            <button className="help-exit-btn" type="button" onClick={exitHelp}>סיום</button>
            <button className="help-next-btn" type="button" onClick={() => enterHelpStep(helpStep + 1)}>
              {helpStep + 1 < HELP_STEPS.length ? "הבא ›" : "סיום ✓"}
            </button>
          </div>
        </div>
      )}
      <section className="wheel-area">
        <div className="sky-deco" aria-hidden="true">
          <span
            className="sky-object"
            style={{ left: `${skyObject.left}%`, top: `${skyObject.top}%` }}
          >
            {skyObject.icon}
          </span>
        </div>
        <div className="wheel-headline">
          <div className="wheel-top-bar">
            <h1 className="wheel-title">Spin the Yarin!</h1>
            <div className="top-bar-controls">
              <button
                type="button"
                className="role-btn"
                onClick={openRoleModal}
                title="Switch role"
              >
                👤 {currentRole}
              </button>
              <button
                type="button"
                className="help-btn"
                onClick={startHelp}
                title="עזרה"
                aria-label="Help"
              >
                ?
              </button>
              <button
                type="button"
                className={`mute-btn ${isMuted ? "is-muted" : ""}`}
                data-help="mute-btn"
                onClick={() => setIsMuted((value) => !value)}
                title={isMuted ? "Unmute voice" : "Mute voice"}
                aria-label={isMuted ? "Unmute voice" : "Mute voice"}
              >
                {isMuted ? "🔇" : "🔊"}
              </button>
              <select
                id="theme-select"
                className="theme-select"
                value={themeMode}
                onChange={(event) => setThemeMode(event.target.value)}
                title="Theme"
              >
                {THEME_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="preset-editor" data-help="preset-editor">
            <div className="preset-top-row">
              <input
                className={`preset-input ${isHebrewText(presetName) ? "rtl-text" : "ltr-text"}`}
                type="text"
                placeholder="Preset name..."
                value={presetName}
                disabled={isSpinning}
                onChange={(event) => setPresetName(event.target.value)}
                dir={isHebrewText(presetName) ? "rtl" : "ltr"}
              />
              <select
                className="preset-select"
                value={selectedPresetId || ""}
                onChange={(event) => {
                  const nextId = event.target.value || null;
                  setSelectedPresetId(nextId);
                  const preset = presets.find((item) => item.id === nextId);
                  setPresetName(preset ? preset.name : "");
                  setError("");
                }}
                disabled={isSpinning || !presets.length}
              >
                <option value="">
                  {presets.length ? "Select preset..." : "No presets yet"}
                </option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="preset-actions">
              <button type="button" className="preset-btn" onClick={savePresetAsNew} disabled={isSpinning}>Save New</button>
              <button type="button" className="preset-btn" onClick={updateSelectedPreset} disabled={isSpinning || !selectedPresetId}>Save Edit</button>
              <button type="button" className="preset-btn" onClick={duplicateSelectedPreset} disabled={isSpinning || !selectedPresetId}>Dup</button>
              <button type="button" className="preset-btn danger" onClick={deleteSelectedPreset} disabled={isSpinning || !selectedPresetId}>Remove</button>
              <button type="button" className="preset-btn apply" onClick={applySelectedPreset} disabled={isSpinning || !selectedPresetId}>Apply</button>
            </div>
          </div>

        </div>

        <div
          ref={wheelRef}
          className={`placeholder-wheel ${wheelDropActive ? "drop-active" : ""}`}
          data-help="wheel"
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
                  draggable={!isSpinning && !IS_TOUCH_DEVICE}
                  onDragStart={() => onTaskDragStart("wheel", task.id)}
                  onDragEnd={onTaskDragEnd}
                  onClick={() => speakWord(task.label)}
                  dir={isHebrewText(task.label) ? "rtl" : "ltr"}
                  title={task.label}
                >
                  {task.label}
                </button>
              ))
            ) : (
              <p className="wheel-empty-state">
                {IS_TOUCH_DEVICE ? "Use → to add tasks to the wheel" : "Wheel is empty. Drop tasks here."}
              </p>
            )}
          </div>
        </div>
      </section>

      <aside
        className={`task-bank ${bankDropActive ? "drop-active" : ""}`}
        data-help="bank"
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

        <form className="task-input-row" data-help="task-input" onSubmit={addTask}>
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

        <div className="task-actions" data-help="task-actions">
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
          <button
            className="reset-btn"
            type="button"
            onClick={resetWheel}
            disabled={isSpinning || !wheelTasks.length}
            title="Move all wheel tasks back to bank"
          >
            Reset
          </button>
        </div>

        {error ? <p className="task-error">{error}</p> : null}

        <ol className="task-list" data-help="task-list">
          {bankTasks.length ? (
            bankTasks.map((task) => (
              <li key={task.id}>
                <div className="task-item-row">
                  <button
                    type="button"
                    className={`task-item ${
                      selectedTaskId === task.id ? "is-selected" : ""
                    } ${isHebrewText(task.label) ? "rtl-text" : "ltr-text"}`}
                    draggable={!isSpinning && !IS_TOUCH_DEVICE}
                    onDragStart={() => onTaskDragStart("bank", task.id)}
                    onDragEnd={onTaskDragEnd}
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setNewTaskLabel(task.label);
                      setError("");
                      speakWord(task.label);
                    }}
                    dir={isHebrewText(task.label) ? "rtl" : "ltr"}
                  >
                    {task.label}
                  </button>
                  <button
                    type="button"
                    className="wheel-toggle-btn add"
                    onClick={() => moveTaskToWheel(task.id)}
                    disabled={isSpinning}
                    title="Add to wheel"
                    aria-label="Add to wheel"
                  >
                    →
                  </button>
                </div>
              </li>
            ))
          ) : (
            <li className="empty-state">No tasks yet. Add one above.</li>
          )}
        </ol>

        {wheelTasks.length > 0 && (
          <div className="on-wheel-section">
            <p className="on-wheel-label">On Wheel</p>
            <ol className="task-list">
              {wheelTasks.map((task) => (
                <li key={task.id}>
                  <div className="task-item-row">
                    <button
                      type="button"
                      className={`task-item on-wheel ${isHebrewText(task.label) ? "rtl-text" : "ltr-text"}`}
                      dir={isHebrewText(task.label) ? "rtl" : "ltr"}
                      onClick={() => speakWord(task.label)}
                    >
                      {task.label}
                    </button>
                    <button
                      type="button"
                      className="wheel-toggle-btn remove"
                      onClick={() => moveTaskToBank(task.id)}
                      disabled={isSpinning}
                      title="Remove from wheel"
                      aria-label="Remove from wheel"
                    >
                      ←
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
