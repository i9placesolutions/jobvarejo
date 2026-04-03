// SVGs inline das bandeiras reais de pagamento
// viewBox 48x32 (proporcao cartao) — cores oficiais de cada marca

export const paymentBrandSvg: Record<string, string> = {
  dinheiro: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#2d6a4f"/><text x="24" y="13" text-anchor="middle" font-size="6" font-weight="bold" fill="#a7f3d0" font-family="sans-serif">R$</text><text x="24" y="24" text-anchor="middle" font-size="7" font-weight="bold" fill="#fff" font-family="sans-serif">Dinheiro</text></svg>`,

  pix: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#fff" stroke="#d1d5db" stroke-width="0.5"/><g transform="translate(24,16)"><path d="M-3.5-7L0-10.5L3.5-7L0-3.5Z" fill="#32BCAD"/><path d="M-3.5 7L0 10.5L3.5 7L0 3.5Z" fill="#32BCAD"/><path d="M-7-3.5L-10.5 0L-7 3.5L-3.5 0Z" fill="#32BCAD"/><path d="M7-3.5L10.5 0L7 3.5L3.5 0Z" fill="#32BCAD"/><path d="M-3.5-3.5L0-7L3.5-3.5L0 0Z" fill="#4BB8A9"/><path d="M-3.5 3.5L0 7L3.5 3.5L0 0Z" fill="#4BB8A9"/><path d="M-3.5-3.5L-7 0L-3.5 3.5L0 0Z" fill="#2B9F93"/><path d="M3.5-3.5L7 0L3.5 3.5L0 0Z" fill="#2B9F93"/></g></svg>`,

  visa: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#1A1F71"/><path d="M19.5 21H17L18.9 11H21.4L19.5 21ZM15.3 11L12.9 18L12.6 16.5L11.7 12C11.7 12 11.6 11 10.3 11H6.1L6 11.2C6 11.2 7.5 11.5 9.2 12.5L11.4 21H14L18 11H15.3ZM38 21L35.8 11H33.8C32.7 11 32.4 11.8 32.4 11.8L28.5 21H31.1L31.6 19.5H34.8L35.1 21H38ZM32.4 17.5L33.8 13.5L34.5 17.5H32.4ZM27.5 13.5L27.8 11.8C27.8 11.8 26.6 11.3 25.3 11.3C23.9 11.3 20.7 12 20.7 14.8C20.7 17.4 24.3 17.4 24.3 18.8C24.3 20.1 21.1 19.8 19.9 18.9L19.6 20.7C19.6 20.7 20.8 21.3 22.5 21.3C24.2 21.3 27.4 20.3 27.4 17.8C27.4 15.2 23.7 15 23.7 13.8C23.7 12.6 26.2 12.7 27.5 13.5Z" fill="#fff"/><path d="M12.6 16.5L11.7 12C11.7 12 11.6 11 10.3 11H6.1L6 11.2C6 11.2 8.5 11.7 10.9 13.7C13.2 15.6 12.6 16.5 12.6 16.5Z" fill="#F7B600"/></svg>`,

  mastercard: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#252525"/><circle cx="19" cy="16" r="9" fill="#EB001B"/><circle cx="29" cy="16" r="9" fill="#F79E1B"/><path d="M24 9.13C25.96 10.74 27.21 13.23 27.21 16C27.21 18.77 25.96 21.26 24 22.87C22.04 21.26 20.79 18.77 20.79 16C20.79 13.23 22.04 10.74 24 9.13Z" fill="#FF5F00"/></svg>`,

  elo: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#000"/><circle cx="17" cy="14" r="4.5" fill="#EF4123"/><circle cx="24" cy="20" r="4.5" fill="#00A4E0"/><circle cx="31" cy="14" r="4.5" fill="#FFCB05"/><path d="M17 14C17 14 20 18 24 20" stroke="#fff" stroke-width="0.8" fill="none"/><path d="M24 20C24 20 28 18 31 14" stroke="#fff" stroke-width="0.8" fill="none"/></svg>`,

  hipercard: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#822124"/><text x="20" y="20" text-anchor="middle" font-size="11" font-weight="bold" fill="#fff" font-family="sans-serif">hiper</text><circle cx="40" cy="10" r="3.5" fill="#F9A01B"/></svg>`,

  alelo: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#00A651"/><text x="24" y="20" text-anchor="middle" font-size="12" font-weight="bold" fill="#fff" font-family="sans-serif">alelo</text></svg>`,

  sodexo: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#ED1C24"/><text x="24" y="20" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff" font-family="sans-serif">Sodexo</text><polygon points="40,6 41,8.5 43.5,8.5 41.5,10 42.2,12.5 40,11 37.8,12.5 38.5,10 36.5,8.5 39,8.5" fill="#fff"/></svg>`,

  ticket: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#003DA5"/><text x="27" y="20" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff" font-family="sans-serif">Ticket</text><circle cx="8" cy="16" r="3" fill="#FFD100"/></svg>`,

  americanexpress: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#006FCF"/><text x="24" y="15" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#fff" font-family="sans-serif" letter-spacing="0.5">AMERICAN</text><text x="24" y="22" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#fff" font-family="sans-serif" letter-spacing="0.5">EXPRESS</text></svg>`,

  vr: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#005CA9"/><text x="24" y="22" text-anchor="middle" font-size="16" font-weight="bold" fill="#fff" font-family="sans-serif">VR</text><rect x="4" y="4" width="40" height="3" rx="1.5" fill="#FF6600"/></svg>`,

  vale_alimentacao: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#2E7D32"/><text x="24" y="14" text-anchor="middle" font-size="6" font-weight="bold" fill="#fff" font-family="sans-serif">VALE</text><text x="24" y="24" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#C8E6C9" font-family="sans-serif">ALIMENTACAO</text></svg>`,

  cielo: `<svg viewBox="0 0 48 32" fill="none"><rect width="48" height="32" rx="4" fill="#0066CC"/><text x="24" y="20" text-anchor="middle" font-size="11" font-weight="bold" fill="#fff" font-family="sans-serif">cielo</text><circle cx="38" cy="10" r="2.5" fill="#3399FF"/></svg>`,
}
