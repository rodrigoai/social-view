import React from 'react';

interface CardProps {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  value?: string | number;
  icon?: React.ReactNode;
}

export function Card({ children, className = '', title, value, icon }: CardProps) {
  return (
    <div className={`bg-card shadow-lg rounded-2xl p-6 border border-border-custom transition-all hover:shadow-xl ${className}`}>
      {(title || value) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && <h3 className="text-sm font-medium text-muted">{title}</h3>}
            {value !== undefined && <p className="text-3xl font-bold text-foreground mt-1">{value}</p>}
          </div>
          {icon && <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">{icon}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
