const { useEffect, useMemo, useState } = React;

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
  const inputIsHebrew = isHebrewText(newTaskLabel);
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
        <div
          className={`placeholder-wheel ${wheelDropActive ? "drop-active" : ""}`}
          style={{ background: wheelGradient }}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggingTask?.source === "bank") {
              setWheelDropActive(true);
            }
          }}
          onDragLeave={() => setWheelDropActive(false)}
          onDrop={onWheelDrop}
        >
          <div>
            <h1>Spin The Wheel</h1>
            <p>
              Drag tasks here to add slices. Drag out to the bank to remove.
            </p>
            <span className="pill">Drag & Drop enabled</span>
            <ul className="wheel-task-list">
              {wheelTasks.length ? (
                wheelTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className={`wheel-task-chip ${
                        isHebrewText(task.label) ? "rtl-text" : "ltr-text"
                      }`}
                      draggable
                      onDragStart={() => onTaskDragStart("wheel", task.id)}
                      onDragEnd={onTaskDragEnd}
                      dir={isHebrewText(task.label) ? "rtl" : "ltr"}
                      title="Drag back to task bank"
                    >
                      {task.label}
                    </button>
                  </li>
                ))
              ) : (
                <li className="empty-state">Wheel is empty. Drop tasks here.</li>
              )}
            </ul>
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
