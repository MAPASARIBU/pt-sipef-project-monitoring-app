const fs = require('fs');

const dataFile = 'data.json';
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// Project data based on earlier screenshots
const newProjects = [
  {
    id: "proj_btom_1",
    unitId: "1781945251035", // BTOM
    category: "CAPEX",
    name: "FFB CAGE 4 TON",
    planQty: 10,
    planPricePerQty: 74000000,
    type: "MECHANICAL",
    execution: "NON LEBARAN",
    createdAt: new Date().toISOString()
  },
  {
    id: "proj_btom_2",
    unitId: "1781945251035", // BTOM
    category: "CAPEX",
    name: "GANTI PIPA EXHAUST STERILIZER",
    planQty: 1,
    planPricePerQty: 250000000,
    type: "MECHANICAL",
    execution: "NON LEBARAN",
    createdAt: new Date().toISOString()
  },
  {
    id: "proj_btom_3",
    unitId: "1781945251035", // BTOM
    category: "CAPEX",
    name: "REPOSITION BAK CONDENSATE",
    planQty: 1,
    planPricePerQty: 450000000,
    type: "MECHANICAL",
    execution: "NON LEBARAN",
    createdAt: new Date().toISOString()
  },
  {
    id: "proj_btom_4",
    unitId: "1781945251035", // BTOM
    category: "CAPEX",
    name: "UPGRADE TIPPLER",
    planQty: 1,
    planPricePerQty: 1300000000,
    type: "MECHANICAL",
    execution: "NON LEBARAN",
    createdAt: new Date().toISOString()
  },
  {
    id: "proj_mmom_1",
    unitId: "1781945267994", // MMOM
    category: "CAPEX",
    station: "Clarification",
    name: "REPLACEMENT BOARDEST AREA SLUDGE TANK LINE 2",
    planQty: 1,
    planPricePerQty: 100000000, // Estimated
    type: "MECHANICAL",
    execution: "NON LEBARAN",
    createdAt: new Date().toISOString()
  },
  {
    id: "proj_mmom_2",
    unitId: "1781945267994", // MMOM
    category: "CAPEX",
    station: "Boiler",
    name: "AUTOFEEDER BOILER",
    planQty: 1,
    planPricePerQty: 150000000, // Estimated
    type: "MECHANICAL",
    execution: "NON LEBARAN",
    createdAt: new Date().toISOString()
  }
];

if (!data.projects) data.projects = [];

// Only push if they don't exist
newProjects.forEach(np => {
  if (!data.projects.find(p => p.name === np.name)) {
    data.projects.push(np);
  }
});

fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
console.log('Projects successfully restored to data.json');
