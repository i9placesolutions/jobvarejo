// ============================================================================
// Builder de Encartes — TypeScript Types
// ============================================================================

export interface BuilderFlyerDefaults {
    show_logo?: boolean
    show_company_name?: boolean
    show_slogan?: boolean
    show_phone?: boolean
    show_whatsapp?: boolean
    show_phone_label?: boolean
    show_payment_methods?: boolean
    show_payment_notes?: boolean
    show_address?: boolean
    show_instagram?: boolean
    show_facebook?: boolean
    show_website?: boolean
    logo_size?: number
    logo_x?: number
    logo_y?: number
    payment_methods?: string[]
    footer_layout?: string
    footer_bg?: string | null
    footer_text_color?: string | null
    footer_primary?: string | null
    footer_secondary?: string | null
}

export interface BuilderTenant {
    id: string
    email: string
    name: string
    slug: string | null
    logo: string | null
    logo_position: Record<string, any>
    slogan: string | null
    phone: string | null
    phone2: string | null
    whatsapp: string | null
    instagram: string | null
    facebook: string | null
    website: string | null
    address: string | null
    payment_notes: string | null
    cep: string | null
    segment1: string | null
    segment2: string | null
    segment3: string | null
    show_on_portal: boolean
    flyer_defaults: BuilderFlyerDefaults | null
    plan: string
    is_active: boolean
    last_login_at: string | null
    created_at: string
    updated_at: string
}

export type BuilderTenantPublic = Omit<BuilderTenant, 'last_login_at' | 'is_active'>

export interface BuilderTheme {
    id: string
    name: string
    slug: string | null
    thumbnail: string | null
    background_image: string | null
    is_premium: boolean
    is_public: boolean
    is_active: boolean
    sort_order: number
    category_name: string | null
    tags: string[]
    css_config: BuilderThemeCssConfig
    header_config: BuilderThemeHeaderConfig
    body_config: BuilderThemeBodyConfig
    footer_config: BuilderThemeFooterConfig
    created_at: string
    updated_at: string
}

export interface BuilderThemeCssConfig {
    primaryColor: string
    secondaryColor: string
    bgColor: string
    textColor: string
    borderRadius: string
    headerBg: string
    bodyBg: string
    footerBg: string
    accentColor: string
}

export interface BuilderThemeHeaderConfig {
    layout: string
    showLogo: boolean
    showDates: boolean
    showTitle: boolean
    height: number
    backgroundImage?: string
}

export interface BuilderThemeBodyConfig {
    padding: number
    gap: number
    productCardStyle: string
}

export interface BuilderThemeFooterConfig {
    text?: string
    showWatermark: boolean
    style: string
    height: number
}

export type BuilderModelType = 'SOCIAL' | 'PRINT' | 'TV'

export interface BuilderModel {
    id: string
    name: string
    type: BuilderModelType
    width: number
    height: number
    aspect_ratio: string | null
    is_active: boolean
    sort_order: number
}

export interface BuilderLayout {
    id: string
    name: string
    products_per_page: number
    columns: number
    rows: number
    grid_config: Record<string, any>
    highlight_positions: number[]
    is_active: boolean
    sort_order: number
    model_id: string | null
}

export interface BuilderPriceTagStyle {
    id: string
    name: string
    thumbnail: string | null
    css_config: {
        bgColor: string
        textColor: string
        shape: 'rounded' | 'square' | 'pill' | 'circle'
        fontFamily?: string
        decimalStyle?: 'small' | 'large' | 'superscript'
        // Border
        borderWidth?: number
        borderColor?: string
        borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double'
        // Border radius custom per corner (overrides shape)
        borderRadiusTL?: number
        borderRadiusTR?: number
        borderRadiusBL?: number
        borderRadiusBR?: number
        // Shadow
        shadow?: 'none' | 'sm' | 'md' | 'lg' | 'glow'
        // Gradient
        bgGradient?: boolean
        bgGradientColor?: string
        bgGradientDirection?: 'to-right' | 'to-bottom' | 'to-br' | 'to-bl' | 'radial'
        // Spacing & sizing
        padding?: 'compact' | 'normal' | 'spacious'
        priceScale?: number
        // Opacity
        bgOpacity?: number
        // Hide unit suffix (/kg, /un)
        hideUnit?: boolean
        // Background image
        bgImage?: string
        bgImageSize?: 'cover' | 'contain' | 'stretch'
        bgImageOpacity?: number
        // Display mode
        displayMode?: 'filled' | 'outline' | 'underline' | 'naked' | 'splash'
        // Text shadow
        textShadow?: 'none' | 'sm' | 'md' | 'lg' | 'hard'
        // R$ symbol size
        currencySize?: 'small' | 'medium' | 'large'
        // Rotation
        rotation?: number
        // Gondola features
        showCutLine?: boolean
        showBarcode?: boolean
        showValidity?: boolean
    }
    is_global: boolean
    is_active: boolean
    sort_order: number
}

export type BuilderBadgeType = 'PROMO' | 'OFFER' | 'NEW' | 'FEATURED'

export interface BuilderBadgeStyle {
    id: string
    name: string
    thumbnail: string | null
    type: BuilderBadgeType
    css_config: {
        bgColor: string
        textColor: string
        text: string
        position: 'top-right' | 'top-left'
    }
    is_global: boolean
    is_active: boolean
    sort_order: number
}

export interface BuilderFontConfig {
    id: string
    name: string
    family: string
    weight: string
    style: string
    google_url: string | null
    is_active: boolean
    sort_order: number
}

export interface BuilderProduct {
    id: string
    tenant_id: string
    name: string
    image: string | null
    barcode: string | null
    brand: string | null
    category: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export type BuilderFlyerStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type BuilderTextSizeMode = 'MAXIMUM' | 'MINIMUM' | 'MEDIUM'
export type BuilderPriceMode = 'simple' | 'from_to' | 'x_per_y' | 'take_pay' | 'installment' | 'symbolic' | 'club_price' | 'anticipation' | 'none'
export type BuilderProductUnit = 'UN' | 'KG' | 'G' | '100G' | '500G' | 'L' | 'ML' | 'PCT' | 'CX' | 'DZ' | 'BD' | 'FD' | 'SC'

export interface BuilderFlyer {
    id: string
    tenant_id: string
    title: string
    status: BuilderFlyerStatus
    start_date: string | null
    end_date: string | null
    category: string | null
    observations: string | null
    custom_message: string | null

    // Display toggles
    show_dates: boolean
    show_stock_warning: boolean
    show_illustrative_note: boolean
    show_medicine_warning: boolean
    show_promo_phrase: boolean
    promo_phrase: string | null
    publish_to_portal: boolean

    // Company field toggles
    show_phone: boolean
    show_whatsapp: boolean
    show_phone_label: boolean
    show_company_name: boolean
    show_slogan: boolean
    show_payment_methods: boolean
    show_payment_notes: boolean
    show_address: boolean
    show_instagram: boolean
    show_facebook: boolean
    show_website: boolean

    // Visual config
    text_size_mode: BuilderTextSizeMode
    product_box_style: 'smart' | 'standard'
    color_mode: 'smart' | 'standard'
    footer_style: string
    ink_economy: number
    show_cover: boolean

    // JSON configs
    font_config: Record<string, any>
    logo_position: Record<string, any>
    color_palette: Record<string, any>

    // FK references
    theme_id: string | null
    model_id: string | null
    layout_id: string | null
    price_tag_style_id: string | null
    badge_style_id: string | null

    snapshot_url: string | null
    created_at: string
    updated_at: string
}

export interface BuilderFlyerProduct {
    id: string
    flyer_id: string
    product_id: string | null
    position: number

    custom_name: string | null
    custom_image: string | null
    offer_price: number | null
    original_price: number | null
    unit: BuilderProductUnit
    observation: string | null
    purchase_limit: number | null

    price_mode: BuilderPriceMode
    take_quantity: number | null
    pay_quantity: number | null
    installment_count: number | null
    installment_price: number | null
    no_interest: boolean
    club_name: string | null
    anticipation_text: string | null
    show_discount: boolean
    quantity_unit: string | null
    price_label: string | null

    is_highlight: boolean
    is_adult: boolean
    is_pinned: boolean
    is_price_pinned: boolean
    bg_opacity: number
    custom_lines: any[]

    price_tag_style_id: string | null
    badge_style_id: string | null

    image_zoom: number
    image_x: number
    image_y: number

    created_at: string
    updated_at: string
}

// Session token payload for builder
export interface BuilderTokenPayload {
    sub: string       // tenant id or profile id (when isAdmin)
    email: string
    name: string
    scope: 'builder'
    isAdmin?: boolean
    iat: number
    exp: number
}
