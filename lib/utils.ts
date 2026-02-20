import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseProductList(text: string) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  return lines.map(line => {
    // Basic Regex strategies
    // 1. Price at the end (e.g., "Arroz 5kg 19,90" or "19.90")
    // Match 19,90 or 19.90 optionally preceded by R$
    const priceMatch = line.match(/(?:R\$)?\s?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/);
    
    let price = '0,00';
    let name = line;
    let unit = 'UN';

    if (priceMatch) {
        const matchedPrice = priceMatch[1];
        if (matchedPrice) {
            price = matchedPrice.replace('.', ','); // Standardize decimal
        }
        // Remove price from name
        name = line.replace(priceMatch[0], '').trim();
    }

    // 2. Unit detection (kg, g, l, ml, etc)
    // Improve regex to capture unit if attached to number or separate
    const unitMatch = name.match(/\b(\d+(?:kg|g|l|ml|m)|kg|un|cx|pc|pct)\b/i);
    if (unitMatch) {
        unit = unitMatch[0].toUpperCase();
    }
    
    // Clean up name
    name = name.replace(/[-–]/g, '').trim();

    return {
        id: Math.random().toString(36).substr(2, 9),
        name: name,
        price: price,
        image: '', // Placeholder, would need search
        unit: unit,
        color: '#ffffff'
    };
  });
}
