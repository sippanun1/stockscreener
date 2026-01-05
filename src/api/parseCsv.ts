export function parseCsv(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  
  if (lines.length === 0) return [];
  
  // Get headers from first line
  const headers = lines[0].split(',').map(h => h.trim());
  
  // Parse data rows
  const data = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index];
      
      // Try to convert to number if possible
      if (value && !isNaN(Number(value))) {
        row[header] = Number(value);
      } else {
        row[header] = value;
      }
    });
    
    return row;
  });
  
  return data;
}
