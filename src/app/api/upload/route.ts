import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const urls: string[] = [];
    
    const files = formData.getAll('files') as File[];
    
    for (const file of files) {
      if (!file || !(file instanceof File)) continue;
      
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Create a unique filename
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const filename = `${uniqueSuffix}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, buffer);
      
      urls.push(`/uploads/${filename}`);
    }

    return NextResponse.json({ urls });
  } catch (error: any) {
    console.error('Error uploading files:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
