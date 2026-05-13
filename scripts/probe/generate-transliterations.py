#!/usr/bin/env python3
"""
generate-transliterations.py — Day 2 transliteration step

Reads odisha-location-graph.json, pipes all name_or fields through
akshharamukha (Oriya script → IAST Latin), stores result in name_en field
when name_en was missing.

Census spellings may differ from transliteration output (e.g., ମେଣ୍ଢାଶାଳ
→ "Meṇḍhāśāla" vs census "Mendhasala"). Founder reviews and stores
corrections as nameEnAlternates. Transliteration is the baseline.
"""

import json
import re
from aksharamukha.transliterate import convert_default

INPUT_PATH = "packages/schema/src/data/odisha-location-graph.json"

def clean_iast(text):
    """Clean IAST diacritics to plain ASCII approximations."""
    replacements = [
        # Virama, visarga, halant, combining marks
        ('̤', ''),   # dot below
        ('़', ''),   # nukta
        ('̐', ''),   # candrabindu
        # Vowels (IAST marks → ASCII)
        ('ā', 'a'), ('ī', 'i'), ('ū', 'u'),
        ('ṛ', 'ri'), ('ṝ', 'ri'),
        ('ė', 'e'), ('ę', 'e'), ('ē', 'e'),
        # Consonants with diacritics
        ('ṁ', 'm'), ('ṃ', 'm'), ('ṅ', 'ng'),
        ('ñ', 'n'),
        ('Ḥ', 'H'), ('ḥ', 'h'),
        ('Ḍ', 'D'), ('ḍ', 'd'),
        ('Ṭ', 'T'), ('ṭ', 't'),
        ('Ṣ', 'S'), ('ṣ', 's'),
        ('ṇ', 'n'), ('ś', 's'),
        # Special vowel signs (Odia u → ü in IAST)
        ('ü', 'u'), ('Ü', 'U'),
        # Common transliteration artifacts
        ('ddh', 'd'),  # ḍdh cluster
    ]
    result = text
    for old, new in replacements:
        result = result.replace(old, new)
    # Title case each word
    result = ' '.join(w.capitalize() for w in result.split())
    return result.strip()

def odia_to_latin(odia_text: str) -> str:
    """Transliterate Odia script to plain Latin via aksharamukha IAST + cleaning."""
    if not odia_text.strip():
        return ""
    try:
        result = convert_default('Oriya', 'IAST', odia_text, True, [], [])
        return clean_iast(result)
    except Exception as e:
        return ""

# Load graph
with open(INPUT_PATH, "r", encoding="utf-8") as f:
    graph = json.load(f)

total_villages = 0
transliterated = 0
skipped_already_have_en = 0
errors = []

# All villages from Bhulekh have name_or in Odia script.
# name_en was set to name_or by the scrape script (Odia-only dropdown entries).
# We need to transliterate name_or → name_en for all villages.

for tehsil in graph["tehsils"]:
    for ri in tehsil["riCircles"]:
        for village in ri["villages"]:
            total_villages += 1

            name_or = village.get("name_or", "")
            if not name_or.strip():
                continue

            latin = odia_to_latin(name_or)
            if latin:
                village["name_en"] = latin
                transliterated += 1
            else:
                errors.append(name_or)

# Save updated graph
with open(INPUT_PATH, "w", encoding="utf-8") as f:
    json.dump(graph, f, ensure_ascii=False, indent=2)

# Report
print("=== Transliteration Report ===")
print(f"Total villages:       {total_villages}")
print(f"Already had name_en:  {skipped_already_have_en}")
print(f"Transliterated:        {transliterated}")
print(f"Transliteration errors:{len(errors)}")

print(f"Already had Latin name_en: {skipped_already_have_en} (none in this dataset)")
print(f"(Bhulekh scrape set name_en = name_or for all villages; we transliterate all now.)")

# Show first 10 transliterated
print("\nFirst 10 transliterations:")
count = 0
for tehsil in graph["tehsils"]:
    for ri in tehsil["riCircles"]:
        for village in ri["villages"]:
            if village.get("name_en") and village["name_en"] != village.get("name_or", "") and count < 10:
                print(f"  {village['name_or']} → {village['name_en']}")
                count += 1

print("\nNote: Census spellings may differ from transliteration output.")
print("Founder reviews and stores corrections as nameEnAlternates.")