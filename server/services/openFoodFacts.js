const axios = require("axios");
const env = require("../config/env");
const { HttpError } = require("../middleware/errors");

// Open Food Facts: free, open database of packaged foods (no API key). Its terms ask
// every client to send a descriptive User-Agent.
const BASE = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS = [
  "product_name", "product_name_en", "brands", "quantity", "serving_size", "image_front_small_url",
  "nutriscore_grade", "nova_group", "nutriments", "ingredients_text", "ingredients_text_en",
  "allergens_tags", "additives_tags", "categories_tags", "labels_tags",
].join(",");

const NUTRIENTS = ["energy-kcal", "proteins", "carbohydrates", "sugars", "fat", "saturated-fat", "fiber", "salt", "sodium"];

const cache = new Map(); // barcode -> { at, value }; products rarely change
const TTL_MS = 24 * 3600 * 1000;

const clean = (tags = []) => tags.map((t) => t.replace(/^[a-z]{2}:/, "").replace(/-/g, " ")).filter(Boolean);

function normalise(code, p) {
  const n = p.nutriments || {};
  const per100g = {};
  for (const key of NUTRIENTS) {
    const v = n[`${key}_100g`];
    if (typeof v === "number") per100g[key] = Math.round(v * 100) / 100;
  }
  const grade = (p.nutriscore_grade || "").toLowerCase();
  return {
    barcode: code,
    name: p.product_name_en || p.product_name || "Unnamed product",
    brand: (p.brands || "").split(",")[0].trim(),
    quantity: p.quantity || "",
    servingSize: p.serving_size || "",
    image: p.image_front_small_url || "",
    nutriScore: /^[a-e]$/.test(grade) ? grade : null,
    novaGroup: [1, 2, 3, 4].includes(Number(p.nova_group)) ? Number(p.nova_group) : null,
    per100g,
    ingredients: (p.ingredients_text_en || p.ingredients_text || "").slice(0, 2000),
    allergens: clean(p.allergens_tags),
    additives: clean(p.additives_tags).map((a) => a.toUpperCase()),
    categories: clean(p.categories_tags).slice(0, 8),
    vegetarian: (p.labels_tags || []).includes("en:vegetarian") ? true : (p.labels_tags || []).includes("en:non-vegetarian") ? false : null,
    source: "Open Food Facts",
    sourceUrl: `https://world.openfoodfacts.org/product/${code}`,
  };
}

async function getProduct(barcode) {
  const code = String(barcode).replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) throw new HttpError(400, "A barcode has 8 to 14 digits.");
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let data;
  try {
    ({ data } = await axios.get(`${BASE}/${code}`, { params: { fields: FIELDS }, headers: { "User-Agent": env.userAgent }, timeout: 10000 }));
  } catch (err) {
    if (err.response?.status === 404) data = { status: 0 };
    else throw new HttpError(502, "Open Food Facts is not responding. Please try again.");
  }
  if (!data || data.status === 0 || !data.product) {
    throw new HttpError(404, "This product isn't in Open Food Facts yet. You can add it at openfoodfacts.org.");
  }
  const value = normalise(code, data.product);
  cache.set(code, { at: Date.now(), value });
  return value;
}

module.exports = { getProduct, normalise };
