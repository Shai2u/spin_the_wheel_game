const { useEffect, useMemo, useState } = React;

const STORAGE_KEY = "wheelgame_task_bank_v1";

function normalizeTaskLabel(value) {
  return value.trim().replace(/\s+/g, " ");
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
      return Array.isArray(parsed) ? parsed : starterTasks;
    } catch {
      return starterTasks;
    }
  });
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bankTasks));
  }, [bankTasks]);

  function addTask(event) {
    event.preventDefault();
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

  function deleteSelectedTask() {
    if (!selectedTaskId) {
      setError("Select one task, then press trash.");
      return;
    }

    setBankTasks((current) =>
      current.filter((task) => task.id !== selectedTaskId)
    );
    setSelectedTaskId(null);
    setError("");
  }

  return (
    <main className="app-shell">
      <section className="wheel-area">
        <div className="placeholder-wheel">
          <div>
            <h1>Spin The Wheel</h1>
            <p>
              Kid mode is ready. Next step: drag tasks into the wheel slices
              and spin.
            </p>
            <span className="pill">Task Bank UI complete</span>
          </div>
        </div>
      </section>

      <aside className="task-bank">
        <h2>Task Bank</h2>
        <p>Add tasks and remove selected ones with the trash button.</p>

        <form className="task-input-row" onSubmit={addTask}>
          <input
            className="task-input"
            type="text"
            placeholder="Write a new task..."
            value={newTaskLabel}
            onChange={(event) => {
              setNewTaskLabel(event.target.value);
              if (error) setError("");
            }}
            aria-label="New task"
          />
          <button className="add-btn" type="submit">
            Add
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
        </form>

        {error ? <p className="task-error">{error}</p> : null}

        <ol className="task-list">
          {bankTasks.length ? (
            bankTasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className={`task-item ${
                    selectedTaskId === task.id ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setError("");
                  }}
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
