import { TOOLS } from "@/lib/mcp/tools";
import { APPROVAL_ROW, NEVER, TOOL_COPY, type Access } from "@/lib/connect/tools";

const ROWS = [...TOOLS.map((tool) => ({ name: tool.name, ...TOOL_COPY[tool.name] })), APPROVAL_ROW];

const ACCESS_TONE: Record<Access, string> = { open: "open", "agent key": "key", "a person, never an agent": "person" };

/** The server's own tool list, so this table cannot drift from what an agent sees. */
export function ToolTable() {
  return (
    <section className="cx-tools" aria-labelledby="cx-tools-title">
      <h2 id="cx-tools-title">What your agent can do</h2>
      <p className="cx-sub">Seven MCP tools. The same operations are plain REST endpoints in the OpenAPI document.</p>
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
      <p className="cx-never">{NEVER}</p>
    </section>
  );
}
