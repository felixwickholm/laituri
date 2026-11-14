import type { Verdict } from "../harness";

/** Collects expectations for one case. Failures become the evidence; with none, the notes do. */
export class Checks {
  private readonly failures: string[] = [];
  private readonly notes: string[] = [];

  expect(ok: boolean, failure: string): boolean {
    if (!ok) this.failures.push(failure);
    return ok;
  }

  note(text: string): void {
    this.notes.push(text);
  }

  get failed(): boolean {
    return this.failures.length > 0;
  }

  verdict(actual: string): Verdict {
    const evidence = this.failed ? this.failures.join("; ") : this.notes.join("; ");
    return { pass: !this.failed, evidence, actual };
  }
}
