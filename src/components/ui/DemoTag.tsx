/** Marks a row written at start-up as demo history, so nobody mistakes it for live use. */
export function DemoTag() {
  return <span className="demo-tag">demo history</span>;
}
