import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authzErrorResponse, requireAdmin } from '@/lib/authz';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdmin();
    const body = await request.json();
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.googleBusinessUrl !== undefined) data.googleBusinessUrl = body.googleBusinessUrl || null;
    if (body.mainWebsiteUrl !== undefined) data.mainWebsiteUrl = body.mainWebsiteUrl || null;

    const account = await prisma.mainAccount.update({
      where: { id },
      data
    });
    return NextResponse.json({ account });
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }

}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireAdmin();
    await prisma.mainAccount.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = authzErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
