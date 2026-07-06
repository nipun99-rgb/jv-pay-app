# Agent Orchestration — JV Pay App v2 (LangGraph)

**Version:** 2.0  
**Engine:** LangGraph StateGraph with conditional routing  
**Deployment:** Python FastAPI service (Azure Container App, port 8000)  

---

## Graph Overview

```
                    ┌─────────┐
                    │  START  │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │ INGEST  │  ← pdf_to_pages, store_page_images
                    └────┬────┘
                         │
                    ┌────▼─────┐
                    │ CLASSIFY │  ← heuristic_classify, llm_classify, vision_classify
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │ ≥90%     │          │ <90%
              │          │          │
              │   ┌──────▼───────┐  │
              │   │ HUMAN_GATE_1 │  │  interrupt() — wait for user
              │   └──────┬───────┘  │
              │          │          │
              ▼          ▼          ▼
         ┌────────────────────────────┐
         │     EXTRACT_GC_HEADER      │  ← extract_with_regex, llm_extract_header
         └────────────┬───────────────┘
                      │
         ┌────────────▼───────────────┐
         │      EXTRACT_GC_SOV        │  ← pdfplumber_extract_sov (deterministic)
         └────────────┬───────────────┘
                      │
         ┌────────────▼───────────────┐
         │      GENERATE_PLAN         │  ← group_by_contractor (deterministic)
         └────────────┬───────────────┘
                      │
              ┌───────┼───────┐
              │ auto  │       │ needs confirm
              │       │       │
              │  ┌────▼────┐  │
              │  │ HUMAN_2 │  │  interrupt() — confirm sub list
              │  └────┬────┘  │
              ▼       ▼       ▼
         ┌────────────────────────────┐
         │       EXTRACT_SUBS         │  ← ocr_page, scan_pages, extract_sub_packet
         └────────────┬───────────────┘   (parallel: 3 concurrent subs)
                      │
         ┌────────────▼───────────────┐
         │         VERIFY             │  ← verify_field (vision comparison)
         └────────────┬───────────────┘
                      │
              ┌───────┼───────┐
              │ pass  │       │ <0.50 fields exist
              │       │       │
              │  ┌────▼────┐  │
              │  │  RETRY  │  │  ← retry_extract (alt prompt, page-by-page, vision)
              │  └────┬────┘  │
              ▼       ▼       ▼
         ┌────────────────────────────┐
         │       RECONCILE            │  ← reconcile_cross_file, reconcile_math, etc.
         └────────────┬───────────────┘
                      │
         ┌────────────▼───────────────┐
         │      HUMAN_REVIEW          │  interrupt() — final human gate
         └────────────┬───────────────┘
                      │
         ┌────────────▼───────────────┐
         │        COMPLETE            │  ← persist_final, emit_complete
         └────────────┬───────────────┘
                      │
                    ┌─▼──┐
                    │ END │
                    └────┘
```

---

## Agent Definitions

### Agent 1: Ingest Agent

**Purpose:** Download uploaded PDFs from Azure Blob, convert pages to images, store metadata.

**Node:** `ingest_node`

**Tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `download_blob` | `download_blob(blob_url: str) → bytes` | Downloads PDF bytes from Azure Blob Storage |
| `pdf_to_pages` | `pdf_to_pages(pdf_bytes: bytes, dpi: int = 200) → list[PIL.Image]` | Converts PDF to page images using pdf2image/poppler |
| `store_page_images` | `store_page_images(images: list[Image], package_id: str) → list[dict]` | Uploads page images to blob, returns `[{page_num, image_url}]` |
| `count_pages` | `count_pages(pdf_bytes: bytes) → int` | Returns total page count of PDF |

**Input State:** `documents: [{blob_url, filename}]`  
**Output State:** `page_images: [{page_num, image_url, doc_index}]`, updated `documents` with `page_count`

**Tool Definitions (Python):**

```python
async def download_blob(blob_url: str) -> bytes:
    """Download file from Azure Blob Storage.
    
    Args:
        blob_url: Full Azure Blob URL (with or without SAS token)
    Returns:
        Raw bytes of the file
    Raises:
        BlobNotFoundError: If blob does not exist
        StorageError: If download fails
    """
    from azure.storage.blob.aio import BlobClient
    client = BlobClient.from_blob_url(blob_url)
    stream = await client.download_blob()
    return await stream.readall()


async def pdf_to_pages(pdf_bytes: bytes, dpi: int = 200) -> list:
    """Convert PDF to list of PIL Image objects (one per page).
    
    Args:
        pdf_bytes: Raw PDF file bytes
        dpi: Resolution for rendering (200 = good balance of quality/speed)
    Returns:
        List of PIL.Image objects, one per page
    """
    from pdf2image import convert_from_bytes
    return convert_from_bytes(pdf_bytes, dpi=dpi)


async def store_page_images(images: list, package_id: str) -> list[dict]:
    """Upload page images to Azure Blob and return metadata.
    
    Args:
        images: List of PIL Image objects
        package_id: Package ID (int) for blob path organization
    Returns:
        List of dicts: [{page_num: int, image_url: str}]
    """
    from azure.storage.blob.aio import ContainerClient
    results = []
    container = ContainerClient.from_connection_string(CONN_STR, "page-images")
    for i, img in enumerate(images):
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        blob_name = f"{package_id}/page_{i+1:04d}.png"
        await container.upload_blob(blob_name, buf.getvalue(), overwrite=True)
        results.append({"page_num": i + 1, "image_url": f"{BASE_URL}/{blob_name}"})
    return results
```

---

### Agent 2: Classification Agent

**Purpose:** Determine document type (File 1 / File 2 / File 3) using 3-tier cascade.

**Node:** `classify_node`

**Tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `heuristic_classify` | `heuristic_classify(text: str) → dict` | Pattern/keyword matching for quick classification |
| `llm_classify` | `llm_classify(text: str, model: str = "gpt-4o-mini") → dict` | LLM text-based classification |
| `vision_classify` | `vision_classify(image_url: str, model: str = "gpt-4o") → dict` | Vision model classification from page image |
| `get_page_text` | `get_page_text(page_num: int, doc_index: int) → str` | Get OCR/extracted text for a specific page |

**Cascade Logic:**
1. Run `heuristic_classify` on first 3 pages of each doc
2. If confidence ≥ 0.90 → accept
3. Else run `llm_classify` on first 3 pages text
4. If confidence ≥ 0.90 → accept
5. Else run `vision_classify` on page 1 image
6. If confidence ≥ 0.90 → accept, else → human gate (`interrupt()`)

**Tool Definitions:**

```python
def heuristic_classify(text: str) -> dict:
    """Classify document using keyword patterns.
    
    Patterns:
    - File 1 (GC Pay App): "APPLICATION AND CERTIFICATE FOR PAYMENT", "G702", 
      "CONTINUATION SHEET", "G703"
    - File 2 (Sub Pay Apps): Multiple instances of "SUBCONTRACTOR", 
      "Invoice", "Application for Payment" from different entities
    - File 3 (Supporting): "LIEN WAIVER", "CERTIFICATE OF INSURANCE", 
      "CHANGE ORDER"
    
    Args:
        text: Combined text from first 3 pages
    Returns:
        {file_type: str, confidence: float, method: "heuristic", reasoning: str}
    """
    scores = {"file_1": 0, "file_2": 0, "file_3": 0}
    # Pattern matching logic...
    best = max(scores, key=scores.get)
    return {
        "file_type": best,
        "confidence": scores[best] / max_possible,
        "method": "heuristic",
        "reasoning": f"Matched {matched_patterns} keywords for {best}"
    }


async def llm_classify(text: str, model: str = "gpt-4o-mini") -> dict:
    """Classify document using LLM text analysis.
    
    Args:
        text: Combined text from first 3 pages (truncated to 4000 tokens)
        model: Azure OpenAI deployment name
    Returns:
        {file_type: str, confidence: float, method: "llm", reasoning: str}
    """
    response = await openai_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": CLASSIFY_SYSTEM_PROMPT},
            {"role": "user", "content": text[:8000]}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)


async def vision_classify(image_url: str, model: str = "gpt-4o") -> dict:
    """Classify document using vision model on page image.
    
    Args:
        image_url: URL to page image (PNG)
        model: Azure OpenAI vision deployment
    Returns:
        {file_type: str, confidence: float, method: "vision", reasoning: str}
    """
    response = await openai_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": CLASSIFY_VISION_PROMPT},
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": image_url}}
            ]}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)
```

---

### Agent 3: GC Header Extraction Agent

**Purpose:** Extract 19 fields from G702 cover page using regex + LLM fallback.

**Node:** `extract_gc_header_node`

**Tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `extract_with_regex` | `extract_with_regex(pdf_bytes: bytes, page_num: int, field_patterns: dict) → dict` | Regex extraction from pdfplumber text |
| `llm_extract_header` | `llm_extract_header(image_url: str, fields: list[str]) → dict` | Vision LLM extraction for missed fields |
| `get_page_text_plumber` | `get_page_text_plumber(pdf_bytes: bytes, page_num: int) → str` | Raw text extraction via pdfplumber |

**Strategy:**
1. Use `extract_with_regex` (deterministic, free, fast) on page 1
2. For any fields that returned `None` → fallback to `llm_extract_header` (vision)
3. Merge results, assign confidence: regex fields = 0.95, LLM fields = based on model output

**Tool Definitions:**

```python
def extract_with_regex(pdf_bytes: bytes, page_num: int, field_patterns: dict) -> dict:
    """Extract structured fields from PDF page using regex patterns.
    
    Args:
        pdf_bytes: Raw PDF bytes
        page_num: 1-indexed page number to extract from
        field_patterns: Dict mapping field_name → regex pattern
            Example: {"application_no": r"No[.:]?\s*(\d+)", ...}
    Returns:
        Dict mapping field_name → extracted value (str or None if not found)
        Also includes bbox coordinates per field if available
    """
    import pdfplumber
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page = pdf.pages[page_num - 1]
        text = page.extract_text()
        results = {}
        for field, pattern in field_patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            results[field] = match.group(1) if match else None
        return results


async def llm_extract_header(image_url: str, fields: list[str]) -> dict:
    """Extract specified fields from a page image using GPT-4o vision.
    
    Args:
        image_url: URL to the page image (PNG)
        fields: List of field names to extract
            Example: ["from_contractor", "application_no", "period_from"]
    Returns:
        Dict mapping field_name → {value: str, confidence: float, reasoning: str}
    """
    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": EXTRACT_HEADER_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": f"Extract these fields: {json.dumps(fields)}"},
                {"type": "image_url", "image_url": {"url": image_url}}
            ]}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)
```

---

### Agent 4: GC SOV Extraction Agent

**Purpose:** Extract G703 continuation sheet line items using deterministic coordinate parser.

**Node:** `extract_gc_sov_node`

**Tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `pdfplumber_extract_sov` | `pdfplumber_extract_sov(pdf_bytes: bytes, start_page: int, end_page: int) → list[dict]` | Coordinate-based table extraction (NO LLM) |
| `detect_table_boundaries` | `detect_table_boundaries(pdf_bytes: bytes, page_num: int) → dict` | Find table header row and column positions |
| `stitch_multi_page_table` | `stitch_multi_page_table(page_results: list[list[dict]]) → list[dict]` | Merge line items across page boundaries |

**Strategy:** Purely deterministic. No LLM calls. Fast (<1 second for 6 pages).

**Tool Definitions:**

```python
def pdfplumber_extract_sov(
    pdf_bytes: bytes, start_page: int, end_page: int
) -> list[dict]:
    """Extract SOV line items from G703 continuation sheet pages.
    
    Uses coordinate-based parsing (column boundaries from header detection).
    NO LLM is used — purely deterministic.
    
    Args:
        pdf_bytes: Raw PDF bytes
        start_page: First page of G703 (1-indexed)
        end_page: Last page of G703 (1-indexed)
    Returns:
        List of dicts, one per line item:
        [{
            item_no: str,
            time_period: str,
            phases: str,
            type_of_work: str,
            contractor_name: str,
            scheduled_original: float,
            scheduled_change_orders: float,
            scheduled_current: float,
            work_completed_prev: float,
            work_completed_this: float,
            materials_stored: float,
            total_completed: float,
            pct: float,
            balance_to_finish: float,
            retainage: float,
            source_page: int,
            bbox_y: float
        }]
    """
    import pdfplumber
    all_lines = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_idx in range(start_page - 1, end_page):
            page = pdf.pages[page_idx]
            table = page.extract_table()
            # Parse rows into structured dicts using column mapping
            for row in table[1:]:  # Skip header
                all_lines.append(parse_sov_row(row, page_idx + 1))
    return all_lines


def detect_table_boundaries(pdf_bytes: bytes, page_num: int) -> dict:
    """Detect column boundaries of G703 table from header row.
    
    Args:
        pdf_bytes: Raw PDF bytes
        page_num: Page containing table header
    Returns:
        {columns: [{name: str, x0: float, x1: float}], header_y: float}
    """
    # Uses pdfplumber word positions to find column headers
    pass


def stitch_multi_page_table(page_results: list[list[dict]]) -> list[dict]:
    """Merge line items from multiple pages, handling split rows.
    
    Detects if last row of page N continues on first row of page N+1
    (partial data in cells indicates a split row).
    
    Args:
        page_results: List of per-page line item lists
    Returns:
        Merged list with split rows combined
    """
    pass
```

---

### Agent 5: Plan Generation Agent

**Purpose:** Group G703 SOV lines by contractor to create extraction plan for File 2.

**Node:** `generate_plan_node`

**Tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `group_by_contractor` | `group_by_contractor(sov_lines: list[dict]) → list[dict]` | Group SOV lines by contractor_name field |
| `estimate_page_ranges` | `estimate_page_ranges(contractors: list[str], page_count: int) → dict` | Estimate page range per sub in File 2 |

**Strategy:** Purely deterministic. Groups by `contractor_name`, deduplicates, counts lines per contractor.

**Tool Definitions:**

```python
def group_by_contractor(sov_lines: list[dict]) -> list[dict]:
    """Group G703 SOV lines by contractor name.
    
    Args:
        sov_lines: Extracted SOV lines from extract_gc_sov_node
    Returns:
        List of dicts:
        [{
            contractor_name: str,
            line_count: int,
            total_scheduled: float,
            total_completed: float,
            line_indices: list[int]
        }]
    """
    from collections import defaultdict
    groups = defaultdict(list)
    for i, line in enumerate(sov_lines):
        groups[line["contractor_name"]].append(i)
    return [
        {
            "contractor_name": name,
            "line_count": len(indices),
            "total_scheduled": sum(sov_lines[i]["scheduled_current"] or 0 for i in indices),
            "total_completed": sum(sov_lines[i]["total_completed"] or 0 for i in indices),
            "line_indices": indices
        }
        for name, indices in groups.items()
    ]
```

---

### Agent 6: Subcontractor Extraction Agent

**Purpose:** Extract cover pages and SOV lines for each subcontractor from File 2.

**Node:** `extract_subs_node`

**Tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `ocr_page` | `ocr_page(image_url: str) → dict` | Azure Document Intelligence OCR (text + bboxes) |
| `scan_pages` | `scan_pages(page_texts: list[str]) → list[dict]` | LLM identifies page type and sub per page |
| `detect_packet_boundaries` | `detect_packet_boundaries(scan_results: list[dict]) → list[dict]` | Identify start/end page per sub |
| `extract_sub_header` | `extract_sub_header(page_texts: list[str], pages: list[int]) → dict` | LLM extracts 19 cover page fields |
| `extract_sub_sov` | `extract_sub_sov(page_texts: list[str], pages: list[int]) → list[dict]` | LLM extracts SOV line items |
| `batch_ocr` | `batch_ocr(image_urls: list[str]) → list[dict]` | Parallel OCR for multiple pages |

**Strategy:**
1. Batch OCR all File 2 pages (parallel)
2. Scan pages to identify sub boundaries (GPT-4o-mini, cheap)
3. For each sub packet: extract header + SOV lines (GPT-4o for complex pages)
4. Process 3 subs concurrently (`asyncio.gather` with semaphore)

**Tool Definitions:**

```python
async def ocr_page(image_url: str) -> dict:
    """Run Azure Document Intelligence OCR on a single page.
    
    Uses prebuilt-layout model for text + word-level bounding boxes.
    
    Args:
        image_url: URL to page image (PNG)
    Returns:
        {
            text: str,          # Full page text
            words: [{text, bbox: [x0, y0, x1, y1], confidence}],
            lines: [{text, bbox}],
            tables: [{cells: [{row, col, text, bbox}]}]
        }
    """
    from azure.ai.documentintelligence.aio import DocumentIntelligenceClient
    client = DocumentIntelligenceClient(endpoint=DI_ENDPOINT, credential=credential)
    poller = await client.begin_analyze_document(
        "prebuilt-layout",
        analyze_request={"url_source": image_url}
    )
    result = await poller.result()
    return parse_di_result(result)


async def scan_pages(page_texts: list[str]) -> list[dict]:
    """Identify page type and subcontractor for each page using LLM.
    
    Sends pages in batches to GPT-4o-mini for classification.
    
    Args:
        page_texts: List of OCR text per page (0-indexed)
    Returns:
        List of dicts per page:
        [{
            page_num: int,
            page_type: "cover" | "continuation" | "supporting" | "blank",
            subcontractor_name: str | None,
            confidence: float
        }]
    """
    # Batch pages into groups of 10 for efficiency
    results = []
    for batch in chunks(page_texts, 10):
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SCAN_PAGES_PROMPT},
                {"role": "user", "content": format_page_batch(batch)}
            ],
            response_format={"type": "json_object"}
        )
        results.extend(json.loads(response.choices[0].message.content)["pages"])
    return results


def detect_packet_boundaries(scan_results: list[dict]) -> list[dict]:
    """Identify subcontractor packet boundaries from scan results.
    
    A packet starts at a "cover" page and ends before the next "cover" page.
    
    Args:
        scan_results: Per-page scan results from scan_pages()
    Returns:
        [{
            subcontractor_name: str,
            start_page: int,
            end_page: int,
            page_count: int,
            has_continuation: bool
        }]
    """
    packets = []
    current = None
    for scan in scan_results:
        if scan["page_type"] == "cover":
            if current:
                current["end_page"] = scan["page_num"] - 1
                packets.append(current)
            current = {
                "subcontractor_name": scan["subcontractor_name"],
                "start_page": scan["page_num"],
                "has_continuation": False
            }
        elif scan["page_type"] == "continuation" and current:
            current["has_continuation"] = True
    if current:
        current["end_page"] = len(scan_results)
        packets.append(current)
    return packets


async def extract_sub_header(page_texts: list[str], pages: list[int]) -> dict:
    """Extract 19 subcontractor cover page fields using LLM.
    
    Args:
        page_texts: OCR text for the sub's pages
        pages: Page numbers (for provenance)
    Returns:
        Dict with all 19 SubPayApplicationHeader fields + confidence per field
        {
            subcontractor_name: {value: str, confidence: float},
            application_no: {value: str, confidence: float},
            ...
        }
    """
    cover_text = page_texts[0]  # First page of packet is cover
    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": EXTRACT_SUB_HEADER_PROMPT},
            {"role": "user", "content": cover_text}
        ],
        response_format={"type": "json_object"}
    )
    result = json.loads(response.choices[0].message.content)
    result["source_page"] = pages[0]
    return result


async def extract_sub_sov(page_texts: list[str], pages: list[int]) -> list[dict]:
    """Extract SOV line items from subcontractor continuation sheets.
    
    Args:
        page_texts: OCR text for continuation pages only
        pages: Page numbers (for provenance)
    Returns:
        List of dicts per line item:
        [{
            item_no, description, scheduled_value, 
            work_completed_prev, work_completed_this,
            materials_stored, total_completed, pct_complete, retainage,
            source_page, confidence
        }]
    """
    all_lines = []
    for text, page_num in zip(page_texts, pages):
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": EXTRACT_SUB_SOV_PROMPT},
                {"role": "user", "content": text}
            ],
            response_format={"type": "json_object"}
        )
        lines = json.loads(response.choices[0].message.content)["lines"]
        for line in lines:
            line["source_page"] = page_num
        all_lines.extend(lines)
    return all_lines
```

---

### Agent 7: Verification Agent

**Purpose:** Re-read source images to verify extracted values. Assigns confidence scores.

**Node:** `verify_node`

**Tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `verify_field` | `verify_field(field_value: str, image_url: str, field_name: str, bbox: dict) → dict` | Compare extracted value against source image |
| `batch_verify` | `batch_verify(fields: list[dict]) → list[dict]` | Verify multiple fields in one call (batched for efficiency) |
| `compute_confidence` | `compute_confidence(extraction_conf: float, verify_conf: float) → float` | Combine extraction and verification confidence |

**Strategy:**
- For each extracted field: compare value against source page image region
- Uses GPT-4o vision in batch mode (groups fields by page for efficiency)
- Routes based on final confidence: ≥0.85 auto-approve, 0.50-0.84 spot-check, <0.50 retry

**Tool Definitions:**

```python
async def verify_field(
    field_value: str, image_url: str, field_name: str, bbox: dict
) -> dict:
    """Verify an extracted field value against its source page image.
    
    Args:
        field_value: The extracted value to verify
        image_url: URL to the source page image
        field_name: Human-readable field name (for prompt context)
        bbox: Bounding box coordinates {x, y, width, height} (optional, for cropping)
    Returns:
        {
            verified: bool,
            confidence: float,       # 0-1 how confident the value is correct
            suggested_value: str,    # What the verifier thinks the value should be
            reasoning: str           # Why it agrees or disagrees
        }
    """
    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": VERIFY_FIELD_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": f"Verify: {field_name} = '{field_value}'"},
                {"type": "image_url", "image_url": {"url": image_url}}
            ]}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)


async def batch_verify(fields: list[dict]) -> list[dict]:
    """Verify multiple fields from the same page in one LLM call.
    
    Groups by page for efficiency (one image, multiple fields to check).
    
    Args:
        fields: [{field_name, field_value, image_url, bbox}]
    Returns:
        [{field_name, verified, confidence, suggested_value, reasoning}]
    """
    # Group by image_url to minimize LLM calls
    by_page = defaultdict(list)
    for f in fields:
        by_page[f["image_url"]].append(f)
    
    results = []
    for image_url, page_fields in by_page.items():
        field_list = [{"name": f["field_name"], "value": f["field_value"]} for f in page_fields]
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": BATCH_VERIFY_PROMPT},
                {"role": "user", "content": [
                    {"type": "text", "text": json.dumps(field_list)},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]}
            ],
            response_format={"type": "json_object"}
        )
        results.extend(json.loads(response.choices[0].message.content)["results"])
    return results
```

---

### Agent 8: Retry Agent

**Purpose:** Re-attempt extraction for low-confidence fields using alternative strategies.

**Node:** `retry_node`

**Tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `retry_with_alt_prompt` | `retry_with_alt_prompt(field: dict, page_text: str) → dict` | Re-extract using different prompt template |
| `retry_page_by_page` | `retry_page_by_page(field: dict, page_texts: list[str]) → dict` | Extract from single page isolation |
| `retry_with_vision` | `retry_with_vision(field: dict, image_url: str) → dict` | Force vision model on specific region |
| `check_budget` | `check_budget(state: dict) → bool` | Check if token budget allows more retries |

**Strategy:**
1. Attempt 1: `retry_with_alt_prompt` (different phrasing, same text)
2. Attempt 2: `retry_page_by_page` (single page focus)
3. Attempt 3 (if budget allows): `retry_with_vision` (GPT-4o on image)
4. If all fail: escalate to human review (field marked as "needs_review")

**Max retries:** 2 per field  
**Budget guard:** Stops if package total cost > $5.00

**Tool Definitions:**

```python
async def retry_with_alt_prompt(field: dict, page_text: str) -> dict:
    """Re-extract a field using an alternative prompt template.
    
    Uses a more explicit, step-by-step prompt with examples.
    
    Args:
        field: {field_name, table, row_id, original_value, source_page}
        page_text: OCR text of the source page
    Returns:
        {value: str, confidence: float, strategy: "alt_prompt"}
    """
    response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": RETRY_ALT_PROMPT_TEMPLATE.format(
                field_name=field["field_name"]
            )},
            {"role": "user", "content": page_text}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)


async def retry_with_vision(field: dict, image_url: str) -> dict:
    """Force GPT-4o vision extraction on the specific page region.
    
    Args:
        field: {field_name, bbox, source_page}
        image_url: Source page image URL
    Returns:
        {value: str, confidence: float, strategy: "vision"}
    """
    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": RETRY_VISION_PROMPT.format(
                field_name=field["field_name"]
            )},
            {"role": "user", "content": [
                {"type": "text", "text": f"Find the value for: {field['field_name']}"},
                {"type": "image_url", "image_url": {"url": image_url}}
            ]}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)


def check_budget(state: dict) -> bool:
    """Check if we have budget remaining for more LLM calls.
    
    Args:
        state: Current PayAppState
    Returns:
        True if budget available, False if exhausted
    """
    MAX_BUDGET_USD = 5.00
    return state["total_cost_usd"] < MAX_BUDGET_USD
```

---

### Agent 9: Reconciliation Agent

**Purpose:** Run deterministic business rules to detect discrepancies.

**Node:** `reconcile_node`

**Tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `reconcile_cross_file` | `reconcile_cross_file(gc_sov: list, sub_headers: list) → list[dict]` | GC line total vs Sub total per contractor |
| `reconcile_math` | `reconcile_math(lines: list[dict], table: str) → list[dict]` | Validate column arithmetic |
| `reconcile_retainage` | `reconcile_retainage(headers: list[dict]) → list[dict]` | Check retainage % deviation |
| `reconcile_period` | `reconcile_period(current: dict, previous: dict) → list[dict]` | Check period continuity |
| `reconcile_supporting_docs` | `reconcile_supporting_docs(subs: list, docs: list) → list[dict]` | Check for missing lien waivers/COIs |

**Strategy:** ALL deterministic. Zero LLM calls. Runs in <1 second.

**Tool Definitions:**

```python
def reconcile_cross_file(
    gc_sov: list[dict], sub_headers: list[dict]
) -> list[dict]:
    """Compare GC G703 amounts against Sub totals per contractor.
    
    For each contractor in G703, find matching Sub header and compare
    total_completed amounts. Flag if delta > $100.
    
    Args:
        gc_sov: GC SOV lines (grouped by contractor)
        sub_headers: Sub header records
    Returns:
        List of exceptions:
        [{
            type: "CROSS_FILE_MISMATCH",
            severity: "high",
            sub_name: str,
            gc_amount: float,
            sub_amount: float,
            delta: float,
            description: str
        }]
    """
    exceptions = []
    for contractor, lines in group_sov_by_contractor(gc_sov).items():
        gc_total = sum(l["total_completed"] or 0 for l in lines)
        sub = find_matching_sub(contractor, sub_headers)
        if sub:
            sub_total = sub["total_completed_stored"] or 0
            delta = abs(gc_total - sub_total)
            if delta > 100:
                exceptions.append({
                    "type": "CROSS_FILE_MISMATCH",
                    "severity": "high" if delta > 10000 else "medium",
                    "sub_name": contractor,
                    "gc_amount": gc_total,
                    "sub_amount": sub_total,
                    "delta": delta,
                    "description": f"{contractor}: GC shows ${gc_total:,.2f}, Sub shows ${sub_total:,.2f} (Δ${delta:,.2f})"
                })
    return exceptions


def reconcile_math(lines: list[dict], table: str) -> list[dict]:
    """Validate arithmetic relationships in SOV lines.
    
    Checks:
    - total_completed = work_completed_prev + work_completed_this + materials_stored
    - pct = total_completed / scheduled_current * 100
    - balance_to_finish = scheduled_current - total_completed
    
    Args:
        lines: SOV line items
        table: Table name for exception reference
    Returns:
        List of math error exceptions
    """
    exceptions = []
    for line in lines:
        expected_total = (
            (line.get("work_completed_prev") or 0) +
            (line.get("work_completed_this") or 0) +
            (line.get("materials_stored") or 0)
        )
        actual_total = line.get("total_completed") or 0
        if abs(expected_total - actual_total) > 1:  # $1 tolerance
            exceptions.append({
                "type": "MATH_ERROR",
                "severity": "medium",
                "sub_name": line.get("contractor_name", ""),
                "description": f"Item {line['item_no']}: prev+this+stored={expected_total:.2f} ≠ total={actual_total:.2f}",
                "delta": abs(expected_total - actual_total)
            })
    return exceptions
```

---

### Agent 10: Chat Routing Agent

**Purpose:** Parse user chat messages, determine intent, execute appropriate action.

**Node:** `chat_node` (invoked independently, not part of main pipeline)

**Tools:**

| Tool | Signature | Description |
|------|-----------|-------------|
| `classify_intent` | `classify_intent(message: str, context: dict) → dict` | Determine what the user wants |
| `generate_explanation` | `generate_explanation(context: dict, question: str) → str` | Generate natural language answer about extractions |
| `execute_command` | `execute_command(intent: str, params: dict, state: dict) → dict` | Execute the parsed command |
| `resolve_entity` | `resolve_entity(name: str, state: dict) → str` | Fuzzy match sub name to exact entity |

**Supported Intents:**
- `re_extract` → Trigger re-extraction for a sub
- `accept_all` → Bulk approve items
- `show_source` → Navigate PDF to field location
- `override_field` → Update field value
- `skip_step` → Skip a graph node
- `rerun_reconcile` → Trigger recon re-run
- `ask_status` → Report current state
- `ask_question` → Explain a decision/field/exception

**Tool Definitions:**

```python
async def classify_intent(message: str, context: dict) -> dict:
    """Classify user's chat message into a structured intent.
    
    Args:
        message: User's natural language message
        context: Current package state (status, sub names, exceptions)
    Returns:
        {
            intent: str,     # One of the supported intents above
            params: dict,    # Extracted parameters (sub_name, field_name, value, etc.)
            confidence: float
        }
    """
    response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": CHAT_INTENT_PROMPT.format(
                sub_names=context["sub_names"],
                current_status=context["status"]
            )},
            {"role": "user", "content": message}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)


async def generate_explanation(context: dict, question: str) -> str:
    """Generate a natural language explanation for a user question.
    
    Args:
        context: Relevant data (field values, confidence scores, exceptions, etc.)
        question: User's question
    Returns:
        Full-sentence explanation (professional tone, cites evidence)
    """
    response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": EXPLANATION_PROMPT},
            {"role": "user", "content": f"Question: {question}\n\nContext: {json.dumps(context)}"}
        ]
    )
    return response.choices[0].message.content


def resolve_entity(name: str, state: dict) -> str:
    """Fuzzy-match a user-provided name to an actual subcontractor.
    
    Args:
        name: User's input (may be partial, misspelled)
        state: Current state containing extraction_plan
    Returns:
        Best-matching subcontractor name, or raises AmbiguousError
    """
    from difflib import get_close_matches
    sub_names = [s["contractor_name"] for s in state["extraction_plan"]]
    matches = get_close_matches(name, sub_names, n=1, cutoff=0.6)
    if not matches:
        raise EntityNotFoundError(f"No subcontractor matching '{name}'")
    return matches[0]
```

---

## Conditional Edge Functions

```python
def route_classification(state: PayAppState) -> str:
    """Route after classification: auto-confirm or human gate."""
    min_confidence = min(c["confidence"] for c in state["classifications"])
    if min_confidence >= 0.90:
        return "auto_confirmed"
    return "needs_human"


def route_plan(state: PayAppState) -> str:
    """Route after plan generation: auto-confirm or human gate."""
    # Always require human confirmation for extraction plan
    return "needs_human"


def route_verification(state: PayAppState) -> str:
    """Route after verification: proceed or retry low-confidence fields."""
    low_confidence_fields = [
        f for f in state["field_scores"] if f["confidence"] < 0.50
    ]
    if low_confidence_fields and check_budget(state):
        return "needs_retry"
    return "all_good"
```

---

## Human Gates (interrupt/resume)

```python
from langgraph.types import interrupt

def human_classify_gate(state: PayAppState) -> PayAppState:
    """Pause for user to confirm/override classification."""
    response = interrupt({
        "type": "classification_confirmation",
        "classifications": state["classifications"],
        "message": "Please confirm or override document classifications."
    })
    # response comes from /resume endpoint
    state["classifications"] = response.get("classifications", state["classifications"])
    state["classification_confirmed"] = True
    return state


def human_plan_gate(state: PayAppState) -> PayAppState:
    """Pause for user to confirm extraction plan."""
    response = interrupt({
        "type": "plan_confirmation",
        "extraction_plan": state["extraction_plan"],
        "message": "Please confirm the subcontractor list for extraction."
    })
    state["extraction_plan"] = response.get("plan", state["extraction_plan"])
    state["plan_confirmed"] = True
    return state


def human_review_gate(state: PayAppState) -> PayAppState:
    """Final review gate — user resolves remaining items."""
    response = interrupt({
        "type": "final_review",
        "spot_checks": [f for f in state["field_scores"] if f["status"] == "spot_check"],
        "escalated": [f for f in state["field_scores"] if f["status"] == "escalated"],
        "exceptions": [e for e in state["exceptions"] if e["status"] == "open"],
        "message": "Please review flagged items and resolve exceptions."
    })
    # Apply user resolutions
    for resolution in response.get("resolutions", []):
        apply_resolution(state, resolution)
    return state
```

---

## Token Cost Tracking

Every LLM call updates state:

```python
def track_cost(response, state: PayAppState):
    """Track token usage and estimated cost."""
    usage = response.usage
    state["total_tokens"] += usage.total_tokens
    # Pricing (approximate): gpt-4o = $0.005/1K input, $0.015/1K output
    # gpt-4o-mini = $0.00015/1K input, $0.0006/1K output
    input_cost = usage.prompt_tokens * PRICE_PER_INPUT_TOKEN
    output_cost = usage.completion_tokens * PRICE_PER_OUTPUT_TOKEN
    state["total_cost_usd"] += input_cost + output_cost
```

---

*End of Agent Orchestration*
