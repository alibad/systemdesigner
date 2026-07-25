import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  children: React.ReactNode;
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  const variantClasses = {
    default: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300',
    secondary: 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300',
    outline: 'border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300',
    destructive: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}