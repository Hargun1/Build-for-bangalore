const { computeNaqi, subIndex } = require("../services/airQuality");
const { outdoorScore } = require("../services/environment");

describe("India NAQI (CPCB)", () => {
  test.each([
    ["pm25", 30, 50],
    ["pm25", 45, 75], // (100-51)/(60-31)*(45-31)+51 = 74.7
    ["pm25", 60, 100],
    ["pm10", 100, 100],
    ["pm10", 250, 200],
    ["co", 2.0, 100],
    ["o3", 100, 100],
  ])("%s at %s gives sub-index %s", (pollutant, value, expected) => {
    expect(subIndex(pollutant, value)).toBe(expected);
  });

  test("AQI is the highest sub-index and names the dominant pollutant", () => {
    const r = computeNaqi({ pm25: 45, pm10: 60, no2: 20, o3: 30 });
    expect(r.aqi).toBe(75);
    expect(r.dominant).toBe("PM2.5");
    expect(r.name).toBe("Satisfactory");
  });

  test("needs at least 3 pollutants including PM", () => {
    expect(computeNaqi({ pm25: 40, no2: 10 })).toBeNull();
    expect(computeNaqi({ no2: 10, o3: 20, so2: 5 })).toBeNull();
  });

  test("caps at 500", () => {
    expect(computeNaqi({ pm25: 900, pm10: 900, no2: 10 }).aqi).toBe(500);
  });
});

describe("outdoor score", () => {
  test("clean, mild morning beats a hot, polluted noon", () => {
    expect(outdoorScore({ aqi: 40, feelsLike: 24, uv: 1, rainChance: 0 })).toBe(100);
    expect(outdoorScore({ aqi: 180, feelsLike: 37, uv: 9, rainChance: 0 })).toBeLessThan(40);
  });
});
