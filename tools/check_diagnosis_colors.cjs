const fs = require('fs');
const content = fs.readFileSync('src/ShopDiagnosisView.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("color: '#fff'") || line.includes("color: '#ffffff'")) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
