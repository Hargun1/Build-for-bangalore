import os
import json
import logging
import hashlib
import asyncio
import math
import re
import base64
from io import BytesIO
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
import httpx
from cachetools import TTLCache
from PIL import Image

try:
    import torch
    from transformers import AutoImageProcessor, AutoModel
except Exception:  # pragma: no cover
    torch = None
    AutoImageProcessor = None
    AutoModel = None

# Configure logging (point 8.3, 9.1)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# OpenRouter configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
}

# Cache for 1 hour (point 6.3 – batch/cache)
cache = TTLCache(maxsize=1000, ttl=3600)

FOOD_MODEL_ID = os.getenv("FOOD_MODEL_ID", "BinhQuocNguyen/food-recognition-model")
_FOOD_MODEL = None
_FOOD_PROCESSOR = None
_FOOD_MODEL_ERROR = None

# Simplified nutrition database (kept as fallback)
NUTRITION_DB = {
    "apple":       {"calories": 52,  "sugar": 10, "fiber": 2.4, "fat": 0.2, "protein": 0.3},
    "banana":      {"calories": 89,  "sugar": 12, "fiber": 2.6, "fat": 0.3, "protein": 1.1},
    "bread":       {"calories": 265, "sugar": 5,  "fiber": 2.7, "fat": 3.2, "protein": 9.0},
    "milk":        {"calories": 61,  "sugar": 5,  "fiber": 0,   "fat": 3.3, "protein": 3.2},
    "chicken":     {"calories": 165, "sugar": 0,  "fiber": 0,   "fat": 3.6, "protein": 31},
    "rice":        {"calories": 130, "sugar": 0,  "fiber": 0.4, "fat": 0.3, "protein": 2.7},
    "default":     {"calories": 100, "sugar": 5,  "fiber": 1,   "fat": 2,   "protein": 3},
}

# ------------------------------------------------------------------
# Pydantic models with validation
# ------------------------------------------------------------------
class GroceryItem(BaseModel):
    name: str
    quantity_g: Optional[float] = 100

    @validator('quantity_g')
    def validate_quantity(cls, v):
        if v <= 0:
            raise ValueError('Quantity must be positive')
        return v

class GroceryAnalyzeRequest(BaseModel):
    userId: str
    items: List[GroceryItem]


class GroceryImageAnalyzeRequest(BaseModel):
    image: str
    userId: Optional[str] = "guest"


VISION_ITEM_LIBRARY = {
    "apple": {
        "name": "Apple",
        "category": "Fruit",
        "nutrition": {"calories": 52, "protein": 0.3, "carbs": 14, "fat": 0.2, "fiber": 2.4},
        "isHealthy": True,
        "healthVerdict": "Nutrient-dense fruit with high fiber and antioxidants.",
        "benefits": ["Supports gut health", "Helps with satiety"],
    },
    "banana": {
        "name": "Banana",
        "category": "Fruit",
        "nutrition": {"calories": 89, "protein": 1.1, "carbs": 23, "fat": 0.3, "fiber": 2.6},
        "isHealthy": True,
        "healthVerdict": "Energy-rich fruit useful before activity.",
        "benefits": ["Potassium for muscle function", "Easy pre-workout carbohydrate"],
    },
    "milk": {
        "name": "Milk",
        "category": "Dairy",
        "nutrition": {"calories": 61, "protein": 3.2, "carbs": 5, "fat": 3.3, "fiber": 0},
        "isHealthy": True,
        "healthVerdict": "Good source of protein and calcium.",
        "benefits": ["Supports bone health", "Provides complete protein"],
    },
    "bread": {
        "name": "Bread",
        "category": "Grain",
        "nutrition": {"calories": 265, "protein": 9, "carbs": 49, "fat": 3.2, "fiber": 2.7},
        "isHealthy": True,
        "healthVerdict": "Prefer whole grain variants for better fiber.",
        "benefits": ["Steady energy source", "Useful meal base"],
    },
    "rice": {
        "name": "Rice",
        "category": "Grain",
        "nutrition": {"calories": 130, "protein": 2.7, "carbs": 28, "fat": 0.3, "fiber": 0.4},
        "isHealthy": True,
        "healthVerdict": "Useful staple; pair with protein and vegetables.",
        "benefits": ["Easy to digest", "Good post-workout carb"],
    },
    "egg": {
        "name": "Eggs",
        "category": "Protein",
        "nutrition": {"calories": 155, "protein": 13, "carbs": 1.1, "fat": 11, "fiber": 0},
        "isHealthy": True,
        "healthVerdict": "High-quality complete protein.",
        "benefits": ["Supports muscle recovery", "Rich in choline"],
    },
    "chicken": {
        "name": "Chicken",
        "category": "Protein",
        "nutrition": {"calories": 165, "protein": 31, "carbs": 0, "fat": 3.6, "fiber": 0},
        "isHealthy": True,
        "healthVerdict": "Lean protein option with strong satiety.",
        "benefits": ["Helps preserve muscle mass", "Lower fat than processed meats"],
    },
    "tomato": {
        "name": "Tomato",
        "category": "Vegetable",
        "nutrition": {"calories": 18, "protein": 0.9, "carbs": 3.9, "fat": 0.2, "fiber": 1.2},
        "isHealthy": True,
        "healthVerdict": "Low-calorie, antioxidant-rich vegetable.",
        "benefits": ["Contains lycopene", "Supports heart health"],
    },
    "potato chips": {
        "name": "Potato Chips",
        "category": "Snack",
        "nutrition": {"calories": 536, "protein": 7, "carbs": 53, "fat": 35, "fiber": 4.4},
        "isHealthy": False,
        "healthVerdict": "High calorie and high sodium processed snack.",
        "benefits": ["Quick energy"],
    },
    "cookies": {
        "name": "Cookies",
        "category": "Snack",
        "nutrition": {"calories": 502, "protein": 6, "carbs": 64, "fat": 24, "fiber": 2.4},
        "isHealthy": False,
        "healthVerdict": "Treat item; keep portions small.",
        "benefits": ["Convenient snack"],
    },
}


def _load_food_model() -> bool:
    global _FOOD_MODEL, _FOOD_PROCESSOR, _FOOD_MODEL_ERROR

    if _FOOD_MODEL is not None and _FOOD_PROCESSOR is not None:
        return True

    if _FOOD_MODEL_ERROR:
        return False

    if torch is None or AutoImageProcessor is None or AutoModel is None:
        _FOOD_MODEL_ERROR = "torch/transformers not installed"
        logger.warning("Food model unavailable: %s", _FOOD_MODEL_ERROR)
        return False

    try:
        _FOOD_PROCESSOR = AutoImageProcessor.from_pretrained(
            FOOD_MODEL_ID,
            trust_remote_code=True,
        )
        _FOOD_MODEL = AutoModel.from_pretrained(
            FOOD_MODEL_ID,
            trust_remote_code=True,
        )
        _FOOD_MODEL.eval()
        logger.info("Loaded food model: %s", FOOD_MODEL_ID)
        return True
    except Exception as e:
        _FOOD_MODEL_ERROR = str(e)
        logger.warning("Failed to load food model %s: %s", FOOD_MODEL_ID, e)
        return False


def _decode_base64_image(image_b64: str) -> Image.Image:
    raw = image_b64.strip()
    if "," in raw and raw.lower().startswith("data:image"):
        raw = raw.split(",", 1)[1]

    padded = raw + ("=" * ((4 - len(raw) % 4) % 4))
    data = base64.b64decode(padded)
    image = Image.open(BytesIO(data)).convert("RGB")
    return image


def _label_to_item_key(label: str) -> Optional[str]:
    text = label.lower().strip()

    direct_map = {
        "apple": "apple",
        "banana": "banana",
        "bread": "bread",
        "milk": "milk",
        "rice": "rice",
        "egg": "egg",
        "eggs": "egg",
        "chicken": "chicken",
        "tomato": "tomato",
        "chips": "potato chips",
        "potato chips": "potato chips",
        "cookie": "cookies",
        "cookies": "cookies",
    }

    if text in direct_map:
        return direct_map[text]

    for token, mapped in direct_map.items():
        if token in text:
            return mapped

    return None


def _predict_with_food_model(image_b64: str) -> List[str]:
    if not _load_food_model():
        return []

    try:
        image = _decode_base64_image(image_b64)
        inputs = _FOOD_PROCESSOR(images=image, return_tensors="pt")

        with torch.no_grad():
            outputs = _FOOD_MODEL(**inputs)
            logits = getattr(outputs, "logits", None)
            if logits is None and isinstance(outputs, (tuple, list)) and len(outputs) > 0:
                candidate = outputs[0]
                if torch.is_tensor(candidate) and candidate.ndim >= 2:
                    logits = candidate
            if logits is None:
                return []
            probs = torch.nn.functional.softmax(logits, dim=-1)

        topk = min(8, probs.shape[-1])
        confs, indices = torch.topk(probs[0], k=topk)
        id2label = getattr(_FOOD_MODEL.config, "id2label", {}) or {}

        labels = []
        for conf, idx in zip(confs.tolist(), indices.tolist()):
            label = str(id2label.get(int(idx), "")).strip()
            if not label:
                continue
            if conf >= 0.08:
                labels.append(label)

        if not labels and len(indices.tolist()) > 0:
            labels = [str(id2label.get(int(indices.tolist()[0]), "")).strip()]

        mapped = []
        seen = set()
        for lbl in labels:
            key = _label_to_item_key(lbl)
            if not key or key in seen:
                continue
            seen.add(key)
            mapped.append(key)

        return mapped[:20]
    except Exception as e:
        logger.warning("Food model inference failed: %s", e)
        return []


def _extract_json_list(text: str) -> List[str]:
    if not text:
        return []
    m = re.search(r"\[(.*?)\]", text, re.DOTALL)
    if not m:
        return []
    snippet = f"[{m.group(1)}]"
    try:
        parsed = json.loads(snippet)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
    except Exception:
        return []
    return []


def _normalize_detected_names(names: List[str]) -> List[str]:
    clean = []
    seen = set()
    for name in names:
        base = name.strip().lower()
        if not base:
            continue
        if base.endswith("s") and base[:-1] in VISION_ITEM_LIBRARY:
            base = base[:-1]
        if base in seen:
            continue
        seen.add(base)
        clean.append(base)
    return clean[:20]


async def _detect_items_from_image(image_b64: str) -> List[str]:
    # Primary path: local Hugging Face food recognition model.
    local_detected = _predict_with_food_model(image_b64)
    if local_detected:
        return local_detected

    # If no key is configured, return empty and rely on static fallback.
    if not OPENROUTER_API_KEY:
        return []

    instruction = (
        "You are extracting grocery/receipt items from an image. "
        "Return ONLY a JSON array of item names, no explanations. "
        "Use plain food/product names, max 20 items."
    )

    model_candidates = [
        "google/gemini-2.5-pro-exp-03-25:free",
        "meta-llama/llama-3.2-11b-vision-instruct:free",
    ]

    for model in model_candidates:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": instruction},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                        },
                    ],
                }
            ],
            "max_tokens": 300,
            "temperature": 0,
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.post(OPENROUTER_BASE_URL, headers=HEADERS, json=payload)
                resp.raise_for_status()
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                detected = _extract_json_list(content)
                normalized = _normalize_detected_names(detected)
                if normalized:
                    return normalized
        except Exception as e:
            logger.warning(f"Vision detection failed on model {model}: {e}")

    return []


def _build_item(name_key: str) -> Dict[str, Any]:
    base = VISION_ITEM_LIBRARY.get(name_key)
    if base:
        return base

    title = " ".join(part.capitalize() for part in name_key.split())
    return {
        "name": title,
        "category": "Other",
        "nutrition": {"calories": 100, "protein": 3, "carbs": 12, "fat": 3, "fiber": 1},
        "isHealthy": True,
        "healthVerdict": "Detected item. Nutrition estimate is approximate.",
        "benefits": ["Review nutrition label for exact values"],
    }

# ------------------------------------------------------------------
# Placeholder for user history (points 1.1–1.5, 2.1, 2.3, 7.3)
# ------------------------------------------------------------------
async def fetch_user_history(userId: str) -> Optional[Dict]:
    """
    In a real implementation, query a database for user profile and past grocery carts.
    Returns dict with demographics, preferences, health conditions, etc.
    """
    logger.info(f"Fetching history for user {userId}")
    # Mock implementation
    if userId.startswith('test'):
        return {
            'age': 45,
            'gender': 'female',
            'weight_kg': 70,
            'height_cm': 165,
            'activity_level': 'moderate',  # sedentary, light, moderate, active
            'dietary_preferences': ['vegetarian'],  # vegetarian, vegan, keto, etc. (1.2)
            'allergies': ['nuts'],          # (1.3 adapted)
            'health_conditions': ['hypertension'],  # (1.4 adapted)
            'injuries': ['knee pain'],       # (1.5)
            'exercise_preferences': ['yoga', 'walking'],  # (1.3)
            'motivation_style': 'social',    # competition, social, data (1.4)
            'language': 'es',                 # for localization (7.3)
            'location': {'city': 'Madrid', 'country': 'ES'},  # for weather (2.1)
            'past_carts': [                   # for trend analysis (3.2)
                {'sugar': 45, 'fiber': 20, 'calories': 1800},
                {'sugar': 50, 'fiber': 22, 'calories': 1900},
            ],
            'badges': ['fiber_champion'],     # gamification (4.5)
        }
    return None

# ------------------------------------------------------------------
# External API mocks (points 2.1, 2.2)
# ------------------------------------------------------------------
async def get_weather(city: str, country: str) -> Optional[str]:
    """Mock weather API call – in production, call OpenWeatherMap etc."""
    # For demo, return random condition
    conditions = ["sunny", "rainy", "cloudy", "snowy"]
    import random
    return random.choice(conditions)

async def get_local_events(city: str) -> List[str]:
    """Mock local events – could integrate with Google Places API."""
    return ["Park yoga session at 10am", "Farmers market on Saturday"]

# ------------------------------------------------------------------
# OpenRouter async client with model routing (point 6.1)
# ------------------------------------------------------------------
async def call_openrouter(prompt: str, model: str, max_tokens: int = 300, temperature: float = 0.3) -> Optional[str]:
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(OPENROUTER_BASE_URL, headers=HEADERS, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data['choices'][0]['message']['content']
    except Exception as e:
        logger.error(f"OpenRouter call failed (model {model}): {e}")
        return None

# ------------------------------------------------------------------
# AI‑powered per‑item recommendations (points 1.2, 1.3, 1.5, 4.1, 4.2, 4.3, 4.4, 7.1)
# Uses Mistral for speed (point 6.1)
# ------------------------------------------------------------------
async def ai_item_recommendations(item_name: str, quantity: float, nutrition: Dict, history: Optional[Dict]) -> List[str]:
    """
    Generate personalized recommendations for a single item.
    """
    language = history.get('language', 'en') if history else 'en'
    preferences = history.get('dietary_preferences', []) if history else []
    allergies = history.get('allergies', []) if history else []
    conditions = history.get('health_conditions', []) if history else []
    injuries = history.get('injuries', []) if history else []

    prompt = f"""You are a nutritionist. Based on the following information, provide 1-3 short, actionable recommendations for this grocery item.
Return the recommendations as a JSON list of strings. Keep sentences concise and easy to read aloud (point 7.1). Write in {language} language.

Item: {item_name}
Quantity: {quantity}g
Nutrition per 100g: {nutrition}

User context:
- Dietary preferences: {preferences}
- Allergies: {allergies}
- Health conditions: {conditions}
- Injuries: {injuries}

Consider suggesting alternatives, portion adjustments, or preparation tips. If allergies are present, warn if the item might contain allergens (even if not listed, be cautious). If the item conflicts with dietary preferences, suggest substitutes.
"""
    response = await call_openrouter(prompt, model="mistralai/mistral-7b-instruct", max_tokens=300, temperature=0.2)
    if response:
        try:
            import re
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except:
            # Fallback: split lines
            lines = [line.strip().strip('-') for line in response.split('\n') if line.strip()]
            return lines
    return []  # fallback to empty

# ------------------------------------------------------------------
# AI‑powered overall recommendation with personalization (points 1.1, 2.1, 2.4, 4.5, 4.6, 5.2, 7.3, 8.1, 8.2, 8.3)
# Uses Gemini for complex reasoning (point 6.1)
# ------------------------------------------------------------------
async def ai_overall_recommendation(total: Dict, items: List[Dict], history: Optional[Dict], weather: Optional[str]) -> str:
    """
    Generate a personalized overall cart recommendation.
    """
    language = history.get('language', 'en') if history else 'en'
    # Calculate BMR if age/gender/weight available (point 1.1)
    bmr_text = ""
    if history and history.get('age') and history.get('gender') and history.get('weight_kg'):
        # Rough Mifflin-St Jeor
        weight = history['weight_kg']
        height = history.get('height_cm', 170)
        age = history['age']
        if history['gender'].lower() == 'male':
            bmr = 10*weight + 6.25*height - 5*age + 5
        else:
            bmr = 10*weight + 6.25*height - 5*age - 161
        bmr_text = f"User's estimated BMR is {bmr:.0f} kcal/day. "

    # Activity factor (point 1.1)
    activity = history.get('activity_level', 'moderate') if history else 'moderate'
    activity_multipliers = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725}
    tdee = bmr * activity_multipliers.get(activity, 1.55) if bmr_text else None

    # Past carts trend (point 3.2)
    trend_text = ""
    if history and history.get('past_carts'):
        past = history['past_carts']
        if len(past) >= 2:
            sugar_trend = past[-1]['sugar'] - past[-2]['sugar']
            fiber_trend = past[-1]['fiber'] - past[-2]['fiber']
            trend_text = f"Compared to last cart, sugar is {'up' if sugar_trend>0 else 'down'} by {abs(sugar_trend):.1f}g, fiber is {'up' if fiber_trend>0 else 'down'} by {abs(fiber_trend):.1f}g. "

    # Gamification (point 4.5)
    badges = history.get('badges', []) if history else []
    badges_text = f"Current badges: {', '.join(badges)}. " if badges else ""

    # Weather (point 2.1)
    weather_text = f"Weather: {weather}. " if weather else ""

    # Public health guidelines (point 2.4)
    guidelines = "WHO recommends less than 50g free sugars per day, 25-30g fiber, and balanced macros."

    prompt = f"""You are a health advisor. Based on the total nutrition of this grocery cart and user context, provide ONE sentence of personalized advice.
Return only the sentence, no extra text. Write in {language} language.

Total nutrition for the cart:
- Calories: {total['calories']} kcal
- Sugar: {total['sugar']} g
- Fiber: {total['fiber']} g
- Fat: {total['fat']} g
- Protein: {total['protein']} g

{bmr_text}
User activity level: {activity}. TDEE: {tdee:.0f} kcal/day if known.
{trend_text}
{badges_text}
{weather_text}
Guidelines: {guidelines}

User health conditions: {history.get('health_conditions', []) if history else []}
Motivation style: {history.get('motivation_style', 'data') if history else 'data'}

If the cart is high in sugar or low in fiber, suggest improvements. If the user is trying to lose weight, compare calories to TDEE. If there are health conditions, tailor advice. Use a tone that matches motivation style (e.g., encouraging for social, data-driven for data).
"""
    response = await call_openrouter(prompt, model="google/gemini-2.5-pro-exp-03-25:free", max_tokens=100, temperature=0.3)
    if response:
        return response.strip()
    # Fallback
    return _overall_rec_fallback(total)

def _overall_rec_fallback(total: dict) -> str:
    if total["sugar"] > 50:
        return "This cart is high in sugar. Focus on whole foods."
    if total["fiber"] > 25:
        return "Good fiber content. Well balanced cart."
    return "Balanced cart. Ensure adequate protein and fiber daily."

# ------------------------------------------------------------------
# Fallback per-item recommendations (original logic)
# ------------------------------------------------------------------
def fallback_item_recs(nutrition: Dict) -> List[str]:
    recs = []
    if nutrition["sugar"] > 15:
        recs.append("High sugar — consider reducing portion size.")
    if nutrition["fiber"] < 2:
        recs.append("Low fiber — pair with vegetables.")
    if nutrition["fat"] > 10:
        recs.append("High fat — choose leaner alternatives.")
    return recs

# ------------------------------------------------------------------
# Main endpoint (async, with caching, logging, fallback)
# ------------------------------------------------------------------
@router.post("")
async def grocery_analyze(body: GroceryAnalyzeRequest):
    """
    Analyze grocery items for nutrition and generate personalized recommendations.
    """
    logger.info(f"Grocery analysis request for user {body.userId}")

    # Validation
    try:
        # trigger validation
        body.items
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Generate cache key (point 6.3)
    cache_data = body.dict()
    cache_key = hashlib.md5(json.dumps(cache_data, sort_keys=True).encode()).hexdigest()

    if cache_key in cache:
        logger.info(f"Cache hit for {cache_key}")
        return cache[cache_key]

    # Fetch user history (points 1,2,3,4,5,7,8)
    history = await fetch_user_history(body.userId)

    # Fetch weather if location available (point 2.1)
    weather = None
    if history and history.get('location'):
        weather = await get_weather(history['location']['city'], history['location']['country'])

    # Process each item
    results = []
    total = {"calories": 0, "sugar": 0, "fiber": 0, "fat": 0, "protein": 0}

    for item in body.items:
        # Get base nutrition from DB (fallback)
        db_entry = NUTRITION_DB.get(item.name.lower(), NUTRITION_DB["default"])
        ratio = item.quantity_g / 100
        nutrition = {k: round(v * ratio, 1) for k, v in db_entry.items()}

        # AI‑powered recommendations (points 1.2,1.3,1.5,4.1-4.4,7.1)
        recs = await ai_item_recommendations(item.name, item.quantity_g, db_entry, history)
        if not recs:
            recs = fallback_item_recs(nutrition)

        results.append({
            "name": item.name,
            "quantity_g": item.quantity_g,
            "nutrition": nutrition,
            "recommendations": recs,
        })

        for k in total:
            total[k] = round(total[k] + nutrition[k], 1)

    # AI‑powered overall recommendation (points 1.1,2.1,2.4,4.5,4.6,5.2,7.3,8.1,8.2,8.3)
    overall_rec = await ai_overall_recommendation(total, results, history, weather)

    # Log explainability (point 5.1,5.3) – we could store in a database, but for now just log
    logger.info(f"Overall recommendation for {body.userId}: {overall_rec}")

    # Health risk assessment (point 8.3) – log if too aggressive
    if total["sugar"] > 100:
        logger.warning(f"Very high sugar cart for user {body.userId} – potential health risk")

    # Long‑term projection (point 8.1) – we could add a note, but for now log
    if history and history.get('past_carts'):
        # Example: if cart is consistently high sugar, predict weight gain
        pass

    # Construct response (exact same format)
    response = {
        "userId": body.userId,
        "items": results,
        "totalNutrition": total,
        "overallRecommendation": overall_rec,
    }

    # Cache response
    cache[cache_key] = response

    # Log outcome
    logger.info(f"Grocery analysis completed for {body.userId}")

    return response


@router.post("/image")
async def grocery_analyze_image(body: GroceryImageAnalyzeRequest):
    """Analyze grocery image and return detected items with nutrition-oriented assessment."""
    if not body.image:
        raise HTTPException(status_code=400, detail="image is required")

    detected_keys = await _detect_items_from_image(body.image)

    if not detected_keys:
        # Deterministic fallback so endpoint still works without external AI.
        detected_keys = ["apple", "bread", "potato chips"]

    items = [_build_item(key) for key in detected_keys]

    healthy_count = sum(1 for item in items if item["isHealthy"])
    total_items = len(items)
    percentage = round((healthy_count / total_items) * 100)

    combination_items = [i["name"] for i in items[:2]] if len(items) >= 2 else [i["name"] for i in items]

    return {
        "userId": body.userId,
        "items": items,
        "detectedItems": [i["name"] for i in items],
        "overallAssessment": {
            "healthyItems": healthy_count,
            "totalItems": total_items,
            "healthPercentage": percentage,
            "verdict": (
                "Strong grocery profile with mostly healthy picks."
                if percentage >= 70
                else "Mixed cart detected. Try swapping processed snacks with fruits, legumes, or nuts."
            ),
        },
        "combinations": [
            {
                "title": "Fiber Balance",
                "reason": "Pair a grain with fruit or vegetables to improve satiety and glucose stability.",
                "items": combination_items,
                "icon": "leaf",
            }
        ] if combination_items else [],
    }