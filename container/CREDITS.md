# Credits & Citations

## This Pipeline

**Name:** Microbial Reference Genome Downloader
**Version:** 1.0.0
**Source:** https://github.com/sajalbhattarai/genome-download
**License:** MIT

If you use this pipeline in published research, please cite the tools below.

---

## Genome Data Source

### NCBI RefSeq / Datasets

**Sayers et al. (2022)**
Sayers EW, Bolton EE, Brister JR, Canese K, Chan J, Comeau DC, Connor R, Funk K, Kelly C,
Kim S, Lanczycki C, Lathrop S, Lu Z, Madej T, Marchler-Bauer A, Ostell J, Phan L, Randle J,
Sherry ST, Thibaud-Nissen F, Tolstoy I, Wang J, Ye J, Zbicz KL.
"Database resources of the National Center for Biotechnology Information."
*Nucleic Acids Research* 50(D1): D20-D26, 2022.
DOI: [10.1093/nar/gkab1112](https://doi.org/10.1093/nar/gkab1112)

**O'Leary et al. (2016)**
O'Leary NA, Wright MW, Brister JR, Ciufo S, Haddad D, McVeigh R, Rajput B, Robbertse B,
Smith-White B, Ako-Adjei D, Astashyn A, Badretdin A, Bao Y, Blinkova O, Brover V,
Chetvernin V, Choi J, Cox E, Ermolaeva O, Farrell CM, Goldfarb T, Gupta T, Haft D,
Hatcher E, Hlavina W, Joardar VS, Kodali VK, Li W, Matten D, McGarvey ST, Murphy MR,
O'Neill K, Pujar S, Rangwala SH, Rausch D, Riddick LD, Schoch C, Shkeda A, Storz SS,
Sun H, Thibaud-Nissen F, Tolstoy I, Tully RE, Vatsan AR, Wallin C, Webb D, Wu W,
Landrum MJ, Kimchi A, Tatusova T, DiCuccio M, Kitts P, Murphy TD, Pruitt KD.
"Reference sequence (RefSeq) database at NCBI: current status, taxonomic expansion,
and functional annotation."
*Nucleic Acids Research* 44(D1): D733-D745, 2016.
DOI: [10.1093/nar/gkv1189](https://doi.org/10.1093/nar/gkv1189)

**NCBI Datasets documentation:**
https://www.ncbi.nlm.nih.gov/datasets/docs/

---

## Bioinformatics Tools

### GNU Parallel

Tange O. (2011)
"GNU Parallel - The Command-Line Power Tool."
*;login: The USENIX Magazine* 36(1): 42-47, 2011.
DOI: [10.5281/zenodo.16303](https://doi.org/10.5281/zenodo.16303)
URL: https://www.gnu.org/software/parallel/

BibTeX:

    @article{Tange2011,
      author    = {Tange, Ole},
      title     = {{GNU Parallel} - The Command-Line Power Tool},
      journal   = {;login: The USENIX Magazine},
      year      = {2011},
      volume    = {36},
      number    = {1},
      pages     = {42--47},
      doi       = {10.5281/zenodo.16303},
      url       = {https://www.gnu.org/software/parallel/},
    }

### Apptainer / Singularity

Kurtzer GM, Sochat V, Bauer MW. (2017)
"Singularity: Scientific containers for mobility of compute."
*PLoS ONE* 12(5): e0177459, 2017.
DOI: [10.1371/journal.pone.0177459](https://doi.org/10.1371/journal.pone.0177459)
URL: https://apptainer.org/

BibTeX:

    @article{Kurtzer2017,
      author    = {Kurtzer, Gregory M. and Sochat, Vanessa and Bauer, Michael W.},
      title     = {Singularity: Scientific containers for mobility of compute},
      journal   = {PLoS ONE},
      year      = {2017},
      volume    = {12},
      number    = {5},
      pages     = {e0177459},
      doi       = {10.1371/journal.pone.0177459},
      url       = {https://apptainer.org/},
    }

### Docker

Docker, Inc. https://www.docker.com
No canonical peer-reviewed paper exists for Docker itself; cite as software:

  Docker Inc. (2013). Docker: an open platform for distributed applications for
  developers and sysadmins. https://www.docker.com

---

## Taxonomy

Phylum names follow the 2021-2022 NCBI taxonomy update (ICNP-compliant nomenclature).
Historical synonyms used in older literature:

| Current (ICNP 2021-2022) | Historical synonym    |
|--------------------------|-----------------------|
| Bacillota                | Firmicutes            |
| Pseudomonadota           | Proteobacteria        |
| Actinomycetota           | Actinobacteria        |
| Bacteroidota             | Bacteroidetes         |

---

## Python Packages

- **requests** - HTTP library for Python
  Kenneth Reitz et al.
  https://requests.readthedocs.io
  License: Apache 2.0
