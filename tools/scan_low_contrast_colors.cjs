const fs = require('fs');

function checkFile(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  console.log(`\n=== Checking ${filename} ===`);
  lines.forEach((line, idx) => {
    if (line.includes("color: '#e2e8f0'") || line.includes('color: "#e2e8f0"') ||
        line.includes("color: '#cbd5e1'") || line.includes('color: "#cbd5e1"')) {
      console.log(`L${idx+1}: ${line.trim().slice(0, 100)}`);
    }
  });
}

checkFile('src/ShopDiagnosisView.jsx');
checkFile('src/App.jsx');
