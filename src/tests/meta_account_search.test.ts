import { filterMetaAccounts } from '@/lib/metaAccountSearch';

describe('Meta account search', () => {
  const accounts = [
    { id: '101', actId: 'act_101', name: 'Northwind Ads' },
    { id: '202', name: 'Contoso Page', facebookPageId: 'page-55' },
  ];

  it('keeps the full list when the search is empty', () => {
    expect(filterMetaAccounts(accounts, '   ')).toBe(accounts);
  });

  it('matches account names and IDs without case sensitivity', () => {
    expect(filterMetaAccounts(accounts, 'NORTHWIND')).toEqual([accounts[0]]);
    expect(filterMetaAccounts(accounts, 'act_101')).toEqual([accounts[0]]);
    expect(filterMetaAccounts(accounts, 'PAGE-55')).toEqual([accounts[1]]);
  });

  it('returns an empty list when no account matches', () => {
    expect(filterMetaAccounts(accounts, 'missing')).toEqual([]);
  });
});

