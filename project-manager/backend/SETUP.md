# Backend Setup

## Prerequisites

- **Node.js 22+**
- **Python 3.10+** (required for PDF extraction)
- **PyMuPDF** Python package

## Install Python Dependencies

```bash
pip install pymupdf
```

### Verify Installation

```bash
python -c "import fitz; print(f'PyMuPDF {fitz.version}')"
```

If this prints a version string (e.g. `PyMuPDF 1.24.x`), the dependency is installed correctly.

## Install Node Dependencies

```bash
npm install
```

## Run the Server

```bash
node server.js
```

The server starts on port 3001.

---

> **Production Note:** The PyMuPDF/pdfplumber dependency is used for local PDF text extraction during development. Before production deployment, this must be replaced with **Azure Document Intelligence** (formerly Form Recognizer) for scalable, cloud-based document processing.
