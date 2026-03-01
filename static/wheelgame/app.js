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

function normalizeTaskLabel(value) {
  return value.trim().replace(/\s+/g, " ");
}

function isHebrewText(value) {
  return /[\u0590-\u05FF]/.test(value);
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
  const [bankTasks, setBankTasks] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return starterTasks;
    }

    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (Array.isArray(parsed.bankTasks)) {
        return parsed.bankTasks;
      }
      return starterTasks;
    } catch {
      return starterTasks;
    }
  });
  const [wheelTasks, setWheelTasks] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return [];
    }

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed.wheelTasks) ? parsed.wheelTasks : [];
    } catch {
      return [];
    }
  });
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [error, setError] = useState("");
  const [draggingTask, setDraggingTask] = useState(null);
  const [wheelDropActive, setWheelDropActive] = useState(false);
  const [bankDropActive, setBankDropActive] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinDurationMs, setSpinDurationMs] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerTaskId, setWinnerTaskId] = useState(null);
  const inputIsHebrew = isHebrewText(newTaskLabel);
  const wheelRef = useRef(null);
  const spinTimeoutRef = useRef(null);
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

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bankTasks,
        wheelTasks,
      })
    );
  }, [bankTasks, wheelTasks]);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current);
      }
    };
  }, []);

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
    setWheelRotation(targetRotation);

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

    const turns = 6 + Math.random() * 3;
    const targetRotation = wheelRotation + turns * 360 + Math.random() * 360;
    const durationMs = 4200 + Math.random() * 1400;
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
    if (event) {
      event.preventDefault();
    }

    const normalizedLabel = normalizeTaskLabel(newTaskLabel);
    if (!normalizedLabel) {
      setError("Please write a task first.");
      return;
    }

    const exists = bankTasks.some(
      (task) => task.label.toLowerCase() === normalizedLabel.toLowerCase()
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
        task.label.toLowerCase() === normalizedLabel.toLowerCase()
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
    const task = wheelTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    setWheelTasks((current) => current.filter((item) => item.id !== taskId));
    setBankTasks((current) => [...current, task]);
    setError("");
  }

  function onTaskDragStart(source, taskId) {
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
          </div>
          <p className="wheel-help">You can also drag the wheel to spin it.</p>
          {winnerTaskId ? (
            <p className="winner-line">
              Selected:{" "}
              {wheelTasks.find((task) => task.id === winnerTaskId)?.label || ""}
            </p>
          ) : null}
        </div>

        <div
          ref={wheelRef}
          className={`placeholder-wheel ${wheelDropActive ? "drop-active" : ""}`}
          onPointerDown={onWheelPointerDown}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggingTask?.source === "bank") {
              setWheelDropActive(true);
            }
          }}
          onDragLeave={() => setWheelDropActive(false)}
          onDrop={onWheelDrop}
        >
          <div className="wheel-needle" />
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
            onChange={(event) => {
              setNewTaskLabel(event.target.value);
              if (error) setError("");
            }}
            aria-label="New task"
            dir={inputIsHebrew ? "rtl" : "ltr"}
          />
        </form>

        <div className="task-actions">
          <button className="add-btn" type="button" onClick={addTask}>
            Add
          </button>
          <button className="edit-btn" type="button" onClick={editSelectedTask}>
            Edit
          </button>
          <button
            className="trash-btn"
            type="button"
            onClick={deleteSelectedTask}
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
                  draggable
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
