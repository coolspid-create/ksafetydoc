import fs from 'fs';
const data = JSON.parse(fs.readFileSync('kordoc_debug_tables.json', 'utf8'));
// Analyze first 2 tables
for (let ti = 0; ti < Math.min(data.length, 2); ti++) {
  const t = data[ti].table;
  console.log(`\n=== Table ${ti}: ${t.rows} rows x ${t.cols} cols ===`);
  for (let r = 0; r < Math.min(t.cells.length, 8); r++) {
    const row = t.cells[r];
    const significant = [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell.text || cell.colSpan > 1 || cell.rowSpan > 1) {
        const txt = (cell.text || '').substring(0, 25);
        significant.push(`[${c}] cs=${cell.colSpan} rs=${cell.rowSpan} "${txt}"`);
      }
    }
    console.log(`  Row ${r} (${row.length} cells, ${significant.length} significant): ${significant.join(' | ')}`);
  }
}
