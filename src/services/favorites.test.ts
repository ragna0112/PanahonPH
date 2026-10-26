import { describe, expect, it } from "vitest";
import { parseFavorites, serializeFavorites } from "./favorites";
import { MANILA } from "./locations";

describe("versioned favorite metadata", () => {
  it("round-trips location labels, coordinates and stable IDs without weather data", () => {
    const raw = serializeFavorites([MANILA]);
    expect(JSON.parse(raw)).toEqual({
      version: 1,
      locations: [{ ...MANILA, countryCode: "PH" }],
    });
    expect(parseFavorites(raw)).toEqual({ locations: [MANILA], warning: null });
    expect(raw).not.toMatch(/temperature|forecast|fetchedAt/);
  });
  it.each([
    "{",
    "null",
    "[]",
    '{"version":2,"locations":[]}',
    '{"version":1,"locations":{}}',
  ])("recovers corrupt/unsupported storage: %s", (raw) => {
    expect(parseFavorites(raw).locations).toEqual([]);
    expect(parseFavorites(raw).warning).toBeTruthy();
  });
  it("salvages valid entries and deduplicates identity rather than name", () => {
    const good = { ...MANILA, countryCode: "PH" };
    const result = parseFavorites(
      JSON.stringify({
        version: 1,
        locations: [
          good,
          good,
          { ...good, id: 2 },
          { ...good, id: 3, countryCode: "US" },
          { ...good, id: 4, latitude: 100 },
          { ...good, id: 5, name: "" },
          { ...good, id: 6, longitude: "121" },
          { ...good, id: -1 },
        ],
      }),
    );
    expect(result.locations.map((item) => item.id)).toEqual([MANILA.id, 2]);
    expect(result.warning).toBeTruthy();
  });
});
