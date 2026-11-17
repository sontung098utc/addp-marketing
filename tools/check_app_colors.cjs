const fs = require('fs');
const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');

const issues = [];
lines.forEach((line, idx) => {
  if (line.includes("color: '#fff'") || line.includes('color: "#fff"') || 
      line.includes("color: '#ffffff'") || line.includes('color: "#ffffff"') ||
      line.includes('text-white')) {
    // Check if within dark background container or button
    const surrounding = lines.slice(Math.max(0, idx - 5), idx + 2).join(' ');
    // Simple heuristic: if not obviously inside a dark button, gradient, or badge
    const isBadgeOrBtn = surrounding.includes('btn-primary') || 
                         surrounding.includes('badge') || 
                         surrounding.includes('gradient') ||
                         surrounding.includes('background: #') ||
                         surrounding.includes('background: "rgb') ||
                         surrounding.includes("background: 'rgb");
    issues.push({ line: idx + 1, text: line.trim(), isBadgeOrBtn });
  }
});

console.log(`Total white text lines: ${issues.length}`);
const potentialProblems = issues.filter(i => !i.isBadgeOrBtn);
console.log(`Potential contrast problem lines without dark background: ${potentialProblems.length}`);
potentialProblems.slice(0, 30).forEach(p => console.log(`L${p.line}: ${p.text.slice(0, 80)}`));
