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
    if (body.coyoTaskManagerKey !== undefined) {
      if (typeof body.coyoTaskManagerKey !== 'string' || body.coyoTaskManagerKey.length > 500) return NextResponse.json({ error: 'Invalid Coyô TaskManager Key' }, { status: 400 });
      data.coyoTaskManagerKey = body.coyoTaskManagerKey.trim() || null;
    }
    if (body.coyoClientAcronym !== undefined) {
      if (typeof body.coyoClientAcronym !== 'string' || body.coyoClientAcronym.trim().length > 100) {
        return NextResponse.json({ error: 'Invalid Coyô client prefix' }, { status: 400 });
      }
      data.coyoClientAcronym = body.coyoClientAcronym.trim().toUpperCase() || null;
    }
    if (body.name !== undefined) data.name = body.name;
    if (body.googleBusinessUrl !== undefined) data.googleBusinessUrl = body.googleBusinessUrl || null;
    if (body.mainWebsiteUrl !== undefined) data.mainWebsiteUrl = body.mainWebsiteUrl || null;
    if (body.waTrackerAccountId !== undefined) data.waTrackerAccountId = body.waTrackerAccountId || null;

    const account = await prisma.mainAccount.update({
      where: { id },
      data
    });
    const { coyoTaskManagerKey, ...safeAccount } = account;
    return NextResponse.json({ account: { ...safeAccount, hasCoyoTaskManagerKey: Boolean(coyoTaskManagerKey) } });
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
