# Data Workspace

This directory contains datasets for ML training and evaluation.

## Targets (Proposal v3.1)
- **W5**: >=100 verified pilot images
- **W11**: >=500 de-identified gold images
- **Target**: 700 images
- **At least**: 20% double annotation

## Subdirectories
- `raw-local/`: Working local data only. MUST NEVER BE COMMITTED TO GIT. Use synthetic identifiers (e.g., `writer_001`, `img_000001`).
- `deidentified-local/`: De-identified datasets without student names, IDs, or faces.
- `manifests/`: Dataset version manifests.
- `splits/`: `train/`, `validation/`, and `test/` splits. Must support writer-disjoint evaluation to prevent leakage.
