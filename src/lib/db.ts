import fs from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'data.json');

export type Region = {
  id: string;
  name: string;
  type: 'HO' | 'Operasional';
};

export type Unit = {
  id: string;
  regionId: string;
  name: string;
  abbreviation?: string;
  type: 'Estate' | 'Mill' | 'RMO' | 'Lainnya';
};

export type UserRole = {
  id: string;
  name: string;
  accessLevel: 'view' | 'edit' | 'admin';
};

export type InvitedPT = {
  id: string;
  ptName: string;
  email: string;
  contactName: string;
  contactPhone: string;
  initialBid?: number;
  initialBidFile?: string;
  isInvitedToRev1?: boolean;
  revisedBid1?: number;
  revisedBid1File?: string;
  isInvitedToRev2?: boolean;
  revisedBid2?: number;
  revisedBid2File?: string;
};

export type ProgressUpdate = {
  id: string;
  date: string;
  percent: number;
};

export type Project = {
  id: string;
  unitId: string;
  category: 'CAPEX' | 'OPEX';
  station?: string; // Only for Mill units
  name: string;
  planQty: number;
  planPricePerQty: number;
  type: 'MECHANICAL' | 'CIVIL' | 'ELECTRICAL' | 'HEAVY EQUIPMENT' | 'SERVICE CONTRACT';
  execution: 'NON LEBARAN' | 'LEBARAN';
  createdAt: string;
  
  // Phase 1->2 Submission (Ops)
  boqFiles?: string[];
  drawingFiles?: string[];
  docSubmissionDate?: string;
  docComplete?: boolean;
  continueProcess?: boolean;
  
  // Phase 2.1 Tender Batch (Eng HO)
  tenderDateToPsd?: string;
  invitedPts?: InvitedPT[];

  // Phase 2.2 & 2.3 PSD Execution (Purchasing)
  tenderPsdDate?: string;
  openTenderDate?: string;
  tenderResultWinner?: string;
  finalTenderPrice?: number;
  isBiddingFinished?: boolean;
  // Contract Phase
  contractNumber?: string;
  actualQty?: number;
  actualCostPerUnit?: number;
  actualTotalCost?: number;
  balance?: number;
  // Progress
  prNo?: string;
  poNo?: string;
  plannedDuration?: string;
  startDate?: string;
  progressPercent?: number;
  progressUpdateDate?: string;
  srNo?: string;
  bastlDate?: string;
  bastDate?: string;
  progressHistory?: ProgressUpdate[];
};

export type User = {
  id: string;
  name: string;
  password?: string;
  roleId: string;
  unitId?: string; // Optional: Only if assigned to a specific unit (like Mill Manager)
  regionId?: string; // Optional: Only if assigned to a specific region
};

export type VendorContact = {
  email: string;
  personName: string;
  contactNumber: string;
};

export type MasterVendor = {
  id: string;
  name: string;
  contacts: VendorContact[];
};

export type DatabaseSchema = {
  regions: Region[];
  units: Unit[];
  roles: UserRole[];
  users: User[];
  projects: Project[];
  vendors: MasterVendor[];
};

const defaultData: DatabaseSchema = {
  regions: [
    { id: '1', name: 'HEAD OFFICE (HO)', type: 'HO' },
    { id: '2', name: 'NORTH SUMATERA (NS)', type: 'Operasional' },
    { id: '3', name: 'BENGKULU (BK)', type: 'Operasional' },
    { id: '4', name: 'SOUTH SUMATERA (SS)', type: 'Operasional' },
  ],
  units: [
    { id: '1', regionId: '2', name: 'RMO North Sumatera', type: 'RMO' },
    { id: '2', regionId: '2', name: 'Mill A', type: 'Mill' },
    { id: '3', regionId: '2', name: 'Estate A', type: 'Estate' },
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
    { id: '17', name: 'Staff Project Civil RMO', accessLevel: 'edit' },
    { id: '18', name: 'Administrator', accessLevel: 'admin' },
    { id: '19', name: 'Director Engineering', accessLevel: 'view' },
    { id: '20', name: 'Staff Purchasing', accessLevel: 'edit' },
    { id: '21', name: 'Project Manager Engineering HO', accessLevel: 'edit' }
  ],
  users: [],
  projects: [],
  vendors: []
};

export function readDb(): DatabaseSchema {
  if (!fs.existsSync(dataFilePath)) {
    writeDb(defaultData);
    return defaultData;
  }
  const fileData = fs.readFileSync(dataFilePath, 'utf-8');
  const parsed = JSON.parse(fileData) as Partial<DatabaseSchema>;
  
  // Migrate old data
  if (parsed.projects) {
    parsed.projects = parsed.projects.map((p: any) => {
      if (p.boqFile && !p.boqFiles) p.boqFiles = [p.boqFile];
      if (p.drawingFile && !p.drawingFiles) p.drawingFiles = [p.drawingFile];
      delete p.boqFile;
      delete p.drawingFile;
      return p;
    });
  }

  const merged: DatabaseSchema = {
    ...defaultData,
    ...parsed,
    regions: defaultData.regions, // Force hardcode to exactly 4 regions
    users: parsed.users || [],
    vendors: parsed.vendors || [],
    roles: defaultData.roles // Always use default roles to ensure new roles are loaded
  };
  
  return merged;
}

export function writeDb(data: DatabaseSchema) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
}
