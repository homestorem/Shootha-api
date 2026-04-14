export type WalletTransaction = {
  id: string;
  userId: string;
  type: "redeem" | "payment";
  amount: number;
  balanceAfter: number;
  label: string;
  createdAt: string;
  status?: string;
  bookingId?: string | null;
};
