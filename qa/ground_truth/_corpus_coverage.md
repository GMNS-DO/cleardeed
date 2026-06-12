# Ground-Truth Corpus Coverage Matrix

> Generated: 2026-06-12
> Total plots: 50 | Verified: 5 | Pending: 45

This matrix shows the 50-plot ground-truth corpus coverage of the 10-tahasil Khordha
space, sliced by plot pattern, BDA zone, and kisam class. **Empty cells are gaps** the
founder must fill in subsequent manual-verification sessions.

---

## Coverage by Tahasil × Plot Pattern

| Tahasil \ Pattern | numeric | d_prefix | fraction | alphanumeric | Total |
|---|---|---|---|---|---|
| **Bhubaneswar** | 5 | 1 | 3 | 1 | **10** |
| **Kordha** | · | 3 | · | 2 | **5** |
| **Jatni** | 2 | · | 3 | · | **5** |
| **Tangi** | · | 2 | · | 3 | **5** |
| **Banapur** | 3 | · | 2 | · | **5** |
| **Balianta** | · | 2 | · | 2 | **4** |
| **Balipatna** | 2 | · | 2 | · | **4** |
| **Begunia** | · | 2 | · | 2 | **4** |
| **Bolgarh** | 2 | · | 2 | · | **4** |
| **Chilika** | · | 2 | · | 2 | **4** |

---

## Coverage by BDA Zone × Kisam Class

| BDA Zone \ Kisam | residential | agricultural | industrial | commercial | Total |
|---|---|---|---|---|---|
| **residential** | 5 | 2 | 4 | · | **11** |
| **commercial** | 1 | 4 | · | 4 | **9** |
| **industrial** | 4 | · | 4 | · | **8** |
| **mixed_use** | · | 3 | · | 4 | **7** |
| **green_belt** | 4 | · | 3 | · | **7** |
| **special** | 1 | 4 | · | 3 | **8** |

---

## Coverage by Tahasil × BDA Zone

| Tahasil \ BDA | residential | commercial | industrial | mixed_use | green_belt | special | institutional | agricultural | Total |
|---|---|---|
| **Bhubaneswar** | 5 | 1 | 1 | · | 2 | 1 | · | · | **10** |
| **Kordha** | · | 2 | · | 1 | · | 2 | · | · | **5** |
| **Jatni** | 2 | · | 2 | · | 1 | · | · | · | **5** |
| **Tangi** | · | 2 | · | 2 | · | 1 | · | · | **5** |
| **Banapur** | 1 | · | 2 | · | 2 | · | · | · | **5** |
| **Balianta** | · | 1 | · | 1 | · | 2 | · | · | **4** |
| **Balipatna** | 2 | · | 1 | · | 1 | · | · | · | **4** |
| **Begunia** | · | 2 | · | 1 | · | 1 | · | · | **4** |
| **Bolgarh** | 1 | · | 2 | · | 1 | · | · | · | **4** |
| **Chilika** | · | 1 | · | 2 | · | 1 | · | · | **4** |

---

## Verified Plots (5)

| Plot ID | Tahasil | Village | Plot # | Pattern | Verified |
|---|---|---|---|---|---|
| P001 | Bhubaneswar | Mendhasala | 415 | numeric | yes |
| P002 | Bhubaneswar | Patia | 1024 | numeric | yes |
| P003 | Bhubaneswar | Chandrasekharpur | D/588 | d_prefix | yes |
| P004 | Bhubaneswar | Khandagiri | 127/2 | fraction | yes |
| P005 | Bhubaneswar | Sundarpada | 89A | alphanumeric | yes |

---

## Pending Scaffolds (45)

Plots P006–P050 are empty scaffolds awaiting manual verification. Each has a
`transcript.md` with the manual steps and a `manifest.json` with
`fetchers: { bhulekh: null, ... }` (the founder fills in the contract envelopes).

The first 5 empty plots to verify (highest value):

- `P006` — Bhubaneswar/Mendhasala (numeric, residential, residential)
- `P007` — Kordha/Brahmanabilen (d_prefix, commercial, agricultural)
- `P008` — Jatni/Malipur (fraction, industrial, industrial)
- `P009` — Tangi/Tangi (alphanumeric, mixed_use, commercial)
- `P010` — Banapur/Kakatpur (numeric, green_belt, residential)
