import { parse } from "kordoc";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Basic usage example for kordoc
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

    console.log("kordoc is successfully installed!");
    console.log("Check the kordoc documentation at https://github.com/chrisryugj/kordoc for more details.");

  } catch (error) {
    console.error("An error occurred:", error);
  }
}

run();
