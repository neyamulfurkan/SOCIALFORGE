import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateUploadSignature } from '@/lib/cloudinary';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user?.businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const folder = `socialforge/${session.user.businessId}/products`;

  try {
    const signatureData = await generateUploadSignature(folder);
    return NextResponse.json({ data: signatureData });
  } catch (error) {
    console.error('Upload signature error:', error);
    return NextResponse.json({ error: 'Failed to generate upload signature' }, { status: 503 });
  }
}