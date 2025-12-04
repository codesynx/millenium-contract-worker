export interface ContractJobData {
  contractId: string;
  contractNumber: string;
  rentApplicationId: string;
  productName: string;
  quantity: number;
  rentalPrice: number;
  period: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  sellerName: string;
  sellerPhone: string;
  sellerKaspiPhone: string;
  clientName: string;
  clientPhone: string;
  city: string;
}

export interface ContractJobResult {
  success: boolean;
  contractId: string;
  fileUrl?: string;
  error?: string;
}
