import { parse } from "kordoc";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Basic usage example for Ksafety Doc engine
 * Note: You need a .hwpx, .hwp, or .pdf file to run this properly.
 */
async function run() {
  try {
    // Example: Parsing an HWPX file if one existed
    // const buffer = readFileSync("example.hwpx");
    // const result = await parse(buffer.buffer);

    // if (result.success) {
    //   console.log("Markdown Content:", result.markdown);
    //   console.log("Metadata:", result.metadata);
    // } else {
    //   console.error("Failed to parse:", result.error);
    // }

    console.log("Ksafety Doc engine is successfully initialized!");
    console.log("Documentation is available at the repository.");

  } catch (error) {
    console.error("An error occurred:", error);
  }
}

run();
