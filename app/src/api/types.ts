export interface User {
  id: string;
  phone: string;
  name: string | null;
  createdAt: string;
}

export interface Loan {
  id: string;
  friendName: string;
  amountMinor: number;
  amount: number;
  currency: string;
  dueDate: string;
  repaidAt: string | null;
  isRepaid: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  receiptUrl: string | null;
  note: string | null;
  createdAt: string;
}

export interface Summary {
  currency: string;
  totals: {
    lentMinor: number;
    repaidMinor: number;
    outstandingMinor: number;
    overdueMinor: number;
  };
  counts: {
    total: number;
    outstanding: number;
    repaid: number;
    overdue: number;
  };
  generatedAt: string;
}

export type LoanStatus = 'all' | 'outstanding' | 'repaid' | 'overdue';

export interface CreateLoanInput {
  friendName: string;
  amount: string;
  dueDate: string;
  note?: string;
}

export interface AuthSession {
  token: string;
  user: User;
}
