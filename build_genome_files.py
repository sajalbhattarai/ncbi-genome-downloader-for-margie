#!/usr/bin/env python3
"""
build_genome_files.py
Generates:
  1. bacteria_reference_genomes.psv   – pipe-separated bacterial records
  2. all_reference_genomes_master.tsv – full TSV (archaea + bacteria)
  3. reference_genomes_browser.html   – collapsible DHTML taxonomy browser
All 112 organisms verified against NCBI RefSeq (complete genome, reference assembly).
"""

import collections
import os

# ---------------------------------------------------------------------------
# DATA – tuple fields:
#   (scientific_name, strain, gcf, phylum_domain, class_, order, family,
#    genus, species, habitat, oxygen, gut_flag, pathogenicity)
# ---------------------------------------------------------------------------

ORGANISMS = [
    # ===================================================================
    # ARCHAEA
    # ===================================================================
    # --- Euryarchaeota | Methanobacteria ---
    (
        "Methanobrevibacter smithii",
        "ATCC 35061",
        "GCF_000016525.1",
        "Euryarchaeota [Archaea]",
        "Methanobacteria",
        "Methanobacteriales",
        "Methanobacteriaceae",
        "Methanobrevibacter",
        "smithii",
        "gut (human)",
        "anaerobe (methanogen)",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Methanobrevibacter ruminantium",
        "M1",
        "GCF_000024185.1",
        "Euryarchaeota [Archaea]",
        "Methanobacteria",
        "Methanobacteriales",
        "Methanobacteriaceae",
        "Methanobrevibacter",
        "ruminantium",
        "gut (ruminant)",
        "anaerobe (methanogen)",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Methanothermobacter thermautotrophicus",
        "Delta H",
        "GCF_027554905.1",
        "Euryarchaeota [Archaea]",
        "Methanobacteria",
        "Methanobacteriales",
        "Methanobacteriaceae",
        "Methanothermobacter",
        "thermautotrophicus",
        "thermophilic environments",
        "anaerobe (methanogen)",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Euryarchaeota | Halobacteria ---
    (
        "Halobacterium salinarum",
        "NRC-1",
        "GCF_000006805.1",
        "Euryarchaeota [Archaea]",
        "Halobacteria",
        "Halobacteriales",
        "Halobacteriaceae",
        "Halobacterium",
        "salinarum",
        "hypersaline lakes",
        "aerobe",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    (
        "Haloferax volcanii",
        "DS2",
        "GCF_000025685.1",
        "Euryarchaeota [Archaea]",
        "Halobacteria",
        "Halobacteriales",
        "Haloferacaceae",
        "Haloferax",
        "volcanii",
        "hypersaline lakes",
        "aerobe",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    # --- Euryarchaeota | Methanococci ---
    (
        "Methanocaldococcus jannaschii",
        "DSM 2661",
        "GCF_000091665.1",
        "Euryarchaeota [Archaea]",
        "Methanococci",
        "Methanococcales",
        "Methanocaldococcaceae",
        "Methanocaldococcus",
        "jannaschii",
        "hydrothermal vents",
        "anaerobe (methanogen)",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    (
        "Methanococcus maripaludis",
        "DSM 2067",
        "GCF_002945325.1",
        "Euryarchaeota [Archaea]",
        "Methanococci",
        "Methanococcales",
        "Methanococcaceae",
        "Methanococcus",
        "maripaludis",
        "marine (coastal sediment)",
        "anaerobe (methanogen)",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Euryarchaeota | Methanomicrobia ---
    (
        "Methanosarcina acetivorans",
        "C2A",
        "GCF_000007345.1",
        "Euryarchaeota [Archaea]",
        "Methanomicrobia",
        "Methanosarcinales",
        "Methanosarcinaceae",
        "Methanosarcina",
        "acetivorans",
        "anaerobic sediments",
        "anaerobe (methanogen)",
        "gut_associated",
        "non_pathogenic",
    ),
    (
        "Methanospirillum hungatei",
        "JF-1",
        "GCF_000013445.1",
        "Euryarchaeota [Archaea]",
        "Methanomicrobia",
        "Methanomicrobiales",
        "Methanospirillaceae",
        "Methanospirillum",
        "hungatei",
        "anaerobic sediments",
        "anaerobe (methanogen)",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Euryarchaeota | Thermococci ---
    (
        "Thermococcus kodakarensis",
        "KOD1",
        "GCF_000009965.1",
        "Euryarchaeota [Archaea]",
        "Thermococci",
        "Thermococcales",
        "Thermococcaceae",
        "Thermococcus",
        "kodakarensis",
        "hydrothermal vents",
        "obligate_anaerobe",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    (
        "Pyrococcus furiosus",
        "DSM 3638",
        "GCF_008245085.1",
        "Euryarchaeota [Archaea]",
        "Thermococci",
        "Thermococcales",
        "Thermococcaceae",
        "Pyrococcus",
        "furiosus",
        "hydrothermal vents",
        "obligate_anaerobe",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    (
        "Pyrococcus horikoshii",
        "OT3",
        "GCF_000011105.1",
        "Euryarchaeota [Archaea]",
        "Thermococci",
        "Thermococcales",
        "Thermococcaceae",
        "Pyrococcus",
        "horikoshii",
        "hydrothermal vents",
        "obligate_anaerobe",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    # --- Euryarchaeota | Archaeoglobi ---
    (
        "Archaeoglobus fulgidus",
        "DSM 4304",
        "GCF_000008665.1",
        "Euryarchaeota [Archaea]",
        "Archaeoglobi",
        "Archaeoglobales",
        "Archaeoglobaceae",
        "Archaeoglobus",
        "fulgidus",
        "hydrothermal vents",
        "obligate_anaerobe",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    # --- Euryarchaeota | Methanopyri ---
    (
        "Methanopyrus kandleri",
        "AV19",
        "GCF_000007185.1",
        "Euryarchaeota [Archaea]",
        "Methanopyri",
        "Methanopyrales",
        "Methanopyraceae",
        "Methanopyrus",
        "kandleri",
        "hydrothermal vents",
        "anaerobe (methanogen)",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    # --- Crenarchaeota | Thermoprotei ---
    (
        "Sulfolobus acidocaldarius",
        "DSM 639",
        "GCF_000012285.1",
        "Crenarchaeota [Archaea]",
        "Thermoprotei",
        "Sulfolobales",
        "Sulfolobaceae",
        "Sulfolobus",
        "acidocaldarius",
        "hot springs (acidic)",
        "aerobe",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    (
        "Pyrobaculum aerophilum",
        "IM2",
        "GCF_000007225.1",
        "Crenarchaeota [Archaea]",
        "Thermoprotei",
        "Thermoproteales",
        "Thermoproteaceae",
        "Pyrobaculum",
        "aerophilum",
        "hot springs (boiling, marine)",
        "facultative_anaerobe",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    (
        "Aeropyrum pernix",
        "K1",
        "GCF_000011125.1",
        "Crenarchaeota [Archaea]",
        "Thermoprotei",
        "Desulfurococcales",
        "Desulfurococcaceae",
        "Aeropyrum",
        "pernix",
        "hot springs (marine hydrothermal)",
        "aerobe",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    # --- Nitrososphaeria [Archaea] ---
    (
        "Nitrosopumilus maritimus",
        "SCM1",
        "GCF_000018465.1",
        "Nitrososphaeria [Archaea]",
        "Nitrososphaeria",
        "Nitrosopumilales",
        "Nitrosopumilaceae",
        "Nitrosopumilus",
        "maritimus",
        "marine (oligotrophic)",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Nitrososphaera viennensis",
        "EN76",
        "GCF_000698785.1",
        "Nitrososphaeria [Archaea]",
        "Nitrososphaeria",
        "Nitrososphaerales",
        "Nitrososphaeraceae",
        "Nitrososphaera",
        "viennensis",
        "soil",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Thermoplasmatota [Archaea] ---
    (
        "Thermoplasma acidophilum",
        "DSM 1728",
        "GCF_000195915.1",
        "Thermoplasmatota [Archaea]",
        "Thermoplasmata",
        "Thermoplasmatales",
        "Thermoplasmataceae",
        "Thermoplasma",
        "acidophilum",
        "hot springs (acidic)",
        "facultative_anaerobe",
        "non_gut",
        "non_pathogenic (extremophile)",
    ),
    # ===================================================================
    # BACTERIA
    # ===================================================================
    # --- Bacillota | Bacilli ---
    (
        "Bacillus subtilis",
        "168",
        "GCF_000009045.1",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Bacillales",
        "Bacillaceae",
        "Bacillus",
        "subtilis",
        "soil",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Bacillus anthracis",
        "Ames Ancestor",
        "GCF_000008445.1",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Bacillales",
        "Bacillaceae",
        "Bacillus",
        "anthracis",
        "soil (spores)/clinical",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Listeria monocytogenes",
        "EGD-e",
        "GCF_000196035.1",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Lactobacillales",
        "Listeriaceae",
        "Listeria",
        "monocytogenes",
        "soil/food/clinical",
        "facultative_anaerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Staphylococcus aureus subsp. aureus",
        "MRSA252",
        "GCF_000011505.1",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Bacillales",
        "Staphylococcaceae",
        "Staphylococcus",
        "aureus",
        "human skin/clinical",
        "facultative_anaerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Streptococcus pyogenes",
        "M1 GAS",
        "GCF_000006785.2",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Lactobacillales",
        "Streptococcaceae",
        "Streptococcus",
        "pyogenes",
        "human throat/clinical",
        "facultative_anaerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Streptococcus pneumoniae",
        "TIGR4",
        "GCF_000006885.1",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Lactobacillales",
        "Streptococcaceae",
        "Streptococcus",
        "pneumoniae",
        "human nasopharynx",
        "facultative_anaerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Enterococcus faecalis",
        "V583",
        "GCF_000007785.1",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Lactobacillales",
        "Enterococcaceae",
        "Enterococcus",
        "faecalis",
        "human gut/clinical",
        "facultative_anaerobe",
        "gut_associated",
        "opportunistic_pathogen",
    ),
    (
        "Lactococcus lactis subsp. lactis",
        "Il1403",
        "GCF_000006865.1",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Lactobacillales",
        "Streptococcaceae",
        "Lactococcus",
        "lactis",
        "dairy/plant",
        "facultative_anaerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Lactobacillus acidophilus",
        "NCFM",
        "GCF_000011985.1",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Lactobacillales",
        "Lactobacillaceae",
        "Lactobacillus",
        "acidophilus",
        "human gut/dairy",
        "anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Lacticaseibacillus rhamnosus",
        "NCTC13764",
        "GCF_900636965.1",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Lactobacillales",
        "Lactobacillaceae",
        "Lacticaseibacillus",
        "rhamnosus",
        "human gut",
        "facultative_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Ligilactobacillus salivarius",
        "B4311",
        "GCF_035231985.1",
        "Bacillota [Bacteria]",
        "Bacilli",
        "Lactobacillales",
        "Lactobacillaceae",
        "Ligilactobacillus",
        "salivarius",
        "human gut/oral",
        "anaerobe",
        "gut_associated",
        "non_pathogenic",
    ),
    # --- Bacillota | Clostridia ---
    (
        "Clostridioides difficile",
        "630",
        "GCF_000009205.2",
        "Bacillota [Bacteria]",
        "Clostridia",
        "Peptostreptococcales",
        "Peptostreptococcaceae",
        "Clostridioides",
        "difficile",
        "human gut (clinical)",
        "obligate_anaerobe",
        "gut_associated",
        "pathogen (human)",
    ),
    (
        "Clostridium botulinum",
        "A str. ATCC 3502",
        "GCF_000063585.1",
        "Bacillota [Bacteria]",
        "Clostridia",
        "Clostridiales",
        "Clostridiaceae",
        "Clostridium",
        "botulinum",
        "soil/sediment",
        "obligate_anaerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Clostridium perfringens",
        "str. 13",
        "GCF_000009685.1",
        "Bacillota [Bacteria]",
        "Clostridia",
        "Clostridiales",
        "Clostridiaceae",
        "Clostridium",
        "perfringens",
        "soil/gut",
        "obligate_anaerobe",
        "gut_associated",
        "pathogen (human)",
    ),
    (
        "Agathobacter rectalis",
        "ATCC 33656",
        "GCF_000020605.1",
        "Bacillota [Bacteria]",
        "Clostridia",
        "Lachnospirales",
        "Lachnospiraceae",
        "Agathobacter",
        "rectalis",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Mediterraneibacter gnavus",
        "ATCC 29149",
        "GCF_009831375.1",
        "Bacillota [Bacteria]",
        "Clostridia",
        "Lachnospirales",
        "Lachnospiraceae",
        "Mediterraneibacter",
        "gnavus",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Clostridium butyricum",
        "DSM 10702",
        "GCF_014131795.1",
        "Bacillota [Bacteria]",
        "Clostridia",
        "Clostridiales",
        "Clostridiaceae",
        "Clostridium",
        "butyricum",
        "human gut/soil",
        "obligate_anaerobe",
        "gut_associated",
        "non_pathogenic",
    ),
    (
        "Roseburia intestinalis",
        "L1-82",
        "GCF_900537995.1",
        "Bacillota [Bacteria]",
        "Clostridia",
        "Lachnospirales",
        "Lachnospiraceae",
        "Roseburia",
        "intestinalis",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Faecalibacterium prausnitzii",
        "strain 1",
        "GCF_049532955.1",
        "Bacillota [Bacteria]",
        "Clostridia",
        "Oscillospirales",
        "Oscillospiraceae",
        "Faecalibacterium",
        "prausnitzii",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    # --- Bacillota | Negativicutes ---
    (
        "Veillonella parvula",
        "DSM 2008",
        "GCF_000024945.1",
        "Bacillota [Bacteria]",
        "Negativicutes",
        "Veillonellales",
        "Veillonellaceae",
        "Veillonella",
        "parvula",
        "human gut/oral",
        "obligate_anaerobe",
        "gut_associated",
        "non_pathogenic",
    ),
    # --- Bacillota | Erysipelotrichia ---
    (
        "Erysipelothrix rhusiopathiae",
        "str. Fujisawa",
        "GCF_000270085.1",
        "Bacillota [Bacteria]",
        "Erysipelotrichia",
        "Erysipelothricales",
        "Erysipelotrichaceae",
        "Erysipelothrix",
        "rhusiopathiae",
        "animal/environment",
        "facultative_anaerobe",
        "non_gut",
        "pathogen (animal)",
    ),
    # --- Bacteroidota | Bacteroidia ---
    (
        "Bacteroides fragilis",
        "NCTC 9343",
        "GCF_000025985.1",
        "Bacteroidota [Bacteria]",
        "Bacteroidia",
        "Bacteroidales",
        "Bacteroidaceae",
        "Bacteroides",
        "fragilis",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "opportunistic_pathogen",
    ),
    (
        "Bacteroides thetaiotaomicron",
        "VPI-5482",
        "GCF_000011065.1",
        "Bacteroidota [Bacteria]",
        "Bacteroidia",
        "Bacteroidales",
        "Bacteroidaceae",
        "Bacteroides",
        "thetaiotaomicron",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Phocaeicola vulgatus",
        "ATCC 8482",
        "GCF_000012825.1",
        "Bacteroidota [Bacteria]",
        "Bacteroidia",
        "Bacteroidales",
        "Bacteroidaceae",
        "Phocaeicola",
        "vulgatus",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Segatella copri",
        "DSM 18205",
        "GCF_020735445.1",
        "Bacteroidota [Bacteria]",
        "Bacteroidia",
        "Bacteroidales",
        "Prevotellaceae",
        "Segatella",
        "copri",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Porphyromonas gingivalis",
        "W83",
        "GCF_000007585.1",
        "Bacteroidota [Bacteria]",
        "Bacteroidia",
        "Bacteroidales",
        "Porphyromonadaceae",
        "Porphyromonas",
        "gingivalis",
        "human oral cavity",
        "obligate_anaerobe",
        "non_gut",
        "opportunistic_pathogen",
    ),
    (
        "Alistipes shahii",
        "WAL 8301",
        "GCF_025145845.1",
        "Bacteroidota [Bacteria]",
        "Bacteroidia",
        "Bacteroidales",
        "Rikenellaceae",
        "Alistipes",
        "shahii",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Parabacteroides distasonis",
        "ATCC 8503",
        "GCF_000012845.1",
        "Bacteroidota [Bacteria]",
        "Bacteroidia",
        "Bacteroidales",
        "Tannerellaceae",
        "Parabacteroides",
        "distasonis",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    # --- Bacteroidota | Flavobacteriia ---
    (
        "Flavobacterium johnsoniae",
        "UW101",
        "GCF_000016645.1",
        "Bacteroidota [Bacteria]",
        "Flavobacteriia",
        "Flavobacteriales",
        "Flavobacteriaceae",
        "Flavobacterium",
        "johnsoniae",
        "freshwater/soil",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Bacteroidota | Sphingobacteriia ---
    (
        "Sphingobacterium mizutaii",
        "NCTC12149",
        "GCF_900187125.1",
        "Bacteroidota [Bacteria]",
        "Sphingobacteriia",
        "Sphingobacteriales",
        "Sphingobacteriaceae",
        "Sphingobacterium",
        "mizutaii",
        "water/clinical",
        "aerobe",
        "non_gut",
        "opportunistic_pathogen",
    ),
    # --- Actinomycetota | Actinomycetes ---
    (
        "Mycobacterium tuberculosis",
        "H37Rv",
        "GCF_000195955.2",
        "Actinomycetota [Bacteria]",
        "Actinomycetes",
        "Mycobacteriales",
        "Mycobacteriaceae",
        "Mycobacterium",
        "tuberculosis",
        "human lungs/clinical",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Mycobacterium leprae",
        "MRHRU-235-G",
        "GCF_003253775.1",
        "Actinomycetota [Bacteria]",
        "Actinomycetes",
        "Mycobacteriales",
        "Mycobacteriaceae",
        "Mycobacterium",
        "leprae",
        "obligate intracellular (human)",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Mycolicibacterium smegmatis",
        "Jucho",
        "GCF_022370415.1",
        "Actinomycetota [Bacteria]",
        "Actinomycetes",
        "Mycobacteriales",
        "Mycobacteriaceae",
        "Mycolicibacterium",
        "smegmatis",
        "soil",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Streptomyces avermitilis",
        "MA-4680",
        "GCF_000009765.2",
        "Actinomycetota [Bacteria]",
        "Actinomycetes",
        "Kitasatosporales",
        "Streptomycetaceae",
        "Streptomyces",
        "avermitilis",
        "soil",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Corynebacterium glutamicum",
        "ATCC 13032",
        "GCF_000011325.1",
        "Actinomycetota [Bacteria]",
        "Actinomycetes",
        "Mycobacteriales",
        "Corynebacteriaceae",
        "Corynebacterium",
        "glutamicum",
        "soil",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Bifidobacterium longum",
        "NCC2705",
        "GCF_000007525.1",
        "Actinomycetota [Bacteria]",
        "Actinomycetes",
        "Bifidobacteriales",
        "Bifidobacteriaceae",
        "Bifidobacterium",
        "longum",
        "human gut",
        "anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Tropheryma whipplei",
        "TW08/27",
        "GCF_000196075.1",
        "Actinomycetota [Bacteria]",
        "Actinomycetes",
        "Micrococcales",
        "Tropherymataceae",
        "Tropheryma",
        "whipplei",
        "human small intestine",
        "aerobe",
        "gut_associated",
        "pathogen (human)",
    ),
    (
        "Cutibacterium acnes subsp. acnes",
        "NBRC 107605",
        "GCF_006739385.1",
        "Actinomycetota [Bacteria]",
        "Actinomycetes",
        "Propionibacteriales",
        "Propionibacteriaceae",
        "Cutibacterium",
        "acnes",
        "human skin",
        "anaerobe",
        "non_gut",
        "opportunistic_pathogen",
    ),
    # --- Actinomycetota | Coriobacteriia ---
    (
        "Eggerthella lenta",
        "DSM 2243",
        "GCF_000024265.1",
        "Actinomycetota [Bacteria]",
        "Coriobacteriia",
        "Coriobacteriales",
        "Eggerthellaceae",
        "Eggerthella",
        "lenta",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    (
        "Collinsella aerofaciens",
        "ATCC 25986",
        "GCF_010509075.1",
        "Actinomycetota [Bacteria]",
        "Coriobacteriia",
        "Coriobacteriales",
        "Eggerthellaceae",
        "Collinsella",
        "aerofaciens",
        "human gut",
        "obligate_anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    # --- Fusobacteriota ---
    (
        "Fusobacterium nucleatum subsp. nucleatum",
        "ATCC 25586",
        "GCF_003019295.1",
        "Fusobacteriota [Bacteria]",
        "Fusobacteriia",
        "Fusobacteriales",
        "Fusobacteriaceae",
        "Fusobacterium",
        "nucleatum",
        "human gut/oral",
        "anaerobe",
        "gut_associated",
        "opportunistic_pathogen",
    ),
    # --- Verrucomicrobiota ---
    (
        "Akkermansia muciniphila",
        "ATCC BAA-835",
        "GCF_000020225.1",
        "Verrucomicrobiota [Bacteria]",
        "Verrucomicrobiae",
        "Verrucomicrobiales",
        "Akkermansiaceae",
        "Akkermansia",
        "muciniphila",
        "human gut",
        "anaerobe",
        "gut_dominant",
        "non_pathogenic",
    ),
    # --- Campylobacterota (Epsilonproteobacteria) ---
    (
        "Helicobacter pylori",
        "26695",
        "GCF_000008525.1",
        "Campylobacterota [Bacteria]",
        "Epsilonproteobacteria",
        "Campylobacterales",
        "Helicobacteraceae",
        "Helicobacter",
        "pylori",
        "human stomach",
        "microaerophile",
        "gut_dominant",
        "pathogen (human)",
    ),
    (
        "Campylobacter jejuni subsp. jejuni",
        "NCTC 11168",
        "GCF_000009085.1",
        "Campylobacterota [Bacteria]",
        "Epsilonproteobacteria",
        "Campylobacterales",
        "Campylobacteraceae",
        "Campylobacter",
        "jejuni",
        "poultry/human gut",
        "microaerophile",
        "gut_associated",
        "pathogen (human)",
    ),
    # --- Pseudomonadota | Gammaproteobacteria ---
    (
        "Escherichia coli",
        "K-12 substr. MG1655",
        "GCF_000005845.2",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Enterobacterales",
        "Enterobacteriaceae",
        "Escherichia",
        "coli",
        "human gut/environment",
        "facultative_anaerobe",
        "gut_dominant",
        "non_pathogenic (model organism)",
    ),
    (
        "Salmonella enterica subsp. enterica serovar Typhimurium",
        "str. LT2",
        "GCF_000006945.2",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Enterobacterales",
        "Enterobacteriaceae",
        "Salmonella",
        "enterica",
        "animal/human gut",
        "facultative_anaerobe",
        "gut_associated",
        "pathogen (human)",
    ),
    (
        "Shigella flexneri",
        "2a str. 301",
        "GCF_000006925.2",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Enterobacterales",
        "Enterobacteriaceae",
        "Shigella",
        "flexneri",
        "human gut",
        "facultative_anaerobe",
        "gut_associated",
        "pathogen (human)",
    ),
    (
        "Klebsiella pneumoniae subsp. pneumoniae",
        "HS11286",
        "GCF_000240185.1",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Enterobacterales",
        "Enterobacteriaceae",
        "Klebsiella",
        "pneumoniae",
        "human gut/clinical",
        "facultative_anaerobe",
        "gut_associated",
        "opportunistic_pathogen",
    ),
    (
        "Yersinia pestis",
        "CO92",
        "GCF_000009065.1",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Enterobacterales",
        "Yersiniaceae",
        "Yersinia",
        "pestis",
        "rodent/clinical",
        "facultative_anaerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Acinetobacter baumannii",
        "ATCC 19606",
        "GCF_009035845.1",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Pseudomonadales",
        "Moraxellaceae",
        "Acinetobacter",
        "baumannii",
        "clinical/soil",
        "aerobe",
        "non_gut",
        "opportunistic_pathogen",
    ),
    (
        "Pseudomonas aeruginosa",
        "PAO1",
        "GCF_000006765.1",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Pseudomonadales",
        "Pseudomonadaceae",
        "Pseudomonas",
        "aeruginosa",
        "soil/water/clinical",
        "aerobe",
        "non_gut",
        "opportunistic_pathogen",
    ),
    (
        "Vibrio cholerae O1 biovar El Tor",
        "N16961",
        "GCF_000006745.1",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Vibrionales",
        "Vibrionaceae",
        "Vibrio",
        "cholerae",
        "aquatic/coastal",
        "facultative_anaerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Haemophilus influenzae",
        "Rd KW20",
        "GCF_000027305.1",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Pasteurellales",
        "Pasteurellaceae",
        "Haemophilus",
        "influenzae",
        "human nasopharynx",
        "facultative_anaerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Legionella pneumophila subsp. pneumophila",
        "Philadelphia 1",
        "GCF_000008485.1",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Legionellales",
        "Legionellaceae",
        "Legionella",
        "pneumophila",
        "aquatic/soil",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Xanthomonas campestris pv. campestris",
        "ATCC 33913",
        "GCF_000007145.1",
        "Pseudomonadota [Bacteria]",
        "Gammaproteobacteria",
        "Xanthomonadales",
        "Xanthomonadaceae",
        "Xanthomonas",
        "campestris",
        "soil/plant",
        "aerobe",
        "non_gut",
        "pathogen (plant)",
    ),
    # --- Pseudomonadota | Alphaproteobacteria ---
    (
        "Caulobacter vibrioides",
        "CB15",
        "GCF_000006905.1",
        "Pseudomonadota [Bacteria]",
        "Alphaproteobacteria",
        "Caulobacterales",
        "Caulobacteraceae",
        "Caulobacter",
        "vibrioides",
        "freshwater",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Rickettsia prowazekii",
        "Madrid E",
        "GCF_000195735.1",
        "Pseudomonadota [Bacteria]",
        "Alphaproteobacteria",
        "Rickettsiales",
        "Rickettsiaceae",
        "Rickettsia",
        "prowazekii",
        "obligate intracellular (human/louse)",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Agrobacterium fabrum",
        "C58",
        "GCF_000092025.1",
        "Pseudomonadota [Bacteria]",
        "Alphaproteobacteria",
        "Hyphomicrobiales",
        "Rhizobiaceae",
        "Agrobacterium",
        "fabrum",
        "soil/rhizosphere",
        "aerobe",
        "non_gut",
        "pathogen (plant)",
    ),
    (
        "Rhizobium johnstonii",
        "3841",
        "GCF_000009265.1",
        "Pseudomonadota [Bacteria]",
        "Alphaproteobacteria",
        "Hyphomicrobiales",
        "Rhizobiaceae",
        "Rhizobium",
        "johnstonii",
        "soil/rhizosphere",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Brucella melitensis bv. 1",
        "16M",
        "GCF_000007125.1",
        "Pseudomonadota [Bacteria]",
        "Alphaproteobacteria",
        "Hyphomicrobiales",
        "Brucellaceae",
        "Brucella",
        "melitensis",
        "animal/soil",
        "aerobe",
        "non_gut",
        "pathogen (zoonotic)",
    ),
    (
        "Sinorhizobium meliloti",
        "1021",
        "GCF_000006965.1",
        "Pseudomonadota [Bacteria]",
        "Alphaproteobacteria",
        "Hyphomicrobiales",
        "Rhizobiaceae",
        "Sinorhizobium",
        "meliloti",
        "soil/rhizosphere",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Pseudomonadota | Betaproteobacteria ---
    (
        "Neisseria meningitidis",
        "MC58",
        "GCF_000008805.1",
        "Pseudomonadota [Bacteria]",
        "Betaproteobacteria",
        "Neisseriales",
        "Neisseriaceae",
        "Neisseria",
        "meningitidis",
        "human nasopharynx",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Burkholderia pseudomallei",
        "K96243",
        "GCF_000011545.1",
        "Pseudomonadota [Bacteria]",
        "Betaproteobacteria",
        "Burkholderiales",
        "Burkholderiaceae",
        "Burkholderia",
        "pseudomallei",
        "soil/water (tropical)",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Ralstonia pseudosolanacearum",
        "GMI1000",
        "GCF_000009125.1",
        "Pseudomonadota [Bacteria]",
        "Betaproteobacteria",
        "Burkholderiales",
        "Burkholderiaceae",
        "Ralstonia",
        "pseudosolanacearum",
        "soil/plant",
        "aerobe",
        "non_gut",
        "pathogen (plant)",
    ),
    (
        "Nitrosomonas europaea",
        "ATCC 19718",
        "GCF_000009145.1",
        "Pseudomonadota [Bacteria]",
        "Betaproteobacteria",
        "Nitrosomonadales",
        "Nitrosomonadaceae",
        "Nitrosomonas",
        "europaea",
        "soil/freshwater",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Pseudomonadota | Deltaproteobacteria ---
    (
        "Nitratidesulfovibrio vulgaris",
        "Hildenborough",
        "GCF_000195755.1",
        "Pseudomonadota [Bacteria]",
        "Deltaproteobacteria",
        "Desulfovibrionales",
        "Desulfovibrionaceae",
        "Nitratidesulfovibrio",
        "vulgaris",
        "soil/sediment/freshwater",
        "obligate_anaerobe",
        "gut_associated",
        "non_pathogenic",
    ),
    (
        "Myxococcus xanthus",
        "DK 1622",
        "GCF_000012685.1",
        "Pseudomonadota [Bacteria]",
        "Deltaproteobacteria",
        "Myxococcales",
        "Myxococcaceae",
        "Myxococcus",
        "xanthus",
        "soil",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Geobacter sulfurreducens",
        "PCA",
        "GCF_000007985.2",
        "Pseudomonadota [Bacteria]",
        "Deltaproteobacteria",
        "Desulfuromonadales",
        "Geobacteraceae",
        "Geobacter",
        "sulfurreducens",
        "soil/sediment/subsurface",
        "anaerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Bdellovibrio bacteriovorus",
        "HD100",
        "GCF_000196175.1",
        "Pseudomonadota [Bacteria]",
        "Deltaproteobacteria",
        "Bdellovibrionales",
        "Bdellovibrionaceae",
        "Bdellovibrio",
        "bacteriovorus",
        "soil/freshwater",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Spirochaetota ---
    (
        "Treponema pallidum subsp. pallidum",
        "Nichols",
        "GCF_000008605.1",
        "Spirochaetota [Bacteria]",
        "Spirochaetia",
        "Spirochaetales",
        "Treponemataceae",
        "Treponema",
        "pallidum",
        "obligate intracellular (human)",
        "microaerophile",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Borreliella burgdorferi",
        "B31",
        "GCF_000008685.2",
        "Spirochaetota [Bacteria]",
        "Spirochaetia",
        "Spirochaetales",
        "Borreliaceae",
        "Borreliella",
        "burgdorferi",
        "tick/mammal",
        "microaerophile",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Leptospira interrogans serovar Lai",
        "56601",
        "GCF_000092565.1",
        "Spirochaetota [Bacteria]",
        "Spirochaetia",
        "Leptospirales",
        "Leptospiraceae",
        "Leptospira",
        "interrogans",
        "soil/water/animal",
        "aerobe",
        "non_gut",
        "pathogen (zoonotic)",
    ),
    (
        "Treponema denticola",
        "ATCC 35405",
        "GCF_000008185.1",
        "Spirochaetota [Bacteria]",
        "Spirochaetia",
        "Spirochaetales",
        "Treponemataceae",
        "Treponema",
        "denticola",
        "human oral cavity",
        "anaerobe",
        "non_gut",
        "opportunistic_pathogen",
    ),
    # --- Chlamydiota ---
    (
        "Chlamydia trachomatis",
        "D/UW-3/CX",
        "GCF_000008725.1",
        "Chlamydiota [Bacteria]",
        "Chlamydiia",
        "Chlamydiales",
        "Chlamydiaceae",
        "Chlamydia",
        "trachomatis",
        "obligate intracellular (human)",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Chlamydia pneumoniae",
        "CWL029",
        "GCF_000008745.1",
        "Chlamydiota [Bacteria]",
        "Chlamydiia",
        "Chlamydiales",
        "Chlamydiaceae",
        "Chlamydia",
        "pneumoniae",
        "obligate intracellular (human)",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    # --- Deinococcota ---
    (
        "Deinococcus radiodurans",
        "R1",
        "GCF_000008565.1",
        "Deinococcota [Bacteria]",
        "Deinococci",
        "Deinococcales",
        "Deinococcaceae",
        "Deinococcus",
        "radiodurans",
        "soil/radioactive environments",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Thermus thermophilus",
        "HB27",
        "GCF_000008125.1",
        "Deinococcota [Bacteria]",
        "Deinococci",
        "Thermales",
        "Thermaceae",
        "Thermus",
        "thermophilus",
        "hot springs",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Cyanobacteriota ---
    (
        "Synechocystis sp.",
        "PCC 6803",
        "GCF_000009725.1",
        "Cyanobacteriota [Bacteria]",
        "Cyanophyceae",
        "Synechococcales",
        "Merismopediaceae",
        "Synechocystis",
        "sp.",
        "freshwater",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Trichormus variabilis",
        "ATCC 29413",
        "GCF_000204075.1",
        "Cyanobacteriota [Bacteria]",
        "Cyanophyceae",
        "Nostocales",
        "Nostocaceae",
        "Trichormus",
        "variabilis",
        "freshwater",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Prochlorococcus marinus",
        "MIT 9313",
        "GCF_000011485.1",
        "Cyanobacteriota [Bacteria]",
        "Cyanophyceae",
        "Synechococcales",
        "Prochlorococcaceae",
        "Prochlorococcus",
        "marinus",
        "marine (open ocean)",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Chloroflexota ---
    (
        "Chloroflexus aurantiacus",
        "J-10-fl",
        "GCF_000018865.1",
        "Chloroflexota [Bacteria]",
        "Chloroflexia",
        "Chloroflexales",
        "Chloroflexaceae",
        "Chloroflexus",
        "aurantiacus",
        "hot springs",
        "facultative_anaerobe",
        "non_gut",
        "non_pathogenic",
    ),
    (
        "Dehalococcoides mccartyi",
        "195",
        "GCF_000011905.1",
        "Chloroflexota [Bacteria]",
        "Dehalococcoidia",
        "Dehalococcoidales",
        "Dehalococcoidaceae",
        "Dehalococcoides",
        "mccartyi",
        "contaminated groundwater/subsurface",
        "obligate_anaerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Aquificota ---
    (
        "Aquifex aeolicus",
        "VF5",
        "GCF_000008625.1",
        "Aquificota [Bacteria]",
        "Aquificia",
        "Aquificales",
        "Aquificaceae",
        "Aquifex",
        "aeolicus",
        "hydrothermal vents/hot springs",
        "microaerophile",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Thermotogota ---
    (
        "Thermotoga maritima",
        "MSB8",
        "GCF_000008545.1",
        "Thermotogota [Bacteria]",
        "Thermotogae",
        "Thermotogales",
        "Thermotogaceae",
        "Thermotoga",
        "maritima",
        "hydrothermal vents",
        "anaerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Acidobacteriota ---
    (
        "Acidobacterium capsulatum",
        "ATCC 51196",
        "GCF_000022565.1",
        "Acidobacteriota [Bacteria]",
        "Acidobacteriia",
        "Acidobacteriales",
        "Acidobacteriaceae",
        "Acidobacterium",
        "capsulatum",
        "acidic soil/environments",
        "facultative_anaerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Fibrobacterota ---
    (
        "Fibrobacter succinogenes subsp. succinogenes",
        "S85",
        "GCF_000146505.1",
        "Fibrobacterota [Bacteria]",
        "Fibrobacteria",
        "Fibrobacterales",
        "Fibrobacteraceae",
        "Fibrobacter",
        "succinogenes",
        "rumen",
        "obligate_anaerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Synergistota ---
    (
        "Aminobacterium colombiense",
        "DSM 12261",
        "GCF_000025885.1",
        "Synergistota [Bacteria]",
        "Synergistia",
        "Synergistales",
        "Synergistaceae",
        "Aminobacterium",
        "colombiense",
        "anaerobic sewage/gut",
        "obligate_anaerobe",
        "gut_associated",
        "non_pathogenic",
    ),
    # --- Mycoplasmota | Mollicutes ---
    (
        "Mycoplasmoides genitalium",
        "G37",
        "GCF_000027325.1",
        "Mycoplasmota [Bacteria]",
        "Mollicutes",
        "Mycoplasmatales",
        "Mycoplasmataceae",
        "Mycoplasmoides",
        "genitalium",
        "human urogenital tract",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Mycoplasmoides pneumoniae",
        "M129",
        "GCF_000027345.1",
        "Mycoplasmota [Bacteria]",
        "Mollicutes",
        "Mycoplasmatales",
        "Mycoplasmataceae",
        "Mycoplasmoides",
        "pneumoniae",
        "human respiratory tract",
        "aerobe",
        "non_gut",
        "pathogen (human)",
    ),
    (
        "Ureaplasma parvum serovar 3",
        "ATCC 700970",
        "GCF_000006625.1",
        "Mycoplasmota [Bacteria]",
        "Mollicutes",
        "Mycoplasmatales",
        "Mycoplasmataceae",
        "Ureaplasma",
        "parvum",
        "human urogenital tract",
        "aerobe",
        "non_gut",
        "opportunistic_pathogen",
    ),
    # --- Nitrospirota ---
    (
        "Nitrospira moscoviensis",
        "NSP M-1",
        "GCF_001273775.1",
        "Nitrospirota [Bacteria]",
        "Nitrospira",
        "Nitrospirales",
        "Nitrospiraceae",
        "Nitrospira",
        "moscoviensis",
        "freshwater/wastewater",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
    # --- Planctomycetota ---
    (
        "Gemmata obscuriglobus",
        "DSM 5831",
        "GCF_003149495.1",
        "Planctomycetota [Bacteria]",
        "Planctomycetia",
        "Planctomycetales",
        "Gemmataceae",
        "Gemmata",
        "obscuriglobus",
        "freshwater",
        "aerobe",
        "non_gut",
        "non_pathogenic",
    ),
]

FIELDS = [
    "scientific_name",
    "strain",
    "gcf_accession",
    "phylum_domain",
    "class",
    "order",
    "family",
    "genus",
    "species",
    "habitat",
    "oxygen_requirement",
    "gut_flag",
    "pathogenicity",
]

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def domain_of(row):
    return "Archaea" if "[Archaea]" in row[3] else "Bacteria"


def phylum_of(row):
    return row[3].split(" [")[0]


def stats(organisms):
    domains = set(domain_of(r) for r in organisms)
    phyla = set(phylum_of(r) for r in organisms)
    classes = set(r[4] for r in organisms)
    orders = set(r[5] for r in organisms)
    families = set(r[6] for r in organisms)
    genera = set(r[7] for r in organisms)
    species_ = set(r[8] for r in organisms)
    gut = sum(1 for r in organisms if r[11] in ("gut_dominant", "gut_associated"))
    return dict(
        total=len(organisms),
        domains=len(domains),
        phyla=len(phyla),
        classes=len(classes),
        orders=len(orders),
        families=len(families),
        genera=len(genera),
        species=len(species_),
        gut_associated=gut,
    )


# ---------------------------------------------------------------------------
# 1. bacteria_reference_genomes.psv
# ---------------------------------------------------------------------------


def write_bacteria_psv(path):
    bacteria = [r for r in ORGANISMS if domain_of(r) == "Bacteria"]
    with open(path, "w") as fh:
        for r in bacteria:
            fh.write("|".join(r) + "\n")
    print(f"Wrote {len(bacteria)} bacterial records -> {path}")


# ---------------------------------------------------------------------------
# 2. all_reference_genomes_master.tsv
# ---------------------------------------------------------------------------


def write_master_tsv(path):
    with open(path, "w") as fh:
        fh.write("\t".join(FIELDS) + "\n")
        for r in ORGANISMS:
            fh.write("\t".join(r) + "\n")
    print(f"Wrote {len(ORGANISMS)} total records -> {path}")


# ---------------------------------------------------------------------------
# 3. reference_genomes_browser.html
# ---------------------------------------------------------------------------

NCBI_BASE = "https://www.ncbi.nlm.nih.gov/datasets/genome/"

GUT_COLOR = {
    "gut_dominant": "#2ecc71",
    "gut_associated": "#f39c12",
    "non_gut": "#95a5a6",
}
PATH_COLOR = {
    "pathogen (human)": "#e74c3c",
    "pathogen (zoonotic)": "#c0392b",
    "pathogen (plant)": "#27ae60",
    "pathogen (animal)": "#d35400",
    "opportunistic_pathogen": "#e67e22",
    "non_pathogenic": "#27ae60",
    "non_pathogenic (extremophile)": "#16a085",
    "non_pathogenic (model organism)": "#2980b9",
}

OXY_ICON = {
    "aerobe": "&#x2600;",  # sun
    "anaerobe": "&#x1F30B;",  # volcano
    "anaerobe (methanogen)": "&#x1F300;",  # cyclone
    "facultative_anaerobe": "&#x1F506;",  # high-brightness
    "obligate_anaerobe": "&#x26AB;",  # black circle
    "microaerophile": "&#x1F32C;",  # wind
}


def gut_badge(flag):
    color = GUT_COLOR.get(flag, "#aaa")
    label = flag.replace("_", " ")
    return (
        f'<span style="background:{color};color:#fff;'
        f'padding:1px 6px;border-radius:3px;font-size:0.78em">'
        f"{label}</span>"
    )


def path_badge(p):
    color = PATH_COLOR.get(p, "#888")
    label = p.replace("_", " ")
    return (
        f'<span style="background:{color};color:#fff;'
        f'padding:1px 6px;border-radius:3px;font-size:0.78em">'
        f"{label}</span>"
    )


def oxy_icon(o):
    return OXY_ICON.get(o, "&#x25EF;")


def gcf_link(gcf):
    return (
        f'<a href="{NCBI_BASE}{gcf}" target="_blank" '
        f'style="font-family:monospace;color:#3498db">{gcf}</a>'
    )


TABLE_HEADER = """
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Scientific Name</th>
      <th>Strain</th>
      <th>GCF Accession</th>
      <th>Order</th>
      <th>Family</th>
      <th>O&#8322;</th>
      <th>Habitat</th>
      <th>Gut</th>
      <th>Pathogenicity</th>
    </tr>
  </thead>
  <tbody>
"""


def organism_row(idx, r):
    name, strain, gcf = r[0], r[1], r[2]
    order, family = r[5], r[6]
    habitat, oxy = r[9], r[10]
    gut, path = r[11], r[12]
    return (
        f"    <tr>\n"
        f'      <td style="color:#888">{idx}</td>\n'
        f"      <td><em>{name}</em></td>\n"
        f'      <td style="font-size:0.85em">{strain}</td>\n'
        f"      <td>{gcf_link(gcf)}</td>\n"
        f'      <td style="font-size:0.85em">{order}</td>\n'
        f'      <td style="font-size:0.85em">{family}</td>\n'
        f'      <td title="{oxy}">{oxy_icon(oxy)}</td>\n'
        f'      <td style="font-size:0.82em">{habitat}</td>\n'
        f"      <td>{gut_badge(gut)}</td>\n"
        f"      <td>{path_badge(path)}</td>\n"
        f"    </tr>\n"
    )


def write_html(path):
    s = stats(ORGANISMS)

    # Build hierarchy: domain -> phylum -> class -> [rows]
    tree = collections.OrderedDict()
    for idx, r in enumerate(ORGANISMS, 1):
        dom = domain_of(r)
        phylum = phylum_of(r)
        cls = r[4]
        tree.setdefault(dom, collections.OrderedDict())
        tree[dom].setdefault(phylum, collections.OrderedDict())
        tree[dom][phylum].setdefault(cls, [])
        tree[dom][phylum][cls].append((idx, r))

    lines = []
    a = lines.append

    a("<!DOCTYPE html>")
    a('<html lang="en">')
    a("<head>")
    a('<meta charset="UTF-8">')
    a('<meta name="viewport" content="width=device-width, initial-scale=1.0">')
    a("<title>Diverse Reference Genome Collection Browser</title>")
    a("<style>")
    a("""
      :root {
        --bg: #0f1117; --surface: #1a1d27; --surface2: #22263a;
        --border: #2e3350; --text: #e0e4f0; --muted: #8892b0;
        --accent: #3d5af1; --accent2: #00d4ff;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: var(--bg); color: var(--text);
        font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px;
        line-height: 1.5; padding: 24px;
      }
      h1 { font-size: 1.7em; color: var(--accent2); margin-bottom: 4px; }
      .subtitle { color: var(--muted); margin-bottom: 20px; font-size: 0.92em; }
      .stats-grid {
        display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px;
      }
      .stat-card {
        background: var(--surface); border: 1px solid var(--border);
        border-radius: 8px; padding: 12px 20px; text-align: center;
        min-width: 90px;
      }
      .stat-num  { font-size: 1.8em; font-weight: 700; color: var(--accent2); }
      .stat-label{ font-size: 0.75em; color: var(--muted); margin-top: 2px; }

      /* legend */
      .legend { display:flex; flex-wrap:wrap; gap:14px; margin-bottom:22px;
                font-size:0.82em; color:var(--muted); }
      .legend-item { display:flex; align-items:center; gap:5px; }

      /* collapsible summary/details */
      details { margin: 6px 0; }
      details > summary {
        cursor: pointer; user-select: none;
        padding: 8px 12px; border-radius: 6px;
        background: var(--surface); border: 1px solid var(--border);
        font-weight: 600; list-style: none;
        display: flex; align-items: center; gap: 8px;
      }
      details > summary::-webkit-details-marker { display: none; }
      details > summary::before {
        content: "▶"; font-size: 0.7em; color: var(--accent);
        transition: transform 0.15s;
      }
      details[open] > summary::before { transform: rotate(90deg); }
      details > summary:hover { background: var(--surface2); }

      .dom-summary  { font-size: 1.15em; color: var(--accent2); }
      .phy-summary  { font-size: 1.02em; color: #a8d8ea; margin-left:16px; }
      .cls-summary  { font-size: 0.93em; color: #d4a5f5; margin-left:32px; }
      .count-badge  {
        margin-left: auto; background: var(--border);
        padding: 1px 8px; border-radius: 10px;
        font-size: 0.78em; font-weight: 400; color: var(--muted);
      }

      /* table */
      .table-wrap { overflow-x: auto; margin: 8px 0 6px 48px; }
      table {
        border-collapse: collapse; width: 100%;
        background: var(--surface); border: 1px solid var(--border);
        border-radius: 6px; overflow: hidden;
      }
      thead tr { background: var(--surface2); }
      th {
        padding: 8px 10px; text-align: left;
        color: var(--muted); font-size: 0.82em; font-weight: 600;
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }
      td {
        padding: 6px 10px; border-bottom: 1px solid var(--border);
        vertical-align: middle;
      }
      tr:last-child td { border-bottom: none; }
      tr:hover td { background: var(--surface2); }
      a { text-decoration: none; }
      a:hover { text-decoration: underline; }
    """)
    a("</style>")
    a("</head>")
    a("<body>")
    a("<h1>&#x1F9EC; Diverse Reference Genome Collection</h1>")
    a(
        '<p class="subtitle">Complete RefSeq reference-genome assemblies &mdash; '
        "verified via NCBI Datasets API. Click any section to expand.</p>"
    )

    # --- stats cards ---
    a('<div class="stats-grid">')
    cards = [
        (s["total"], "Total Genomes"),
        (s["domains"], "Domains"),
        (s["phyla"], "Phyla"),
        (s["classes"], "Classes"),
        (s["orders"], "Orders"),
        (s["families"], "Families"),
        (s["genera"], "Genera"),
        (s["gut_associated"], "Gut-associated"),
    ]
    for num, label in cards:
        a(
            f'  <div class="stat-card"><div class="stat-num">{num}</div>'
            f'<div class="stat-label">{label}</div></div>'
        )
    a("</div>")

    # --- legend ---
    a('<div class="legend">')
    a('<span style="font-weight:600;color:var(--text)">Gut flag:</span>')
    for flag, color in GUT_COLOR.items():
        label = flag.replace("_", " ")
        a(
            f'<span class="legend-item">'
            f'<span style="width:12px;height:12px;background:{color};'
            f'border-radius:2px;display:inline-block"></span>{label}</span>'
        )
    a(
        '<span style="margin-left:16px;font-weight:600;color:var(--text)">O&#8322;:</span>'
    )
    for oxy, icon in OXY_ICON.items():
        a(f'<span class="legend-item">{icon} {oxy}</span>')
    a("</div>")

    # --- taxonomy tree ---
    for dom, phyla in tree.items():
        dom_count = sum(
            len(rows) for cls_dict in phyla.values() for rows in cls_dict.values()
        )
        open_attr = " open" if dom == "Bacteria" else ""
        a(f"<details{open_attr}>")
        a(
            f'<summary class="dom-summary">'
            f"{'&#x1F9AB;' if dom == 'Archaea' else '&#x1F9A0;'} {dom}"
            f'<span class="count-badge">{dom_count} genomes</span></summary>'
        )

        for phylum, classes in phyla.items():
            phy_count = sum(len(v) for v in classes.values())
            a(f"<details>")
            a(
                f'<summary class="phy-summary">&#x1F52C; {phylum}'
                f'<span class="count-badge">{phy_count}</span></summary>'
            )

            for cls, rows in classes.items():
                a(f"<details>")
                a(
                    f'<summary class="cls-summary">&#x1F4CB; {cls}'
                    f'<span class="count-badge">{len(rows)}</span></summary>'
                )
                a('<div class="table-wrap">')
                a(TABLE_HEADER)
                for idx, r in rows:
                    a(organism_row(idx, r))
                a("  </tbody>\n</table>")
                a("</div>")
                a("</details>")  # class

            a("</details>")  # phylum
        a("</details>")  # domain

    a("</body></html>")

    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print(f"Wrote HTML browser -> {path}")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    base = os.path.dirname(os.path.abspath(__file__))

    write_bacteria_psv(os.path.join(base, "bacteria_reference_genomes.psv"))
    write_master_tsv(os.path.join(base, "all_reference_genomes_master.tsv"))
    write_html(os.path.join(base, "reference_genomes_browser.html"))

    s = stats(ORGANISMS)
    print("\n=== Collection statistics ===")
    for k, v in s.items():
        print(f"  {k:<20} {v}")
    print()
    print("Thresholds check:")
    print(
        f"  classes  >= 40 : {'PASS' if s['classes'] >= 40 else 'FAIL'} ({s['classes']})"
    )
    print(
        f"  orders   >= 40 : {'PASS' if s['orders'] >= 40 else 'FAIL'} ({s['orders']})"
    )
    print(
        f"  families >= 40 : {'PASS' if s['families'] >= 40 else 'FAIL'} ({s['families']})"
    )
    print(
        f"  genera   >= 50 : {'PASS' if s['genera'] >= 50 else 'FAIL'} ({s['genera']})"
    )
    print(
        f"  gut      >= 20 : {'PASS' if s['gut_associated'] >= 20 else 'FAIL'} ({s['gut_associated']})"
    )
