const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const files = ['CommerceDashboardView.jsx', 'CommerceAffiliateView.jsx', 'CommerceShopeeView.jsx', 'CommerceReportView.jsx', 'CommerceSyncManagementView.jsx'];

files.forEach(file => {
  const filePath = path.join(srcDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log(`\n=== ${file} ===`);
  lines.forEach((line, idx) => {
    if (line.includes("color: '#fff'") || line.includes('color: "#fff"') || 
        line.includes("color: '#ffffff'") || line.includes('color: "#ffffff"') ||
        line.includes('text-white')) {
      console.log(`L${idx+1}: ${line.trim()}`);
    }
  });
});
