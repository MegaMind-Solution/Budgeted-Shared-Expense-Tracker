import { getCurrencySymbol } from './currencies';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatMoney = (amount: number, currencyCode: string = 'USD'): string => {
  const symbol = getCurrencySymbol(currencyCode);
  const formattedNum = formatCurrency(amount);
  // If symbol is multiple letters (e.g. 'AED', 'SAR', 'KSh'), add space after symbol
  if (symbol.length > 2) {
    return `${symbol} ${formattedNum}`;
  }
  return `${symbol}${formattedNum}`;
};

