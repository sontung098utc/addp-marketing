const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.jsx');
let content = fs.readFileSync(appPath, 'utf8');

const brokenSvg = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='160' viewBox='0 0 120 160'%3E%3Crect width='120' height='160' fill='%231e293b'/%3E%3Cpath d='M48 60 L80 80 L48 100 Z' fill='%2364748b'/%3E%3C/svg%3E";
const safeSvg = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22160%22 viewBox=%220 0 120 160%22%3E%3Crect width=%22120%22 height=%22160%22 fill=%22%231e293b%22/%3E%3Cpath d=%22M48 60 L80 80 L48 100 Z%22 fill=%22%2364748b%22/%3E%3C/svg%3E";

const count = content.split(brokenSvg).length - 1;
content = content.split(brokenSvg).join(safeSvg);
fs.writeFileSync(appPath, content, 'utf8');
console.log(`Successfully replaced ${count} occurrences with quote-safe SVG URI in App.jsx`);
