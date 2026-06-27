import { NextResponse } from 'next/server';
import { readDb, writeDb, DatabaseSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = readDb();
  // Sort projects descending by updatedAt (newest first), fallback to id
  data.projects.sort((a, b) => (b.updatedAt || Number(b.id)) - (a.updatedAt || Number(a.id)));
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    if (payload.action === 'batchUpdateContract') {
      const data = readDb();
      payload.updates.forEach((u: any) => {
        const pIndex = data.projects.findIndex(x => x.id === u.id);
        if (pIndex >= 0) {
          data.projects[pIndex].contractNumber = u.contractNumber;
          data.projects[pIndex].plannedDuration = u.plannedDuration;
          data.projects[pIndex].actualQty = u.actualQty;
          data.projects[pIndex].actualCostPerUnit = u.actualCostPerUnit;
          data.projects[pIndex].updatedAt = Date.now();
        }
      });
      writeDb(data);
      return NextResponse.json({ success: true });
    }

    const data: DatabaseSchema = payload;
    const oldData = readDb();
    
    // Automatically set updatedAt for any project that changed
    data.projects.forEach(newP => {
      const oldP = oldData.projects.find(p => p.id === newP.id);
      if (!oldP) {
        newP.updatedAt = Date.now();
      } else {
        // Exclude updatedAt from comparison
        const { updatedAt: oldUpdated, ...oldProps } = oldP;
        const { updatedAt: newUpdated, ...newProps } = newP;
        if (JSON.stringify(oldProps) !== JSON.stringify(newProps)) {
          newP.updatedAt = Date.now();
        } else {
          newP.updatedAt = oldP.updatedAt || Number(oldP.id);
        }
      }
    });

    writeDb(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update DB' }, { status: 500 });
  }
}
