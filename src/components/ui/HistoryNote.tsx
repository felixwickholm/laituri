/** One quiet line per list that holds seeded rows, instead of a tag on every row. */
export function HistoryNote({ show = true }: { show?: boolean }) {
  return show ? <p className="history-note">Includes a week of demo history.</p> : null;
}
