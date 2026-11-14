import { TOOLS } from "@/lib/mcp/tools";
import { APPROVAL_ROW, NEVER, TOOL_COPY, type Access } from "@/lib/connect/tools";

/** The server's tools in its own order; a tool without plain words yet shows its own description. */
const TOOL_ROWS = TOOLS.map((tool) => ({ name: tool.name, ...(TOOL_COPY[tool.name] ?? { does: tool.description, needs: "agent key" as Access }) }));
const ROWS = [...TOOL_ROWS, APPROVAL_ROW];

const ACCESS_TONE: Record<Access, string> = { open: "open", "agent key": "key", "a person, never an agent": "person" };

/** The server's own tool list, so this table cannot drift from what an agent sees. */
export function ToolTable() {
  return (
    <section className="glass pad cx-tools" aria-labelledby="cx-tools-title">
      <h2 id="cx-tools-title" className="section-title">
        What your agent can do
      </h2>
      <p className="cx-never">{NEVER}</p>
      <details className="cx-tools-more">
        <summary>
          {TOOL_ROWS.length} tools · <a href="/api/v1/openapi.json">OpenAPI</a>
        </summary>
      <div className="cx-table-wrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Tool</th>
              <th scope="col">What it does</th>
              <th scope="col">Needs</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.name} data-human={row === APPROVAL_ROW ? "" : undefined}>
                <th scope="row" className="mono">
                  {row.name}
                </th>
                <td>{row.does}</td>
                <td>
                  <span className="cx-access" data-tone={ACCESS_TONE[row.needs]}>
                    {row.needs}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </details>
    </section>
  );
}
