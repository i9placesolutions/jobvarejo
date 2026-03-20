export const useBuilderSocialText = () => {
  const { flyer, products } = useBuilderFlyer()
  const { tenant } = useBuilderAuth()

  const formatPrice = (value: number | null | undefined): string => {
    if (value == null) return ''
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const formatDateShort = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  // Texto principal para redes sociais
  const generateSocialText = (): string => {
    const f = flyer.value
    const t = tenant.value
    if (!f) return ''

    const lines: string[] = []

    // Title
    if (f.title) {
      lines.push(f.title)
    }

    // Products
    const productList = products.value
    if (productList.length > 0) {
      lines.push('')
      lines.push('Confira:')
      for (const p of productList) {
        const name = p.custom_name || ''
        const price = formatPrice(p.offer_price)
        if (name && price) {
          lines.push(`- ${name} - ${price}`)
        } else if (name) {
          lines.push(`- ${name}`)
        }
      }
    }

    // Dates
    if (f.start_date && f.end_date) {
      lines.push('')
      lines.push(`Valido de ${formatDateShort(f.start_date)} ate ${formatDateShort(f.end_date)}`)
    }

    // Contact info from tenant
    if (t) {
      const contactLines: string[] = []
      if (t.address && f.show_address !== false) contactLines.push(t.address)
      if (t.phone && f.show_phone !== false) contactLines.push(t.phone)
      if (t.whatsapp && f.show_whatsapp !== false) contactLines.push(t.whatsapp)
      if (t.instagram && f.show_instagram !== false) contactLines.push(`@${t.instagram.replace(/^@/, '')}`)

      if (contactLines.length > 0) {
        lines.push('')
        lines.push(contactLines.join(' | '))
      }
    }

    // Promo phrase
    if (f.show_promo_phrase && f.promo_phrase) {
      lines.push('')
      lines.push(f.promo_phrase)
    }

    // Hashtags
    lines.push('')
    lines.push('#Ofertas #Encartes #Promocoes #Economia')

    return lines.join('\n')
  }

  // Texto de acessibilidade #PraCegoVer
  const generatePraCegoVer = (): string => {
    const f = flyer.value
    if (!f) return ''

    const productList = products.value
    const lines: string[] = []

    lines.push('#PraCegoVer')
    lines.push(`Encarte de ofertas "${f.title || 'Ofertas'}" com ${productList.length} produtos em promocao.`)

    if (productList.length > 0) {
      lines.push('')
      lines.push('Produtos em oferta:')
      productList.forEach((p, i) => {
        const name = p.custom_name || 'Produto'
        const price = formatPrice(p.offer_price)

        if (p.price_mode === 'none') {
          lines.push(`${i + 1}. ${name}`)
        } else if (p.price_mode === 'anticipation') {
          lines.push(`${i + 1}. ${name} - ${p.anticipation_text || 'Confira'}`)
        } else if (p.price_mode === 'from_to' && p.original_price) {
          lines.push(`${i + 1}. ${name} - de ${formatPrice(p.original_price)} por ${price}`)
        } else if (p.price_mode === 'x_per_y' && p.take_quantity) {
          lines.push(`${i + 1}. ${name} - ${p.take_quantity} ${p.quantity_unit || 'Un'} por ${price}`)
        } else if (p.price_mode === 'take_pay' && p.take_quantity && p.pay_quantity) {
          lines.push(`${i + 1}. ${name} - Leve ${p.take_quantity} Pague ${p.pay_quantity} por ${price}`)
        } else if (p.price_mode === 'installment' && p.installment_count && p.installment_price) {
          lines.push(`${i + 1}. ${name} - ${p.installment_count}x de ${formatPrice(p.installment_price)}${p.no_interest ? ' sem juros' : ''}`)
        } else if (p.price_mode === 'symbolic' && price) {
          lines.push(`${i + 1}. ${name} - ${price}`)
        } else if (p.price_mode === 'club_price' && price) {
          lines.push(`${i + 1}. ${name} - ${p.club_name || 'Preco Clube'}: ${price}`)
        } else if (price) {
          lines.push(`${i + 1}. ${name} - ${price}`)
        } else {
          lines.push(`${i + 1}. ${name}`)
        }
      })
    }

    if (f.start_date && f.end_date) {
      lines.push('')
      lines.push(`Ofertas validas de ${formatDate(f.start_date)} a ${formatDate(f.end_date)}.`)
    }

    return lines.join('\n')
  }

  // Computados reativos
  const socialText = computed(() => generateSocialText())
  const pracegoverText = computed(() => generatePraCegoVer())

  return {
    generateSocialText,
    generatePraCegoVer,
    socialText,
    pracegoverText,
    formatPrice,
    formatDate,
  }
}
