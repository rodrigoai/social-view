'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Account {
  id: string;
  name: string;
  googleAdsConfig?: any;
  googleAnalyticsConfig?: any;
}

interface AccountContextType {
  accounts: Account[];
  selectedAccountId: string | null;
  selectedAccount: Account | null;
  setSelectedAccountId: (id: string) => void;
  isLoading: boolean;
  refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      const fetchedAccounts = data.accounts || [];
      setAccounts(fetchedAccounts);
      
      // If no account is selected, or selected account doesn't exist anymore, pick the first one
      const savedId = localStorage.getItem('selectedAccountId');
      if (fetchedAccounts.length > 0) {
        if (!savedId || !fetchedAccounts.find((a: Account) => a.id === savedId)) {
          const firstId = fetchedAccounts[0].id;
          setSelectedAccountIdState(firstId);
          localStorage.setItem('selectedAccountId', firstId);
        } else {
          setSelectedAccountIdState(savedId);
        }
      } else {
        setSelectedAccountIdState(null);
      }
    } catch (error) {
      console.error('Failed to fetch accounts in context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const setSelectedAccountId = (id: string) => {
    setSelectedAccountIdState(id);
    localStorage.setItem('selectedAccountId', id);
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || null;

  return (
    <AccountContext.Provider value={{ 
      accounts, 
      selectedAccountId, 
      selectedAccount,
      setSelectedAccountId, 
      isLoading,
      refreshAccounts: fetchAccounts
    }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}
