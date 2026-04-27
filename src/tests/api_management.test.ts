/**
 * @jest-environment node
 */
import { GET, POST } from '../app/api/accounts/route';
import { PATCH, DELETE as DELETE_ACCOUNT } from '../app/api/accounts/[id]/route';

import { prisma } from '../lib/prisma';
import { NextResponse } from 'next/server';

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      ok: (init?.status || 200) < 400
    }))
  }
}));

describe('Account Management API', () => {
  let testAccountId: string;

  beforeAll(async () => {
    // Cleanup and create a test account
    await prisma.mainAccount.deleteMany();
    const acc = await prisma.mainAccount.create({
      data: { name: 'Test Account' }
    });
    testAccountId = acc.id;
  });

  afterAll(async () => {
    await prisma.mainAccount.deleteMany();
    await prisma.$disconnect();
  });

  it('should update account name via PATCH', async () => {
    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name' })
    });

    const response = await PATCH(request, { params: { id: testAccountId } });
    const data = await response.json();

    expect(data.account.name).toBe('Updated Name');
    
    const dbAcc = await prisma.mainAccount.findUnique({ where: { id: testAccountId } });
    expect(dbAcc?.name).toBe('Updated Name');
  });

  it('should save a googleBusinessUrl via PATCH', async () => {
    const url = 'https://business.google.com/n/12345';
    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleBusinessUrl: url })
    });

    const response = await PATCH(request, { params: { id: testAccountId } });
    const data = await response.json();

    expect(data.account.googleBusinessUrl).toBe(url);
    const dbAcc = await prisma.mainAccount.findUnique({ where: { id: testAccountId } });
    expect(dbAcc?.googleBusinessUrl).toBe(url);
  });

  it('should clear googleBusinessUrl when null is passed', async () => {
    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleBusinessUrl: null })
    });

    const response = await PATCH(request, { params: { id: testAccountId } });
    const data = await response.json();

    expect(data.account.googleBusinessUrl).toBeNull();
  });

  it('should clear googleBusinessUrl when empty string is passed', async () => {
    // First set a URL
    await prisma.mainAccount.update({ where: { id: testAccountId }, data: { googleBusinessUrl: 'https://business.google.com/' } });

    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleBusinessUrl: '' })
    });

    const response = await PATCH(request, { params: { id: testAccountId } });
    const data = await response.json();
    expect(data.account.googleBusinessUrl).toBeNull();
  });

  it('should delete account via DELETE', async () => {
    const request = new Request('http://localhost/api/accounts/' + testAccountId, {
      method: 'DELETE'
    });

    const response = await DELETE_ACCOUNT(request, { params: { id: testAccountId } });
    expect(response.status).toBe(200);

    const dbAcc = await prisma.mainAccount.findUnique({ where: { id: testAccountId } });
    expect(dbAcc).toBeNull();
  });
});

