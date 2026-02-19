# PDF Test Fixtures

Place sample PDF files here for manual QA and integration testing.

## Required fixtures

| Filename | Description |
|---|---|
| `single-page-portrait.pdf` | A4 portrait, single page with text (vendor, invoice number, total) |
| `multi-page-portrait.pdf` | A4 portrait, 3 pages. Key invoice data on page 1. |
| `single-page-landscape.pdf` | Landscape orientation — verifies correct width/height in `PdfPageImage` |
| `corrupt.pdf` | Invalid/truncated file — used to test `PdfConversionError('INVALID_PDF')` |

## How to obtain

These fixtures are **not committed** to the repository (binary files, copyright considerations).  
Generate minimal test PDFs with `pdf-lib` (Node.js script) or a command-line tool such as:

```bash
# Example: create a minimal single-page PDF using ImageMagick
convert -size 1240x1754 xc:white -font Helvetica -pointsize 36 \
  -draw "text 100,200 'ACME Corp\nInvoice #INV-001\nTotal: $500.00'" \
  single-page-portrait.pdf
```

Or use any PDF editor to create small test documents.

## Usage in tests

Unit and integration tests use `MockPdfConverter` — **no fixture PDFs are needed for those**.

Fixture PDFs are only required for:
- On-device end-to-end manual QA
- Future native-module integration tests that bypass `MockPdfConverter`
