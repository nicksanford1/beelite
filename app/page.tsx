export default function HomePage() {
  return (
    <main className="container">
      <header className="topbar">
        <div>
          <h1 className="logo">Beelite</h1>
          <p className="muted">Flooring takeoff &amp; estimating</p>
        </div>
      </header>

      <section>
        <div className="section-head">
          <h2>Projects</h2>
          <button className="btn" disabled title="Wakes up once we add the database (next step)">
            + New Project
          </button>
        </div>

        <div className="empty">
          No projects yet.
          <br />
          <span className="muted">
            The “New Project” button comes alive in the next step, when we connect the database.
          </span>
        </div>
      </section>
    </main>
  );
}
