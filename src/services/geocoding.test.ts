import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLocations, searchLocations } from "./geocoding";
import { locationDetails } from "./locations";

const place = {
  id: 1,
  name: "San Jose",
  latitude: 12.35,
  longitude: 121.07,
  country_code: "PH",
  feature_code: "PPL",
  admin1: "Mimaropa",
  admin2: "Occidental Mindoro",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Philippine geocoding", () => {
  it("asks the API to filter PH before the limit, with a trimmed and encoded query", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ results: [place] })));
    vi.stubGlobal("fetch", fetchMock);
    const locations = await searchLocations("  San Jose, Mimaropa  ");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin).toBe("https://geocoding-api.open-meteo.com");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      name: "San Jose, Mimaropa",
      countryCode: "PH",
      count: "10",
      language: "en",
      format: "json",
    });
    expect(locations[0]).toEqual({
      id: 1,
      name: "San Jose",
      latitude: 12.35,
      longitude: 121.07,
      province: "Occidental Mindoro",
      region: "Mimaropa",
    });
  });
  it.each(["", " ", "a", "ab", " ab "])(
    "skips an empty or short query: %j",
    async (query) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      expect(await searchLocations(query)).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("independently excludes non-PH and missing country codes, even with a Philippine country name", () => {
    expect(
      parseLocations({
        results: [
          place,
          { ...place, id: 2, country_code: "US", country: "Philippines" },
          { ...place, id: 3, country_code: undefined },
          { ...place, id: 4, country_code: "ph" },
        ],
      }).map((value) => value.id),
    ).toEqual([1]);
  });
  it("keeps duplicate names in different places and deduplicates only IDs", () => {
    const results = parseLocations({
      results: [
        place,
        place,
        {
          ...place,
          id: 2,
          latitude: 13.88,
          longitude: 123.51,
          admin1: "Bicol Region",
          admin2: "Camarines Sur",
        },
      ],
    });
    expect(results).toHaveLength(2);
    expect(results.map((value) => value.name)).toEqual([
      "San Jose",
      "San Jose",
    ]);
    expect(results[0].latitude).not.toBe(results[1].latitude);
    expect(locationDetails(results[0])).toBe(
      "Occidental Mindoro, Mimaropa, Philippines",
    );
    expect(locationDetails(results[1])).toBe(
      "Camarines Sur, Bicol Region, Philippines",
    );
  });
  it("allows missing administrative fields without fabricating a province", () => {
    const [result] = parseLocations({
      results: [{ ...place, admin1: undefined, admin2: undefined }],
    });
    expect(locationDetails(result)).toBe("Philippines");
  });
  it("does not offer mountains, abandoned places, or administrative boundaries as populated locations", () => {
    expect(
      parseLocations({
        results: ["MT", "PPLQ", "ADM2"].map((feature_code) => ({
          ...place,
          feature_code,
        })),
      }),
    ).toEqual([]);
  });
  it.each([{}, { results: [] }])(
    "accepts the documented empty-result shape %j",
    (body) => {
      expect(parseLocations(body)).toEqual([]);
    },
  );
  it.each([
    null,
    [],
    { error: true },
    { results: {} },
    { results: [{ ...place, latitude: "12" }] },
    { results: [{ ...place, longitude: 181 }] },
    { results: [{ ...place, id: 1.5 }] },
    { results: [{ ...place, name: "" }] },
  ])("rejects invalid API data %j", (body) => {
    expect(() => parseLocations(body)).toThrow();
  });
  it.each([400, 503])("reports HTTP %s", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status })),
    );
    await expect(searchLocations("Cebu")).rejects.toThrow(`HTTP ${status}`);
  });
  it("reports a rate limit clearly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );
    await expect(searchLocations("Cebu")).rejects.toThrow("Wait a moment");
  });
  it("reports network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(searchLocations("Cebu")).rejects.toThrow(
      "Check your connection",
    );
  });
  it("reports invalid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>")));
    await expect(searchLocations("Cebu")).rejects.toThrow("unreadable data");
  });
  it("preserves caller cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options: RequestInit) =>
        Promise.reject(options.signal?.reason),
      ),
    );
    await expect(
      searchLocations("Cebu", controller.signal),
    ).rejects.toHaveProperty("name", "AbortError");
  });
  it("reports timeout separately from cancellation", async () => {
    const NativeSignal = AbortSignal;
    const timeout = NativeSignal.abort(
      new DOMException("timeout", "TimeoutError"),
    );
    vi.stubGlobal("AbortSignal", {
      timeout: () => timeout,
      any: NativeSignal.any,
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout.reason));
    await expect(searchLocations("Cebu")).rejects.toThrow("timed out");
  });
});
