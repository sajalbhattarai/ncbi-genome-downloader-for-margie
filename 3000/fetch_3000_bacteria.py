#!/usr/bin/env python3
"""
fetch_3000_bacteria.py  –  resumes from disk cache on subsequent runs.

Steps
-----
1. Paginate NCBI Datasets API for ALL RefSeq complete-genome bacteria
   (reference + representative, non-atypical isolates only, ~6 300 total).
2. Batch-resolve full taxonomy (phylum/class/order/family/genus/species)
   via the NCBI Datasets v2 taxonomy endpoint.
3. Apply a 5-tier rule table (genus > family > order > class > phylum) to
   assign habitat, O2 requirement, gut flag, and pathogenicity.
4. Select <= MAX_PER_GENUS per genus in priority rounds (reference > representative),
   filling until TARGET_COUNT is reached – maximising taxonomic spread.
5. Write
       bacteria_3000.tsv              (tab-separated, 14-column header)
       bacteria_3000_browser.html     (4-level collapsible dark-theme browser)

Usage
-----
    pip install requests
    python3 fetch_3000_bacteria.py           # default target=3000, cap=4
    python3 fetch_3000_bacteria.py --clear-cache   # re-download everything
"""

import argparse, collections, html as htmllib, json, os, sys, time
from pathlib import Path

try:
    import requests
    from requests.adapters import HTTPAdapter, Retry
except ImportError:
    sys.exit("Install requests first:  pip install requests")

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
BASE_DIR   = Path(__file__).parent
CACHE_DIR  = BASE_DIR / "cache"
DATASETS   = "https://api.ncbi.nlm.nih.gov/datasets/v2"
ASSEMBLY_PAGE = 1000
TAX_BATCH     = 80
RETRY_WAIT    = 6   # seconds on 429 / 5xx

FIELDS = [
    "scientific_name","strain","gcf_accession","refseq_category",
    "phylum","class","order","family","genus","species",
    "habitat","oxygen_requirement","gut_flag","pathogenicity",
]

# ---------------------------------------------------------------------------
# HTTP SESSION  (auto-retry 3×)
# ---------------------------------------------------------------------------
def make_session():
    s = requests.Session()
    retries = Retry(total=5, backoff_factor=1,
                    status_forcelist=[429,500,502,503,504],
                    allowed_methods=["GET"])
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.headers.update({"User-Agent": "ncbi-bacteria-collector/1.0"})
    return s

SESSION = make_session()

def get_json(url, params=None, retries=4):
    for attempt in range(retries):
        try:
            r = SESSION.get(url, params=params, timeout=60)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", RETRY_WAIT))
                print(f"  [rate-limit] waiting {wait}s …")
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt == retries-1:
                print(f"  [WARN] {url} failed: {e}")
                return {}
            time.sleep(RETRY_WAIT)
    return {}

# ---------------------------------------------------------------------------
# CACHE UTILITIES
# ---------------------------------------------------------------------------
def cache_path(name): return CACHE_DIR / f"{name}.json"

def load_cache(name):
    p = cache_path(name)
    if p.exists():
        with open(p) as f:
            return json.load(f)
    return None

def save_cache(name, obj):
    CACHE_DIR.mkdir(exist_ok=True)
    with open(cache_path(name), "w") as f:
        json.dump(obj, f)

# ---------------------------------------------------------------------------
# STEP 1 – FETCH ALL ASSEMBLIES
# ---------------------------------------------------------------------------
def fetch_assemblies():
    cached = load_cache("assemblies_raw")
    if cached is not None:
        print(f"[cache] Loaded {len(cached)} assemblies from disk.")
        return cached

    print("Fetching all reference/representative complete-genome bacteria …")
    url = f"{DATASETS}/genome/taxon/bacteria/dataset_report"
    params = {
        "filters.assembly_level":    "complete_genome",
        "filters.assembly_source":   "refseq",
        "filters.exclude_atypical":  "true",
        "filters.reference_only":    "true",
        "page_size": ASSEMBLY_PAGE,
    }
    records, page_token = [], None
    while True:
        if page_token:
            params["page_token"] = page_token
        data    = get_json(url, params)
        batch   = data.get("reports", [])
        records.extend(batch)
        total   = data.get("total_count", "?")
        print(f"  {len(records):>5} / {total}")
        page_token = data.get("next_page_token")
        if not page_token:
            break
        time.sleep(0.35)

    save_cache("assemblies_raw", records)
    print(f"Fetched {len(records)} assembly records.")
    return records

# ---------------------------------------------------------------------------
# STEP 2 – RESOLVE TAXONOMY
# ---------------------------------------------------------------------------
def fetch_taxonomy(taxids):
    """Return dict: taxid -> classification dict."""
    cached = load_cache("taxonomy_map")
    if cached is not None:
        # check all needed taxids are present
        taxids_s = {str(t) for t in taxids}
        if taxids_s.issubset(set(cached.keys())):
            print(f"[cache] Loaded {len(cached)} taxonomy records from disk.")
            return cached
        else:
            missing = taxids_s - set(cached.keys())
            print(f"[cache] {len(cached)} cached; {len(missing)} missing – fetching …")
            tax_map = dict(cached)
            taxids  = [t for t in taxids if str(t) not in cached]
    else:
        tax_map = {}

    url = f"{DATASETS}/taxonomy/taxon"
    batches = [taxids[i:i+TAX_BATCH] for i in range(0, len(taxids), TAX_BATCH)]
    for idx, batch in enumerate(batches):
        ids_str = ",".join(str(t) for t in batch)
        data = get_json(f"{url}/{ids_str}/dataset_report")
        for rep in data.get("reports", []):
            cls = rep.get("taxonomy", {}).get("classification", {})
            tid = rep.get("taxonomy", {}).get("tax_id")
            if tid:
                tax_map[str(tid)] = {
                    "phylum":  cls.get("phylum",  {}).get("name", ""),
                    "class":   cls.get("class",   {}).get("name", ""),
                    "order":   cls.get("order",   {}).get("name", ""),
                    "family":  cls.get("family",  {}).get("name", ""),
                    "genus":   cls.get("genus",   {}).get("name", ""),
                    "species": cls.get("species", {}).get("name", ""),
                }
        if (idx+1) % 20 == 0:
            print(f"  taxonomy {(idx+1)*TAX_BATCH}/{len(taxids)} …")
            save_cache("taxonomy_map", tax_map)   # checkpoint
        time.sleep(0.25)

    save_cache("taxonomy_map", tax_map)
    print(f"Resolved {len(tax_map)} taxonomy records.")
    return tax_map

# ---------------------------------------------------------------------------
# STEP 3 – ECOLOGICAL METADATA RULES
# ---------------------------------------------------------------------------
# Each entry: (habitat, oxygen_requirement, gut_flag, pathogenicity)
# gut_flag  : gut_dominant | gut_associated | non_gut
# pathogenicity: pathogen (human) | pathogen (zoonotic) | pathogen (plant) |
#               pathogen (animal) | opportunistic_pathogen | non_pathogenic

_NP  = "non_pathogenic"
_OP  = "opportunistic_pathogen"
_PH  = "pathogen (human)"
_PZ  = "pathogen (zoonotic)"
_PP  = "pathogen (plant)"
_PA  = "pathogen (animal)"
_GD  = "gut_dominant"
_GA  = "gut_associated"
_NG  = "non_gut"
_OA  = "obligate_anaerobe"
_AE  = "aerobe"
_FA  = "facultative_anaerobe"
_MA  = "microaerophile"
_AN  = "anaerobe"

# ---- genus-level rules (most specific) -------------------------------------
GENUS_RULES = {
    # Bacteroidota – gut dominant
    "Bacteroides":       ("human gut",          _OA, _GD, _NP),
    "Phocaeicola":       ("human gut",          _OA, _GD, _NP),
    "Prevotella":        ("human gut/oral",      _OA, _GD, _NP),
    "Segatella":         ("human gut",          _OA, _GD, _NP),
    "Alloprevotella":    ("human oral",         _OA, _GD, _NP),
    "Alistipes":         ("human gut",          _OA, _GD, _NP),
    "Parabacteroides":   ("human gut",          _OA, _GD, _NP),
    "Akkermansia":       ("human gut",          _AN, _GD, _NP),
    "Porphyromonas":     ("human oral",         _OA, _NG, _OP),
    "Tannerella":        ("human oral",         _OA, _NG, _OP),
    "Treponema":         ("human oral/genital", _AN, _NG, _OP),
    "Borreliella":       ("tick/mammal",        _MA, _NG, _PH),
    "Borrelia":          ("tick/mammal",        _MA, _NG, _PH),
    "Leptospira":        ("soil/water/animal",  _AE, _NG, _PZ),
    # Firmicutes – Lactobacillales
    "Lactobacillus":     ("human gut/dairy",    _AN, _GD, _NP),
    "Lacticaseibacillus":("human gut",          _FA, _GD, _NP),
    "Lactiplantibacillus":("human gut/plant",   _FA, _GD, _NP),
    "Ligilactobacillus": ("human gut/oral",     _AN, _GD, _NP),
    "Limosilactobacillus":("human gut",         _AN, _GD, _NP),
    "Lentilactobacillus":("human gut",          _AN, _GD, _NP),
    "Lactococcus":       ("dairy/plant",        _FA, _NG, _NP),
    "Streptococcus":     ("human throat/naso",  _FA, _NG, _PH),
    "Enterococcus":      ("human gut/clinical", _FA, _GA, _OP),
    "Listeria":          ("soil/food/clinical", _FA, _NG, _PH),
    "Carnobacterium":    ("food/animal",        _FA, _NG, _NP),
    "Leuconostoc":       ("food/plant",         _FA, _NG, _NP),
    "Oenococcus":        ("wine",               _FA, _NG, _NP),
    "Pediococcus":       ("food/plant",         _FA, _NG, _NP),
    "Weissella":         ("food/human gut",     _FA, _GD, _NP),
    "Fructobacillus":    ("flowers/food",       _AN, _NG, _NP),
    # Firmicutes – Clostridia
    "Clostridium":       ("soil/gut",           _OA, _GA, _PH),
    "Clostridioides":    ("human gut",          _OA, _GA, _PH),
    "Agathobacter":      ("human gut",          _OA, _GD, _NP),
    "Roseburia":         ("human gut",          _OA, _GD, _NP),
    "Faecalibacterium":  ("human gut",          _OA, _GD, _NP),
    "Mediterraneibacter":("human gut",          _OA, _GD, _NP),
    "Blautia":           ("human gut",          _OA, _GD, _NP),
    "Coprococcus":       ("human gut",          _OA, _GD, _NP),
    "Dorea":             ("human gut",          _OA, _GD, _NP),
    "Lachnospira":       ("human gut",          _OA, _GD, _NP),
    "Butyrivibrio":      ("rumen/human gut",    _OA, _GD, _NP),
    "Hungatella":        ("human gut",          _OA, _GD, _NP),
    "Intestinimonas":    ("human gut",          _OA, _GD, _NP),
    "Ruminococcus":      ("human gut/rumen",    _OA, _GD, _NP),
    "Oscillibacter":     ("human gut",          _OA, _GD, _NP),
    # Firmicutes – Bacilli
    "Bacillus":          ("soil",               _AE, _NG, _NP),
    "Lysinibacillus":    ("soil",               _AE, _NG, _NP),
    "Paenibacillus":     ("soil",               _FA, _NG, _NP),
    "Brevibacillus":     ("soil",               _AE, _NG, _NP),
    "Geobacillus":       ("hot springs/soil",   _AE, _NG, _NP),
    "Staphylococcus":    ("human skin/clinical",_FA, _NG, _OP),
    # Firmicutes – Negativicutes
    "Veillonella":       ("human gut/oral",     _OA, _GA, _NP),
    "Dialister":         ("human gut/oral",     _OA, _GA, _NP),
    "Megasphaera":       ("human gut",          _OA, _GD, _NP),
    "Selenomonas":       ("rumen/oral",         _OA, _GA, _NP),
    # Actinomycetota
    "Bifidobacterium":   ("human gut",          _AN, _GD, _NP),
    "Gardnerella":       ("human vagina",       _FA, _NG, _OP),
    "Mycobacterium":     ("clinical/soil",      _AE, _NG, _PH),
    "Mycolicibacterium": ("soil",               _AE, _NG, _NP),
    "Mycolicibacter":    ("soil",               _AE, _NG, _NP),
    "Nocardia":          ("soil",               _AE, _NG, _OP),
    "Streptomyces":      ("soil",               _AE, _NG, _NP),
    "Kitasatospora":     ("soil",               _AE, _NG, _NP),
    "Saccharopolyspora": ("soil",               _AE, _NG, _NP),
    "Corynebacterium":   ("soil/clinical",      _AE, _NG, _OP),
    "Propionibacterium": ("dairy",              _AN, _NG, _NP),
    "Cutibacterium":     ("human skin",         _AN, _NG, _OP),
    "Eggerthella":       ("human gut",          _OA, _GD, _NP),
    "Collinsella":       ("human gut",          _OA, _GD, _NP),
    "Gordonibacter":     ("human gut",          _OA, _GD, _NP),
    "Coriobacterium":    ("human gut",          _OA, _GD, _NP),
    "Tropheryma":        ("human gut",          _AE, _GA, _PH),
    # Proteobacteria – Gammaproteobacteria
    "Escherichia":       ("human gut/environment", _FA, _GD, _NP),
    "Shigella":          ("human gut",          _FA, _GA, _PH),
    "Salmonella":        ("animal/human gut",   _FA, _GA, _PH),
    "Klebsiella":        ("human gut/clinical", _FA, _GA, _OP),
    "Enterobacter":      ("human gut/clinical", _FA, _GA, _OP),
    "Cronobacter":       ("environment/clinical",_FA,_NG, _OP),
    "Citrobacter":       ("human gut/environment",_FA,_GA,_OP),
    "Proteus":           ("human gut/clinical", _FA, _GA, _OP),
    "Serratia":          ("clinical/environment",_FA,_NG, _OP),
    "Yersinia":          ("environment/clinical",_FA,_NG, _PH),
    "Hafnia":            ("human gut",          _FA, _GA, _OP),
    "Morganella":        ("clinical",           _FA, _NG, _OP),
    "Pectobacterium":    ("plant",              _FA, _NG, _PP),
    "Dickeya":           ("plant",              _FA, _NG, _PP),
    "Erwinia":           ("plant",              _AE, _NG, _PP),
    "Pantoea":           ("plant/environment",  _FA, _NG, _NP),
    "Pseudomonas":       ("soil/water/clinical",_AE, _NG, _OP),
    "Acinetobacter":     ("clinical/soil",      _AE, _NG, _OP),
    "Moraxella":         ("clinical/animal",    _AE, _NG, _OP),
    "Vibrio":            ("aquatic/coastal",    _FA, _NG, _PH),
    "Photobacterium":    ("marine",             _FA, _NG, _NP),
    "Aliivibrio":        ("marine",             _FA, _NG, _NP),
    "Haemophilus":       ("human naso/clinical",_FA, _NG, _PH),
    "Pasteurella":       ("animal/clinical",    _FA, _NG, _PA),
    "Mannheimia":        ("animal",             _FA, _NG, _PA),
    "Aggregatibacter":   ("human oral/clinical",_FA, _NG, _PH),
    "Legionella":        ("aquatic/soil",       _AE, _NG, _PH),
    "Xanthomonas":       ("soil/plant",         _AE, _NG, _PP),
    "Stenotrophomonas":  ("clinical/environment",_AE,_NG, _OP),
    "Xylella":           ("plant/insect",       _AE, _NG, _PP),
    "Nitrosomonas":      ("soil/water",         _AE, _NG, _NP),
    "Nitrosospira":      ("soil",               _AE, _NG, _NP),
    "Methylococcus":     ("soil/water",         _AE, _NG, _NP),
    "Coxiella":          ("tick/mammal",        _AE, _NG, _PZ),
    "Francisella":       ("soil/animal",        _AE, _NG, _PH),
    # Proteobacteria – Alphaproteobacteria
    "Caulobacter":       ("freshwater",         _AE, _NG, _NP),
    "Brevundimonas":     ("environment/clinical",_AE,_NG, _OP),
    "Sphingomonas":      ("soil/water",         _AE, _NG, _NP),
    "Rhizorhabdus":      ("soil/water",         _AE, _NG, _NP),
    "Sphingobium":       ("soil",               _AE, _NG, _NP),
    "Novosphingobium":   ("soil",               _AE, _NG, _NP),
    "Rhizobium":         ("soil/rhizosphere",   _AE, _NG, _NP),
    "Sinorhizobium":     ("soil/rhizosphere",   _AE, _NG, _NP),
    "Mesorhizobium":     ("soil/rhizosphere",   _AE, _NG, _NP),
    "Ensifer":           ("soil/rhizosphere",   _AE, _NG, _NP),
    "Agrobacterium":     ("soil/rhizosphere",   _AE, _NG, _PP),
    "Bartonella":        ("arthropod/mammal",   _AE, _NG, _PZ),
    "Brucella":          ("animal/soil",        _AE, _NG, _PZ),
    "Ochrobactrum":      ("soil/clinical",      _AE, _NG, _OP),
    "Rickettsia":        ("arthropod/mammal",   _AE, _NG, _PH),
    "Orientia":          ("mite/mammal",        _AE, _NG, _PH),
    "Anaplasma":         ("tick/mammal",        _AE, _NG, _PZ),
    "Ehrlichia":         ("tick/mammal",        _AE, _NG, _PZ),
    "Wolbachia":         ("insect/nematode",    _AE, _NG, _NP),
    "Gluconobacter":     ("plant/fruit",        _AE, _NG, _NP),
    "Acetobacter":       ("plant/fruit",        _AE, _NG, _NP),
    "Magnetospirillum":  ("freshwater",         _MA, _NG, _NP),
    "Rhodospirillum":    ("freshwater",         _FA, _NG, _NP),
    "Rhodopseudomonas":  ("soil/freshwater",    _FA, _NG, _NP),
    # Proteobacteria – Betaproteobacteria
    "Neisseria":         ("human naso/clinical",_AE, _NG, _PH),
    "Burkholderia":      ("soil/clinical",      _AE, _NG, _OP),
    "Ralstonia":         ("soil/plant",         _AE, _NG, _PP),
    "Cupriavidus":       ("soil/clinical",      _AE, _NG, _OP),
    "Paraburkholderia":  ("soil/rhizosphere",   _AE, _NG, _NP),
    "Bordetella":        ("human respiratory",  _AE, _NG, _PH),
    "Achromobacter":     ("soil/clinical",      _AE, _NG, _OP),
    "Alcaligenes":       ("soil/clinical",      _AE, _NG, _OP),
    "Comamonas":         ("soil/water",         _AE, _NG, _NP),
    "Delftia":           ("soil/clinical",      _AE, _NG, _NP),
    "Methylophilaceae":  ("freshwater",         _AE, _NG, _NP),
    "Janthinobacterium": ("soil",               _AE, _NG, _NP),
    # Proteobacteria – Deltaproteobacteria/Desulfobacterota
    "Desulfovibrio":     ("sediment/gut",       _OA, _GA, _NP),
    "Nitratidesulfovibrio":("sediment/gut",     _OA, _GA, _NP),
    "Desulfobacter":     ("sediment",           _OA, _NG, _NP),
    "Desulfobacterium":  ("sediment",           _OA, _NG, _NP),
    "Geobacter":         ("sediment/soil",      _AN, _NG, _NP),
    "Bdellovibrio":      ("soil/freshwater",    _AE, _NG, _NP),
    "Myxococcus":        ("soil",               _AE, _NG, _NP),
    "Stigmatella":       ("soil",               _AE, _NG, _NP),
    "Cystobacter":       ("soil",               _AE, _NG, _NP),
    # Epsilonproteobacteria / Campylobacterota
    "Helicobacter":      ("human stomach",      _MA, _GD, _PH),
    "Campylobacter":     ("poultry/human gut",  _MA, _GA, _PH),
    "Arcobacter":        ("food/environment",   _MA, _NG, _OP),
    "Nautilia":          ("hydrothermal vent",  _AN, _NG, _NP),
    # Spirochaetota
    "Spirochaeta":       ("freshwater/marine",  _AN, _NG, _NP),
    "Sphaerochaeta":     ("sediment",           _AN, _NG, _NP),
    # Fusobacteriota
    "Fusobacterium":     ("human gut/oral",     _AN, _GA, _OP),
    "Ilyobacter":        ("sediment",           _AN, _NG, _NP),
    # Chlamydiota
    "Chlamydia":         ("human cells",        _AE, _NG, _PH),
    "Parachlamydia":     ("amoeba/human cells", _AE, _NG, _OP),
    "Waddlia":           ("tick/mammal",        _AE, _NG, _PZ),
    # Deinococcota
    "Deinococcus":       ("soil/radioactive env",_AE,_NG, _NP),
    "Thermus":           ("hot springs",        _AE, _NG, _NP),
    "Meiothermus":       ("hot springs",        _AE, _NG, _NP),
    # Cyanobacteriota
    "Synechococcus":     ("marine/freshwater",  _AE, _NG, _NP),
    "Synechocystis":     ("freshwater",         _AE, _NG, _NP),
    "Prochlorococcus":   ("marine (open ocean)",_AE, _NG, _NP),
    "Anabaena":          ("freshwater",         _AE, _NG, _NP),
    "Trichormus":        ("freshwater",         _AE, _NG, _NP),
    "Nostoc":            ("soil/freshwater",    _AE, _NG, _NP),
    "Microcystis":       ("freshwater",         _AE, _NG, _NP),
    "Gloeobacter":       ("rock",               _AE, _NG, _NP),
    "Cyanobacterium":    ("freshwater/marine",  _AE, _NG, _NP),
    "Arthrospira":       ("alkaline lake",      _AE, _NG, _NP),
    "Lyngbya":           ("marine/freshwater",  _AE, _NG, _NP),
    # Chloroflexota
    "Chloroflexus":      ("hot springs",        _FA, _NG, _NP),
    "Roseiflexus":       ("hot springs",        _AE, _NG, _NP),
    "Dehalococcoides":   ("groundwater",        _OA, _NG, _NP),
    "Dehalogenimonas":   ("groundwater",        _OA, _NG, _NP),
    "Anaerolinea":       ("anaerobic sludge",   _OA, _NG, _NP),
    # Aquificota
    "Aquifex":           ("hydrothermal/hot spring",_MA,_NG,_NP),
    "Hydrogenobaculum":  ("acidic hot spring",  _MA, _NG, _NP),
    "Thermodesulfovibrio":("hot spring/hydrothermal",_OA,_NG,_NP),
    # Thermotogota
    "Thermotoga":        ("hydrothermal vent",  _AN, _NG, _NP),
    "Kosmotoga":         ("deep subsurface",    _AN, _NG, _NP),
    "Fervidobacterium":  ("hot spring",         _AN, _NG, _NP),
    "Thermosipho":       ("hydrothermal vent",  _AN, _NG, _NP),
    # Acidobacteriota
    "Acidobacterium":    ("acidic soil",        _FA, _NG, _NP),
    "Solibacter":        ("soil",               _AE, _NG, _NP),
    "Bryobacter":        ("soil",               _AE, _NG, _NP),
    # Fibrobacterota
    "Fibrobacter":       ("rumen",              _OA, _NG, _NP),
    # Synergistota
    "Aminobacterium":    ("anaerobic sewage/gut",_OA,_GA, _NP),
    "Aminomonas":        ("anaerobic sewage",   _OA, _NG, _NP),
    "Thermanaerovibrio": ("hot spring",         _OA, _NG, _NP),
    # Mycoplasmota
    "Mycoplasmoides":    ("human respiratory/urogenital",_AE,_NG,_PH),
    "Mycoplasma":        ("animal/human",       _AE, _NG, _PH),
    "Ureaplasma":        ("human urogenital",   _AE, _NG, _OP),
    "Spiroplasma":       ("insect/plant",       _AN, _NG, _PA),
    "Phytoplasma":       ("plant/insect",       _AN, _NG, _PP),
    "Mesoplasma":        ("insect",             _FA, _NG, _NP),
    "Acholeplasma":      ("animal/plant",       _FA, _NG, _NP),
    # Nitrospirota
    "Nitrospira":        ("freshwater/wastewater",_AE,_NG, _NP),
    "Leptospira":        ("soil/water/animal",  _AE, _NG, _PZ),
    # Planctomycetota
    "Gemmata":           ("freshwater",         _AE, _NG, _NP),
    "Planctomyces":      ("freshwater/marine",  _AE, _NG, _NP),
    "Rhodopirellula":    ("marine",             _AE, _NG, _NP),
    "Blastopirellula":   ("marine",             _AE, _NG, _NP),
    "Pirellula":         ("aquatic",            _AE, _NG, _NP),
    "Isosphaera":        ("hot spring",         _AE, _NG, _NP),
    # Verrucomicrobiota
    "Akkermansia":       ("human gut",          _AN, _GD, _NP),
    "Rubritalea":        ("marine",             _AE, _NG, _NP),
    "Prosthecochloris":  ("marine/freshwater",  _AN, _NG, _NP),
    # Elusimicrobiota
    "Elusimicrobium":    ("cockroach gut",      _OA, _GA, _NP),
    # Dictyoglomi
    "Dictyoglomus":      ("hot spring",         _AN, _NG, _NP),
    # Caldisericota
    "Caldisericum":      ("hot spring",         _AN, _NG, _NP),
    # Ignavibacteriota
    "Ignavibacterium":   ("hot spring",         _FA, _NG, _NP),
}

FAMILY_RULES = {
    "Bacteroidaceae":      ("human gut",          _OA, _GD, _NP),
    "Prevotellaceae":      ("human gut/oral",      _OA, _GD, _NP),
    "Rikenellaceae":       ("human gut",           _OA, _GD, _NP),
    "Tannerellaceae":      ("human gut",           _OA, _GD, _NP),
    "Porphyromonadaceae":  ("human oral",          _OA, _NG, _OP),
    "Akkermansiaceae":     ("human gut",           _AN, _GD, _NP),
    "Lachnospiraceae":     ("human gut",           _OA, _GD, _NP),
    "Oscillospiraceae":    ("human gut",           _OA, _GD, _NP),
    "Ruminococcaceae":     ("human gut/rumen",     _OA, _GD, _NP),
    "Clostridiaceae":      ("soil/gut",            _OA, _GA, _NP),
    "Peptostreptococcaceae":("human gut/clinical", _OA, _GA, _OP),
    "Eggerthellaceae":     ("human gut",           _OA, _GD, _NP),
    "Atopobiaceae":        ("human gut",           _OA, _GD, _NP),
    "Bifidobacteriaceae":  ("human gut",           _AN, _GD, _NP),
    "Lactobacillaceae":    ("human gut/dairy",     _FA, _GD, _NP),
    "Streptococcaceae":    ("human naso/clinical", _FA, _NG, _PH),
    "Enterococcaceae":     ("human gut/clinical",  _FA, _GA, _OP),
    "Listeriaceae":        ("soil/food/clinical",  _FA, _NG, _PH),
    "Staphylococcaceae":   ("human skin/clinical", _FA, _NG, _OP),
    "Bacillaceae":         ("soil",                _AE, _NG, _NP),
    "Paenibacillaceae":    ("soil",                _FA, _NG, _NP),
    "Veillonellaceae":     ("human gut/oral",      _OA, _GA, _NP),
    "Fusobacteriaceae":    ("human gut/oral",      _AN, _GA, _OP),
    "Mycobacteriaceae":    ("clinical/soil",       _AE, _NG, _PH),
    "Streptomycetaceae":   ("soil",                _AE, _NG, _NP),
    "Corynebacteriaceae":  ("soil/clinical",       _AE, _NG, _OP),
    "Propionibacteriaceae":("dairy/skin",          _AN, _NG, _NP),
    "Rhizobiaceae":        ("soil/rhizosphere",    _AE, _NG, _NP),
    "Brucellaceae":        ("animal/soil",         _AE, _NG, _PZ),
    "Rickettsiaceae":      ("arthropod/mammal",    _AE, _NG, _PH),
    "Caulobacteraceae":    ("freshwater",          _AE, _NG, _NP),
    "Sphingomonadaceae":   ("soil/water",          _AE, _NG, _NP),
    "Enterobacteriaceae":  ("human gut/environment",_FA,_GA, _OP),
    "Pseudomonadaceae":    ("soil/water/clinical", _AE, _NG, _OP),
    "Moraxellaceae":       ("clinical/soil",       _AE, _NG, _OP),
    "Vibrionaceae":        ("aquatic/coastal",     _FA, _NG, _PH),
    "Pasteurellaceae":     ("animal/clinical",     _FA, _NG, _PA),
    "Legionellaceae":      ("aquatic/soil",        _AE, _NG, _PH),
    "Xanthomonadaceae":    ("soil/plant",          _AE, _NG, _PP),
    "Nitrosomonadaceae":   ("soil/water",          _AE, _NG, _NP),
    "Neisseriaceae":       ("human naso/clinical", _AE, _NG, _PH),
    "Burkholderiaceae":    ("soil/clinical",       _AE, _NG, _OP),
    "Campylobacteraceae":  ("poultry/human gut",   _MA, _GA, _PH),
    "Helicobacteraceae":   ("human stomach",       _MA, _GD, _PH),
    "Treponemataceae":     ("human oral/genital",  _AN, _NG, _OP),
    "Borreliaceae":        ("tick/mammal",         _MA, _NG, _PH),
    "Leptospiraceae":      ("soil/water/animal",   _AE, _NG, _PZ),
    "Desulfovibrionaceae": ("sediment/gut",        _OA, _GA, _NP),
    "Geobacteraceae":      ("sediment/soil",       _AN, _NG, _NP),
    "Myxococcaceae":       ("soil",                _AE, _NG, _NP),
    "Chlamydiaceae":       ("human cells",         _AE, _NG, _PH),
    "Deinococcaceae":      ("soil/radioactive env",_AE, _NG, _NP),
    "Thermaceae":          ("hot springs",         _AE, _NG, _NP),
    "Chloroflexaceae":     ("hot springs",         _FA, _NG, _NP),
    "Dehalococcoidaceae":  ("groundwater",         _OA, _NG, _NP),
    "Aquificaceae":        ("hydrothermal",        _MA, _NG, _NP),
    "Thermotogaceae":      ("hydrothermal vent",   _AN, _NG, _NP),
    "Acidobacteriaceae":   ("acidic soil",         _FA, _NG, _NP),
    "Fibrobacteraceae":    ("rumen",               _OA, _NG, _NP),
    "Synergistaceae":      ("anaerobic sewage/gut",_OA, _GA, _NP),
    "Mycoplasmataceae":    ("animal/human",        _AE, _NG, _PH),
    "Nitrospiraceae":      ("freshwater/wastewater",_AE,_NG, _NP),
    "Gemmataceae":         ("freshwater",          _AE, _NG, _NP),
    "Planctomycetaceae":   ("freshwater/marine",   _AE, _NG, _NP),
    "Spirobacillaceae":    ("soil",                _AE, _NG, _NP),
}

ORDER_RULES = {
    "Bacteroidales":       ("human gut",            _OA, _GD, _NP),
    "Lachnospirales":      ("human gut",            _OA, _GD, _NP),
    "Oscillospirales":     ("human gut",            _OA, _GD, _NP),
    "Clostridiales":       ("soil/gut",             _OA, _GA, _NP),
    "Eubacteriales":       ("soil/gut",             _OA, _GA, _NP),
    "Peptostreptococcales":("human gut",            _OA, _GA, _OP),
    "Bifidobacteriales":   ("human gut",            _AN, _GD, _NP),
    "Coriobacteriales":    ("human gut",            _OA, _GD, _NP),
    "Lactobacillales":     ("human gut/dairy",      _FA, _GD, _NP),
    "Bacillales":          ("soil",                 _AE, _NG, _NP),
    "Erysipelothricales":  ("animal/environment",   _FA, _NG, _NP),
    "Veillonellales":      ("human gut/oral",       _OA, _GA, _NP),
    "Fusobacteriales":     ("human gut/oral",       _AN, _GA, _OP),
    "Mycobacteriales":     ("clinical/soil",        _AE, _NG, _OP),
    "Kitasatosporales":    ("soil",                 _AE, _NG, _NP),
    "Propionibacteriales": ("dairy/skin",           _AN, _NG, _NP),
    "Enterobacterales":    ("human gut/environment",_FA, _GA, _OP),
    "Pseudomonadales":     ("soil/water/clinical",  _AE, _NG, _OP),
    "Vibrionales":         ("aquatic/coastal",      _FA, _NG, _PH),
    "Pasteurellales":      ("animal/clinical",      _FA, _NG, _PA),
    "Legionellales":       ("aquatic/soil",         _AE, _NG, _PH),
    "Xanthomonadales":     ("soil/plant",           _AE, _NG, _NP),
    "Hyphomicrobiales":    ("soil/rhizosphere",     _AE, _NG, _NP),
    "Rickettsiales":       ("arthropod/mammal",     _AE, _NG, _PH),
    "Caulobacterales":     ("freshwater",           _AE, _NG, _NP),
    "Sphingomonadales":    ("soil/water",           _AE, _NG, _NP),
    "Neisseriales":        ("human naso/clinical",  _AE, _NG, _PH),
    "Burkholderiales":     ("soil/clinical",        _AE, _NG, _OP),
    "Nitrosomonadales":    ("soil/water",           _AE, _NG, _NP),
    "Campylobacterales":   ("animal/human gut",     _MA, _GA, _PH),
    "Spirochaetales":      ("animal/human",         _AN, _NG, _OP),
    "Leptospirales":       ("soil/water/animal",    _AE, _NG, _PZ),
    "Chlamydiales":        ("human/animal cells",   _AE, _NG, _PH),
    "Deinococcales":       ("soil",                 _AE, _NG, _NP),
    "Thermales":           ("hot springs",          _AE, _NG, _NP),
    "Synechococcales":     ("marine/freshwater",    _AE, _NG, _NP),
    "Nostocales":          ("freshwater/soil",      _AE, _NG, _NP),
    "Chloroflexales":      ("hot springs",          _FA, _NG, _NP),
    "Dehalococcoidales":   ("groundwater",          _OA, _NG, _NP),
    "Aquificales":         ("hydrothermal",         _MA, _NG, _NP),
    "Thermotogales":       ("hydrothermal vent",    _AN, _NG, _NP),
    "Acidobacteriales":    ("acidic soil",          _FA, _NG, _NP),
    "Fibrobacterales":     ("rumen",                _OA, _NG, _NP),
    "Synergistales":       ("anaerobic sewage/gut", _OA, _GA, _NP),
    "Mycoplasmatales":     ("animal/human",         _AE, _NG, _PH),
    "Nitrospirales":       ("freshwater/wastewater",_AE, _NG, _NP),
    "Planctomycetales":    ("freshwater/marine",    _AE, _NG, _NP),
    "Desulfovibrionales":  ("sediment/gut",         _OA, _GA, _NP),
    "Desulfuromonadales":  ("sediment/soil",        _AN, _NG, _NP),
    "Myxococcales":        ("soil",                 _AE, _NG, _NP),
    "Bdellovibrionales":   ("soil/freshwater",      _AE, _NG, _NP),
    "Thermoproteales":     ("hot springs",          _AE, _NG, _NP),
    "Sulfolobales":        ("hot springs (acidic)", _AE, _NG, _NP),
}

CLASS_RULES = {
    "Bacteroidia":         ("human gut",            _OA, _GD, _NP),
    "Clostridia":          ("soil/gut",             _OA, _GA, _NP),
    "Bacilli":             ("soil",                 _FA, _NG, _NP),
    "Negativicutes":       ("human gut/oral",       _OA, _GA, _NP),
    "Erysipelotrichia":    ("animal/environment",   _FA, _NG, _NP),
    "Actinomycetes":       ("soil/clinical",        _AE, _NG, _NP),
    "Coriobacteriia":      ("human gut",            _OA, _GD, _NP),
    "Gammaproteobacteria": ("soil/water/clinical",  _FA, _NG, _OP),
    "Alphaproteobacteria": ("soil/water",           _AE, _NG, _NP),
    "Betaproteobacteria":  ("soil/water/clinical",  _AE, _NG, _NP),
    "Deltaproteobacteria": ("sediment/soil",        _OA, _NG, _NP),
    "Epsilonproteobacteria":("animal/human gut",    _MA, _GA, _PH),
    "Spirochaetia":        ("animal/human",         _AN, _NG, _OP),
    "Fusobacteriia":       ("human gut/oral",       _AN, _GA, _OP),
    "Verrucomicrobiae":    ("soil/water/gut",       _AE, _NG, _NP),
    "Planctomycetia":      ("freshwater/marine",    _AE, _NG, _NP),
    "Chlamydiia":          ("human/animal cells",   _AE, _NG, _PH),
    "Deinococci":          ("soil",                 _AE, _NG, _NP),
    "Cyanophyceae":        ("freshwater/marine",    _AE, _NG, _NP),
    "Chloroflexia":        ("hot springs",          _FA, _NG, _NP),
    "Dehalococcoidia":     ("groundwater",          _OA, _NG, _NP),
    "Aquificia":           ("hydrothermal",         _MA, _NG, _NP),
    "Thermotogae":         ("hydrothermal vent",    _AN, _NG, _NP),
    "Acidobacteriia":      ("acidic soil",          _FA, _NG, _NP),
    "Fibrobacteria":       ("rumen",                _OA, _NG, _NP),
    "Synergistia":         ("anaerobic sewage/gut", _OA, _GA, _NP),
    "Mollicutes":          ("animal/human",         _AE, _NG, _NP),
    "Nitrospira":          ("freshwater/wastewater",_AE, _NG, _NP),
    "Flavobacteriia":      ("freshwater/marine/clinical",_AE,_NG,_NP),
    "Sphingobacteriia":    ("water/clinical",       _AE, _NG, _NP),
    "Chitinophagia":       ("soil",                 _AE, _NG, _NP),
    "Cytophagia":          ("soil",                 _AE, _NG, _NP),
    "Oligoflexia":         ("soil",                 _AE, _NG, _NP),
    "Thermoplasmata":      ("hot springs",          _FA, _NG, _NP),
    "Thermoprotei":        ("hot springs",          _AE, _NG, _NP),
    "Halobacteria":        ("hypersaline",          _AE, _NG, _NP),
    "Methanobacteria":     ("gut/anaerobic env",    _AN, _GA, _NP),
    "Methanococci":        ("marine/anaerobic",     _AN, _NG, _NP),
    "Methanomicrobia":     ("anaerobic sediments",  _AN, _NG, _NP),
    "Thermococci":         ("hydrothermal vent",    _OA, _NG, _NP),
}

PHYLUM_RULES = {
    "Bacteroidota":        ("gut/oral/environment", _OA, _GA, _NP),
    "Bacillota":           ("soil/gut/clinical",    _FA, _GA, _NP),
    "Pseudomonadota":      ("soil/water/clinical",  _AE, _NG, _NP),
    "Actinomycetota":      ("soil/clinical",        _AE, _NG, _NP),
    "Spirochaetota":       ("animal/human",         _AN, _NG, _NP),
    "Fusobacteriota":      ("human gut/oral",       _AN, _GA, _NP),
    "Verrucomicrobiota":   ("soil/water/gut",       _AE, _NG, _NP),
    "Planctomycetota":     ("freshwater/marine",    _AE, _NG, _NP),
    "Chlamydiota":         ("human/animal cells",   _AE, _NG, _PH),
    "Deinococcota":        ("soil",                 _AE, _NG, _NP),
    "Cyanobacteriota":     ("freshwater/marine",    _AE, _NG, _NP),
    "Chloroflexota":       ("hot springs",          _FA, _NG, _NP),
    "Aquificota":          ("hydrothermal",         _MA, _NG, _NP),
    "Thermotogota":        ("hydrothermal vent",    _AN, _NG, _NP),
    "Acidobacteriota":     ("acidic soil",          _FA, _NG, _NP),
    "Fibrobacterota":      ("rumen",                _OA, _NG, _NP),
    "Synergistota":        ("anaerobic sewage",     _OA, _NG, _NP),
    "Mycoplasmota":        ("animal/human",         _AE, _NG, _NP),
    "Nitrospirota":        ("freshwater/soil",      _AE, _NG, _NP),
    "Campylobacterota":    ("animal/human",         _MA, _GA, _NP),
    "Balneolota":          ("saline water",         _AE, _NG, _NP),
    "Bdellovibrionota":    ("soil/freshwater",      _AE, _NG, _NP),
    "Calditrichota":       ("hot spring",           _AN, _NG, _NP),
    "Chrysiogenota":       ("sediment",             _AN, _NG, _NP),
    "Deferribacterota":    ("hydrothermal",         _AN, _NG, _NP),
    "Dictyoglomi":         ("hot spring",           _AN, _NG, _NP),
    "Elusimicrobiota":     ("insect gut",           _OA, _GA, _NP),
    "Ignavibacteriota":    ("hot spring",           _FA, _NG, _NP),
    "Lentisphaerota":      ("human gut",            _AN, _GA, _NP),
    "Thermodesulfobacteriota":("hydrothermal",      _AN, _NG, _NP),
    "Thermomicrobiota":    ("hot spring",           _AE, _NG, _NP),
}

DEFAULT_META = ("unknown habitat", _FA, _NG, _NP)


def infer_meta(genus, family, order, class_, phylum):
    """5-tier lookup for ecological metadata."""
    for rules, key in (
        (GENUS_RULES,  genus),
        (FAMILY_RULES, family),
        (ORDER_RULES,  order),
        (CLASS_RULES,  class_),
        (PHYLUM_RULES, phylum),
    ):
        if key and key in rules:
            return rules[key]
    return DEFAULT_META


# ---------------------------------------------------------------------------
# STEP 4 – SELECTION (diversity-first)
# ---------------------------------------------------------------------------
REFSEQ_PRIORITY = {"reference genome": 0, "representative genome": 1}

def select_genomes(assemblies, tax_map, target=3000, cap=4):
    """
    Assign taxonomy + metadata, then select up to `target` genomes.
    Round-1: best (reference > representative) per genus.
    Round-2+: next best per genus, until target reached.
    Genomes with no resolved genus use organism_name as pseudo-genus.
    """
    # Build enriched records
    enriched = []
    for asm in assemblies:
        gcf   = asm.get("accession", "")
        org   = asm.get("organism", {})
        ai    = asm.get("assembly_info", {})
        name  = org.get("organism_name", "")
        strain= (org.get("infraspecific_names") or {}).get("strain", "")
        tid   = str(org.get("tax_id", ""))
        cat   = ai.get("refseq_category", "representative genome")

        t = tax_map.get(tid, {})
        phylum = t.get("phylum", "")
        class_ = t.get("class",  "")
        order  = t.get("order",  "")
        family = t.get("family", "")
        genus  = t.get("genus",  "")
        species= t.get("species","")

        # fall back to extracting genus from name if taxonomy absent
        if not genus and name:
            genus = name.split()[0]
        if not species and name:
            parts = name.split()
            species = " ".join(parts[:2]) if len(parts) >= 2 else name

        habitat, oxy, gut, path = infer_meta(genus, family, order, class_, phylum)

        enriched.append({
            "scientific_name": name,
            "strain":          strain,
            "gcf_accession":   gcf,
            "refseq_category": cat,
            "phylum":          phylum,
            "class":           class_,
            "order":           order,
            "family":          family,
            "genus":           genus,
            "species":         species,
            "habitat":         habitat,
            "oxygen_requirement": oxy,
            "gut_flag":        gut,
            "pathogenicity":   path,
            "_priority":       REFSEQ_PRIORITY.get(cat, 2),
        })

    # Group by genus, sort within each group by priority (reference first)
    by_genus = collections.defaultdict(list)
    for e in enriched:
        by_genus[e["genus"] or e["scientific_name"]].append(e)
    for lst in by_genus.values():
        lst.sort(key=lambda x: x["_priority"])

    # Round-fill
    selected = []
    for round_idx in range(cap):
        for genus, lst in sorted(by_genus.items()):
            if len(lst) > round_idx:
                candidate = lst[round_idx]
                # avoid duplicates
                if candidate["gcf_accession"] not in {s["gcf_accession"] for s in selected}:
                    selected.append(candidate)
                    if len(selected) >= target:
                        break
        if len(selected) >= target:
            break

    return selected


# ---------------------------------------------------------------------------
# STEP 5a – WRITE TSV
# ---------------------------------------------------------------------------
def write_tsv(organisms, path):
    with open(path, "w", encoding="utf-8") as f:
        f.write("\t".join(FIELDS) + "\n")
        for o in organisms:
            f.write("\t".join(str(o.get(k,"")) for k in FIELDS) + "\n")
    print(f"Wrote {len(organisms)} records  →  {path}")


# ---------------------------------------------------------------------------
# STEP 5b – WRITE COLLAPSIBLE HTML BROWSER
# ---------------------------------------------------------------------------
NCBI_BASE = "https://www.ncbi.nlm.nih.gov/datasets/genome/"

GUT_STYLE = {
    "gut_dominant":   "background:#27ae60;color:#fff",
    "gut_associated": "background:#f39c12;color:#fff",
    "non_gut":        "background:#555;color:#ccc",
}
PATH_STYLE = {
    "pathogen (human)":        "background:#e74c3c;color:#fff",
    "pathogen (zoonotic)":     "background:#c0392b;color:#fff",
    "pathogen (plant)":        "background:#27ae60;color:#fff",
    "pathogen (animal)":       "background:#d35400;color:#fff",
    "opportunistic_pathogen":  "background:#e67e22;color:#fff",
    "non_pathogenic":          "background:#2c3e50;color:#aaa",
}
OXY_ICON = {
    "aerobe":            "☀",
    "anaerobe":          "⚫",
    "anaerobe (methanogen)": "🌀",
    "facultative_anaerobe": "◑",
    "obligate_anaerobe": "⚫",
    "microaerophile":    "💨",
}

CSS = """
:root{--bg:#0f1117;--sur:#1a1d27;--sur2:#22263a;--brd:#2e3350;
      --txt:#e0e4f0;--mut:#8892b0;--acc:#3d5af1;--acc2:#00d4ff}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:'Segoe UI',Arial,sans-serif;
     font-size:13px;line-height:1.5;padding:20px}
h1{font-size:1.6em;color:var(--acc2);margin-bottom:4px}
.sub{color:var(--mut);font-size:.88em;margin-bottom:18px}
.sg{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}
.sc{background:var(--sur);border:1px solid var(--brd);border-radius:7px;
    padding:10px 18px;text-align:center;min-width:80px}
.sn{font-size:1.7em;font-weight:700;color:var(--acc2)}
.sl{font-size:.72em;color:var(--mut);margin-top:2px}
.leg{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;font-size:.8em;color:var(--mut)}
.li{display:flex;align-items:center;gap:5px}
.swatch{width:11px;height:11px;border-radius:2px;display:inline-block}
details{margin:4px 0}
details>summary{cursor:pointer;user-select:none;padding:7px 11px;border-radius:6px;
  background:var(--sur);border:1px solid var(--brd);font-weight:600;list-style:none;
  display:flex;align-items:center;gap:8px}
details>summary::-webkit-details-marker{display:none}
details>summary::before{content:"▶";font-size:.65em;color:var(--acc);transition:transform .15s}
details[open]>summary::before{transform:rotate(90deg)}
details>summary:hover{background:var(--sur2)}
.ds{font-size:1.1em;color:var(--acc2)}
.ps{font-size:.98em;color:#a8d8ea;margin-left:14px}
.cs{font-size:.9em;color:#d4a5f5;margin-left:28px}
.os{font-size:.84em;color:#ffd580;margin-left:42px}
.fs{font-size:.8em;color:#90ee90;margin-left:56px}
.cnt{margin-left:auto;background:var(--brd);padding:1px 7px;border-radius:9px;
     font-size:.74em;font-weight:400;color:var(--mut)}
.tw{overflow-x:auto;margin:6px 0 4px 70px}
table{border-collapse:collapse;width:100%;background:var(--sur);
      border:1px solid var(--brd);border-radius:5px;overflow:hidden}
thead tr{background:var(--sur2)}
th{padding:7px 9px;text-align:left;color:var(--mut);font-size:.78em;
   font-weight:600;border-bottom:1px solid var(--brd);white-space:nowrap}
td{padding:5px 9px;border-bottom:1px solid var(--brd);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:var(--sur2)}
a{text-decoration:none;color:#3498db}
a:hover{text-decoration:underline}
.badge{padding:1px 6px;border-radius:3px;font-size:.76em;white-space:nowrap}
.cat-ref{color:#ffd580;font-size:.75em}
.cat-rep{color:#90ee90;font-size:.75em}
"""

def badge(text, style):
    t = htmllib.escape(str(text))
    return f'<span class="badge" style="{style}">{t}</span>'

def gcf_link(gcf):
    return f'<a href="{NCBI_BASE}{gcf}" target="_blank">{gcf}</a>'

def cat_span(cat):
    cls = "cat-ref" if cat == "reference genome" else "cat-rep"
    short = "REF" if cat == "reference genome" else "REP"
    return f'<span class="{cls}" title="{cat}">{short}</span>'

TABLE_HEAD = """<table><thead><tr>
<th>#</th><th>Scientific Name</th><th>Strain</th>
<th>GCF</th><th>Cat</th><th>O₂</th><th>Habitat</th>
<th>Gut</th><th>Pathogenicity</th>
</tr></thead><tbody>
"""

def org_row(idx, o):
    oxy  = o["oxygen_requirement"]
    icon = OXY_ICON.get(oxy, "○")
    gut  = badge(o["gut_flag"].replace("_"," "), GUT_STYLE.get(o["gut_flag"],""))
    path = badge(o["pathogenicity"].replace("_"," "), PATH_STYLE.get(o["pathogenicity"],""))
    return (
        f"<tr><td style='color:#666'>{idx}</td>"
        f"<td><em>{htmllib.escape(o['scientific_name'])}</em></td>"
        f"<td style='font-size:.82em'>{htmllib.escape(o['strain'])}</td>"
        f"<td style='font-family:monospace'>{gcf_link(o['gcf_accession'])}</td>"
        f"<td>{cat_span(o['refseq_category'])}</td>"
        f"<td title='{oxy}'>{icon}</td>"
        f"<td style='font-size:.8em'>{htmllib.escape(o['habitat'])}</td>"
        f"<td>{gut}</td><td>{path}</td></tr>\n"
    )

def count_unique(orgs, key):
    return len({o[key] for o in orgs if o[key]})

def write_html(organisms, path):
    # Build tree: phylum → class → order → family → [orgs]
    tree = collections.OrderedDict()
    for o in organisms:
        ph = o["phylum"] or "Unknown phylum"
        cl = o["class"]  or "Unknown class"
        od = o["order"]  or "Unknown order"
        fa = o["family"] or "Unknown family"
        tree.setdefault(ph, collections.OrderedDict())
        tree[ph].setdefault(cl, collections.OrderedDict())
        tree[ph][cl].setdefault(od, collections.OrderedDict())
        tree[ph][cl][od].setdefault(fa, [])
        tree[ph][cl][od][fa].append(o)

    stats = {
        "Total": len(organisms),
        "Reference": sum(1 for o in organisms if o["refseq_category"]=="reference genome"),
        "Phyla":    count_unique(organisms, "phylum"),
        "Classes":  count_unique(organisms, "class"),
        "Orders":   count_unique(organisms, "order"),
        "Families": count_unique(organisms, "family"),
        "Genera":   count_unique(organisms, "genus"),
        "Gut":      sum(1 for o in organisms if o["gut_flag"] in ("gut_dominant","gut_associated")),
    }

    lines = []
    L = lines.append
    L("<!DOCTYPE html><html lang='en'><head>")
    L('<meta charset="UTF-8">')
    L('<meta name="viewport" content="width=device-width,initial-scale=1">')
    L("<title>Bacteria Reference Genome Browser</title>")
    L(f"<style>{CSS}</style></head><body>")
    L("<h1>🧬 Bacteria Reference Genome Browser</h1>")
    L('<p class="sub">Complete RefSeq assemblies (reference + representative) • '
      'verified via NCBI Datasets v2 API • click to expand</p>')

    # stat cards
    L('<div class="sg">')
    for lbl, val in stats.items():
        L(f'<div class="sc"><div class="sn">{val}</div><div class="sl">{lbl}</div></div>')
    L('</div>')

    # legend
    L('<div class="leg">')
    L('<span style="font-weight:600;color:var(--txt)">Gut:</span>')
    for k,st in GUT_STYLE.items():
        col = st.split(";")[0].split(":")[1]
        L(f'<span class="li"><span class="swatch" style="background:{col}"></span>{k.replace("_"," ")}</span>')
    L('<span style="font-weight:600;margin-left:14px;color:var(--txt)">Cat:</span>')
    L('<span class="li"><span class="cat-ref">REF</span> reference genome</span>')
    L('<span class="li"><span class="cat-rep">REP</span> representative genome</span>')
    L('</div>')

    # tree
    for ph, classes in tree.items():
    	ph_count = sum(len(fa_orgs) for cls_dict in classes.values() for od_dict in cls_dict.values() for fa_orgs in od_dict.values())
    	L(f"<details open><summary class='ds'>🦠 {htmllib.escape(ph)} <span class='cnt'>{ph_count}</span></summary>")

    	for cl, orders in classes.items():
    		cl_count = sum(len(fa_orgs) for od_dict in orders.values() for fa_orgs in od_dict.values())
    		L(f"<details><summary class='ps'>🔬 {htmllib.escape(cl)} <span class='cnt'>{cl_count}</span></summary>")

    		for od, families in orders.items():
    			od_count = sum(len(fa_orgs) for fa_orgs in families.values())
    			L(f"<details><summary class='cs'>📋 {htmllib.escape(od)} <span class='cnt'>{od_count}</span></summary>")

    			for fa, orgs in families.items():
    				L(f"<details><summary class='os'>📁 {htmllib.escape(fa)} <span class='cnt'>{len(orgs)}</span></summary>")
    				L('<div class="tw">' + TABLE_HEAD)
    				for idx, o in enumerate(orgs, 1):
    					L(org_row(idx, o))
    				L("</tbody></table></div>")
    				L("</details>")  # family

    			L("</details>")  # order
    		L("</details>")  # class
    	L("</details>")  # phylum

    L("</body></html>")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Wrote HTML browser  →  {path}")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target",      type=int, default=3000)
    ap.add_argument("--cap",         type=int, default=4,
                    help="max genomes per genus")
    ap.add_argument("--clear-cache", action="store_true")
    args = ap.parse_args()

    if args.clear_cache:
        import shutil
        if CACHE_DIR.exists():
            shutil.rmtree(CACHE_DIR)
        print("Cache cleared.")

    CACHE_DIR.mkdir(exist_ok=True)

    # Step 1 – assemblies
    assemblies = fetch_assemblies()
    if not assemblies:
        sys.exit("No assemblies retrieved – check connectivity.")

    # Step 2 – taxonomy
    taxids = list({str(a["organism"]["tax_id"]) for a in assemblies
                   if a.get("organism",{}).get("tax_id")})
    print(f"Resolving taxonomy for {len(taxids)} unique taxids …")
    tax_map = fetch_taxonomy(taxids)

    # Step 3 + 4 – select
    print(f"Selecting up to {args.target} genomes (cap {args.cap}/genus) …")
    selected = select_genomes(assemblies, tax_map, target=args.target, cap=args.cap)
    print(f"Selected {len(selected)} genomes.")

    # Step 5 – output
    tsv_path  = BASE_DIR / "bacteria_3000.tsv"
    html_path = BASE_DIR / "bacteria_3000_browser.html"
    write_tsv(selected, tsv_path)
    write_html(selected, html_path)

    # Summary
    phyla   = len({o["phylum"]  for o in selected if o["phylum"]})
    classes = len({o["class"]   for o in selected if o["class"]})
    orders  = len({o["order"]   for o in selected if o["order"]})
    families= len({o["family"]  for o in selected if o["family"]})
    genera  = len({o["genus"]   for o in selected if o["genus"]})
    gut     = sum(1 for o in selected if o["gut_flag"] in ("gut_dominant","gut_associated"))
    ref_cnt = sum(1 for o in selected if o["refseq_category"]=="reference genome")
    print(f"\n{'='*46}")
    print(f"  Total selected   : {len(selected)}")
    print(f"  Reference genome : {ref_cnt}")
    print(f"  Phyla            : {phyla}")
    print(f"  Classes          : {classes}")
    print(f"  Orders           : {orders}")
    print(f"  Families         : {families}")
    print(f"  Genera           : {genera}")
    print(f"  Gut-associated   : {gut}")
    print(f"{'='*46}")

if __name__ == "__main__":
    main()
