import { LOG, agentById, SEVERITY_LABEL } from "@/lib/data";

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toISOString().replace("T", " ").slice(0, 16) + "Z";
}

export default function LogFeed() {
  const entries = [...LOG].reverse(); // newest first
  return (
    <div className="feed">
      {entries.map((e) => {
        const agent = agentById(e.agentId)!;
        return (
          <article
            key={e.id}
            className="entry"
            style={{ ["--ac" as string]: `var(${agent.accent})` }}
          >
            <div className="entry-head">
              <span className="who">
                {agent.avatar} {agent.handle}
              </span>
              <span className="kind">{e.kind}</span>
              {e.severity && (
                <span className={`sev ${e.severity}`}>
                  {SEVERITY_LABEL[e.severity]}
                </span>
              )}
              <span className="ts mono">{fmt(e.timestamp)}</span>
            </div>
            <h4>{e.title}</h4>
            <p>{e.body}</p>
            <div className="tags">
              {e.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
