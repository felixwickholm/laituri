import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/console/api";
import { Poller } from "@/lib/supplier-console/poller";

const hadDocument = "document" in globalThis;

beforeAll(() => {
  if (!hadDocument) {
    Object.assign(globalThis, { document: { visibilityState: "hidden", addEventListener() {}, removeEventListener() {} } });
  }
});

afterAll(() => {
  if (!hadDocument) Reflect.deleteProperty(globalThis, "document");
});

describe("poller", () => {
  it("joins a load already under way instead of starting a second request", async () => {
    let calls = 0;
    const poller = new Poller(async () => {
      calls += 1;
      return { n: calls };
    }, 1000);
    await Promise.all([poller.refresh(), poller.refresh(), poller.current()]);
    expect(calls).toBe(1);
    expect(await poller.current()).toEqual({ n: 1 });
    expect(calls).toBe(1);
  });

  it("marks a 401 as locked, with no error, and clears it on the next answer", async () => {
    let signedIn = false;
    const poller = new Poller(async () => {
      if (!signedIn) throw new ApiError(401, "A credential is required.", "credential_required");
      return "ok";
    }, 1000);
    await poller.refresh();
    expect(poller.getSnapshot()).toEqual({ locked: true });
    signedIn = true;
    await poller.refresh();
    expect(poller.getSnapshot().locked).toBeUndefined();
    expect(poller.getSnapshot().data).toBe("ok");
  });

  it("keeps the last data and names the failure for any other error", async () => {
    let fail = false;
    const poller = new Poller(async () => {
      if (fail) throw new Error("The server did not answer.");
      return 1;
    }, 1000);
    await poller.refresh();
    fail = true;
    await poller.refresh();
    expect(poller.getSnapshot()).toMatchObject({ data: 1, error: "The server did not answer." });
  });
});
