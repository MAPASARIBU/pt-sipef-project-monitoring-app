const fs = require('fs');

const defaultData = {
  regions: [
    { id: '1', name: 'HEAD OFFICE (HO)', type: 'HO' },
    { id: '2', name: 'NORTH SUMATERA (NS)', type: 'Operasional' },
    { id: '3', name: 'BENGKULU (BK)', type: 'Operasional' },
    { id: '4', name: 'SOUTH SUMATERA (SS)', type: 'Operasional' },
  ],
  units: [
    { id: "1781945251035", regionId: "3", name: "BUNGA TANJUNG POM", abbreviation: "BTOM", type: "Mill" },
    { id: "1781945267994", regionId: "3", name: "MUKO MUKO POM", abbreviation: "MMOM", type: "Mill" },
    { id: "1781945281239", regionId: "3", name: "BUNGA TANJUNG ESTATE", abbreviation: "BTEE", type: "Estate" },
    { id: "1781945311572", regionId: "3", name: "RMO BK", abbreviation: "ROBK", type: "RMO" },
    { id: "17819457219660", regionId: "3", name: "SUNGAI TERAMANG ESTATE", abbreviation: "STGE", type: "Estate" },
    { id: "17819457219661", regionId: "3", name: "AIR BIKUK ESTATE", abbreviation: "ABKE", type: "Estate" },
    { id: "17819457219662", regionId: "3", name: "BATU KUDA ESTATE", abbreviation: "BKDE", type: "Estate" },
    { id: "17819457219663", regionId: "3", name: "AIR BULUH ESTATE", abbreviation: "ABEE", type: "Estate" },
    { id: "17819457219664", regionId: "3", name: "MALIN DEMAN ESTATE", abbreviation: "MDEE", type: "Estate" }
  ],
  roles: [
    { id: '1', name: 'Head of Operation', accessLevel: 'view' },
    { id: '2', name: 'Deputy Director Engineering', accessLevel: 'view' },
    { id: '3', name: 'Regional Director', accessLevel: 'view' },
    { id: '4', name: 'Regional Control Mill', accessLevel: 'view' },
    { id: '5', name: 'Regional Control Estate', accessLevel: 'view' },
    { id: '6', name: 'Mill Manager', accessLevel: 'view' },
    { id: '7', name: 'Estate Manager', accessLevel: 'view' },
    { id: '8', name: 'Project Manager RMO', accessLevel: 'edit' },
    { id: '9', name: 'Assistant Kepala Mill', accessLevel: 'edit' },
    { id: '10', name: 'Assistant Kepala Estate', accessLevel: 'edit' },
    { id: '11', name: 'Office Assistant Mill', accessLevel: 'edit' },
    { id: '12', name: 'Office Assistant Estate', accessLevel: 'edit' },
    { id: '13', name: 'Staff Engineering HO Civil', accessLevel: 'edit' },
    { id: '14', name: 'Staff Engineering HO Mechanical', accessLevel: 'edit' },
    { id: '15', name: 'Staff Engineering HO Electrical', accessLevel: 'edit' },
    { id: '16', name: 'Staff Engineering HO Heavy Equipment', accessLevel: 'edit' },
    { id: '17', name: 'Staff Project Civil RMO', accessLevel: 'edit' }
  ],
  users: [
    { id: "u1", name: "MAPASARIBU", roleId: "6", unitId: "1781945251035", password: "MAPASARIBU123" },
    { id: "u2", name: "EFENDI", roleId: "11", unitId: "1781945251035", password: "EFENDI123" },
    { id: "u4", name: "MMOM_MANAGER", roleId: "6", unitId: "1781945267994", password: "123" },
    { id: "u5", name: "HO_MECH", roleId: "14", password: "123" },
    { id: "u6", name: "PM_RMO", roleId: "8", unitId: "1781945311572", password: "123" },
    { id: "u7", name: "REGIONAL_DIR", roleId: "3", regionId: "3", password: "123" }
  ],
  projects: [
    {
      id: "17819658915270",
      unitId: "1781945267994",
      category: "CAPEX",
      station: "Clarification",
      name: "NEW BOILER",
      planQty: 1,
      planPricePerQty: 31000000000,
      type: "MECHANICAL",
      execution: "NON LEBARAN",
      createdAt: new Date().toISOString(),
      docComplete: true,
      continueProcess: true,
      tenderResultWinner: "PT INDOPALMA AGRO PERSADA",
      finalTenderPrice: 31000000000,
      contractNumber: "HO-BK-MMOM-0001",
      actualQty: 1,
      actualCostPerUnit: 31000000000
    }
  ],
  vendors: [
    {
      id: "v1",
      name: "PT TRIROYAL",
      contacts: []
    },
    {
      id: "v2",
      name: "PT INDOPALMA AGRO PERSADA",
      contacts: []
    }
  ]
};

fs.writeFileSync('data.json', JSON.stringify(defaultData, null, 2), 'utf-8');
console.log('data.json reconstructed successfully.');
