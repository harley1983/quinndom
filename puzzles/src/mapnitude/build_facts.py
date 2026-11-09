"""Build data/mapnitude-facts.json: one row per game country with population, area, highest point and capital coordinates.
Run from the mapnitude folder:  python3 build_facts.py <quinndom repo path>      (needs internet for the downloads below, run once)

Sources (all fetched Nov 2026):
  population  datasets/population on GitHub, most recent year = 2025 (World Bank / UN series)
  area, ISO3 mledoze/countries (the data behind restcountries.com), km2 of total area
  capital     the repo's own countries.js (name) + lutangar/cities.json (GeoNames cities, latitude and longitude)
  peaks       data/peaks_wikipedia.tsv, copied from Wikipedia "List of elevation extremes by country"
"""
import csv, io, json, re, sys, urllib.request, collections

repo = sys.argv[1] if len(sys.argv) > 1 else "../quinndom"
get = lambda u: urllib.request.urlopen(u, timeout=120).read()

rows = re.findall(r'\["([A-Z]{2})", "([^"]+)", "([^"]+)", "([A-Z]{2})"', open(f"{repo}/js/countries.js", encoding="utf-8").read())
game = {c: dict(code=c, name=n, capital=cap, continent=ct) for c, n, cap, ct in rows}
assert len(game) == 194, len(game)

# --- area + ISO3 -------------------------------------------------------------------------------------------------
ml = json.loads(get("https://raw.githubusercontent.com/mledoze/countries/master/countries.json"))
by2 = {c["cca2"]: c for c in ml}
for c, g in game.items():
    m = by2[c]; g["iso3"] = m["cca3"]; g["area"] = round(m["area"])

# --- population (latest year in the dataset) --------------------------------------------------------------------
pop = {}
for r in csv.DictReader(io.StringIO(get("https://raw.githubusercontent.com/datasets/population/main/data/population.csv").decode())):
    y = int(r["Year"])
    if r["Country Code"] not in pop or y > pop[r["Country Code"]][0]: pop[r["Country Code"]] = (y, int(float(r["Value"])))
for g in game.values():
    if g["iso3"] in pop: y, v = pop[g["iso3"]]; g["population"] = v; g["popYear"] = y      # a few states (Holy See) are not in the series: no population question for them

# --- highest points -------------------------------------------------------------------------------------------------
ALIAS = {"Cape Verde": "Cabo Verde", "Czech Republic": "Czechia", "Democratic Republic of the Congo": "DR Congo", "Republic of the Congo": "Congo",
         "Federated States of Micronesia": "Micronesia", "Ivory Coast": "Côte d'Ivoire", "Turkey": "Türkiye", "Eswatini": "Eswatini", "Timor-Leste": "Timor-Leste"}
names = {g["name"].lower(): c for c, g in game.items()}
extra = {}
for line in open(f"{repo}/js/countries.js", encoding="utf-8"):
    m = re.match(r'\s*\["([A-Z]{2})", "[^"]+", "[^"]+", "[A-Z]{2}"(?:, \[(.*)\])?\]', line)
    if m and m.group(2):
        for a in re.findall(r'"([^"]+)"', m.group(2)): extra[a.lower()] = m.group(1)
AMBIGUOUS = {"NL": "highest point of the Kingdom, not of the European country", "SA": "two peaks are claimed", "BW": "two hills are tied", "RS": "depends on whether Kosovo counts"}
for line in open("data/peaks_wikipedia.tsv", encoding="utf-8"):
    country, peak, m = line.rstrip("\n").split("|")
    key = country.lower(); code = names.get(key) or extra.get(key) or names.get(ALIAS.get(country, "").lower())
    if not code: print("no match for peak row:", country); continue
    game[code]["peak"] = peak; game[code]["peakM"] = int(m)
    if code in AMBIGUOUS: game[code]["peakNote"] = AMBIGUOUS[code]

# --- capital coordinates --------------------------------------------------------------------------------------------
cities = json.loads(get("https://raw.githubusercontent.com/lutangar/cities.json/master/cities.json"))
idx = collections.defaultdict(list)
for c in cities: idx[c["country"]].append(c)
fold = lambda s: re.sub(r"[^a-z]", "", __import__("unicodedata").normalize("NFKD", s.lower()).encode("ascii", "ignore").decode())
for code, g in game.items():
    want = fold(g["capital"]); cand = [c for c in idx.get(code, []) if fold(c["name"]) == want]
    if cand: g["capLat"], g["capLon"] = round(float(cand[0]["lat"]), 2), round(float(cand[0]["lng"]), 2)

# capitals the city list spells differently (or that are disputed: Palestine is left without coordinates on purpose)
FIX = {"AG": (17.12, -61.85), "GD": (12.05, -61.75), "MN": (47.92, 106.92), "MM": (19.76, 96.08), "LK": (6.90, 79.92), "US": (38.90, -77.04)}
for code, (la, lo) in FIX.items(): game[code]["capLat"], game[code]["capLon"] = la, lo

game["VA"]["area"] = 0.44                       # the Holy See is under 1 km2, which the area list rounds to 0
from wordfreq import zipf_frequency             # how common the country's name is in English: used for Easy / Normal / Hard picks
for g in game.values(): g["fame"] = round(zipf_frequency(g["name"], "en"), 2)

missing = {k: [c for c, g in game.items() if k not in g] for k in ("peakM", "capLat", "population", "area")}
print({k: v for k, v in missing.items() if v})
json.dump(sorted(game.values(), key=lambda g: g["code"]), open("data/mapnitude-facts.json", "w"), ensure_ascii=False, indent=0)
