'use client';

import { useAccount } from '@/context/AccountContext';
import { ChevronDown, Building2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function AccountSwitcher() {
  const { accounts, selectedAccount, setSelectedAccountId } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (accounts.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-foreground bg-accent-custom hover:bg-border-custom rounded-lg transition-colors border border-border-custom"
      >
        <Building2 className="w-4 h-4 text-blue-600" />
        <span className="max-w-[120px] truncate">{selectedAccount?.name || 'Select Account'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 bg-card border border-border-custom rounded-xl shadow-lg py-2 z-50 animate-in fade-in zoom-in duration-100">
          <div className="px-3 py-1 text-xs font-bold text-muted uppercase tracking-wider">
            Switch Account
          </div>
          <div className="max-h-60 overflow-y-auto mt-1">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => {
                  setSelectedAccountId(acc.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-accent-custom transition-colors ${
                  selectedAccount?.id === acc.id ? 'text-blue-600 bg-blue-50/50 dark:bg-blue-900/20 font-bold' : 'text-foreground'
                }`}
              >
                {acc.name}
                {selectedAccount?.id === acc.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                )}
              </button>
            ))}
          </div>
          <div className="border-t border-border-custom mt-2 pt-2 px-2">
            <a 
              href="/settings" 
              className="block w-full text-center px-4 py-2 text-xs font-medium text-muted hover:text-blue-600 hover:bg-accent-custom rounded-lg transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Manage Accounts
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
