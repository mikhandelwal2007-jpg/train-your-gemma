# Dataset & Problem Bank Documentation

## Problem Splits
- `play`: Used during interactive player training sessions.
- `gold`: Fixed ground-truth traces sprinkled into gameplay to calibrate player reliability scores without revealing their identity.
- `flight`: **STRICTLY HELD OUT**. Never surfaced in gameplay, never included in training sets or prompt demonstrations. Used exclusively for arms-based flight testing.

## Schema
- **Problem**:
  - `id`: Unique identifier
  - `subject`: Domain (`physics_units`, `chart_table`)
  - `difficulty`: `easy`, `medium`, `hard`
  - `statement`: Problem text
  - `image_path`: Path to programmatic CC0 chart image (nullable)
  - `answer_key`: Verified canonical answer
  - `checker_type`: `sympy`, `units`, `exact`, `manual`
  - `split`: `play`, `flight`, `gold`
  - `license`: `CC0-1.0`
  - `source`: Provenance

- **Trace**:
  - `id`: Trace ID
  - `problem_id`: Linked problem ID
  - `model_id`: Generation model ID
  - `adapter_version`: Nullable LoRA version
  - `steps`: Ordered list of reasoning steps
  - `final_answer`: Outputted solution
  - `is_final_correct`: Boolean
  - `first_flaw_index`: 0-indexed integer of first flaw (null = flawless)
  - `flaw_type`: Category of flaw (`unit_slip`, `math_error`, `formula_inversion`, `misread_graph`, etc.)
  - `truth_source`: `checker`, `human_reviewed`, `ambiguous`

## Licenses
All problems and generated chart visuals are original creations released under the **CC0-1.0 Universal Public Domain Dedication**.
No exam or textbook copyrighted problems are used.
