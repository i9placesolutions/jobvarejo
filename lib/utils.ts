import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export { parseProductList } from '~/utils/productListBasicParser'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
