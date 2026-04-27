import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.googleBusinessUrl !== undefined) data.googleBusinessUrl = body.googleBusinessUrl || null;

    const account = await prisma.mainAccount.update({
      where: { id },
      data
    });
    return NextResponse.json({ account });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }

}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.mainAccount.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
