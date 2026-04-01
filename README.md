# Ksafety Doc

This project is a smart document intelligence service powered by `kordoc`, designed to parse Korean documents (HWP, HWPX, PDF) into structured Markdown, JSON, and XML.

## Installation

```bash
npm install kordoc pdfjs-dist
```

*Note: `pdfjs-dist` is required as a peer dependency for PDF parsing and is often needed in ESM environments to prevent import errors even if you are only parsing HWP files.*

## Basic Usage

Check `example.js` for a simple demonstration of how to import the parser.

```javascript
import { parse } from "kordoc";
import { readFileSync } from "fs";

// To parse a file
const buffer = readFileSync("your-file.hwpx");
const result = await parse(buffer.buffer);

if (result.success) {
  console.log(result.markdown);
  console.log(result.metadata);
}
```

## Features

- **HWP/HWPX/PDF** format support.
- Conversion to **Markdown**.
- Structured data extraction (blocks, metadata).
- Korean-specific document handling (e.g. government forms).

For more details, visit: [https://github.com/chrisryugj/kordoc](https://github.com/chrisryugj/kordoc)
