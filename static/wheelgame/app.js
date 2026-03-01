const { useMemo } = React;

function App() {
  const starterTasks = useMemo(
    () => ["Brush teeth", "Story time", "Tidy toys", "Water plants"],
    []
  );

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
            <span className="pill">Milestone 1 complete</span>
          </div>
        </div>
      </section>

      <aside className="task-bank">
        <h2>Task Bank</h2>
        <p>Add, delete, and drag tasks from here in the next milestone.</p>
        <ol className="task-list">
          {starterTasks.map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ol>
      </aside>
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
