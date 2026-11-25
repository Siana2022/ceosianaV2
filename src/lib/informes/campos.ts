// Catálogo de campos disponibles para las métricas de los informes.
// Cada campo tiene la variable que se usa en las fórmulas.

export interface Campo {
  variable: string
  etiqueta: string
  tipo: 'metrica' | 'dimension'
  fuente: FuenteDatos
  descripcion?: string
}

export type FuenteDatos = 'google_ads' | 'meta_ads' | 'ga4' | 'shopify'

export const FUENTES: Record<FuenteDatos, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  ga4: 'GA4',
  shopify: 'Shopify',
}

export const CAMPOS: Campo[] = [
  // Google Ads
  { variable: 'inversion', etiqueta: 'Inversión', tipo: 'metrica', fuente: 'google_ads' },
  { variable: 'impresiones', etiqueta: 'Impresiones', tipo: 'metrica', fuente: 'google_ads' },
  { variable: 'clics', etiqueta: 'Clics', tipo: 'metrica', fuente: 'google_ads' },
  { variable: 'conversiones', etiqueta: 'Conversiones', tipo: 'metrica', fuente: 'google_ads' },
  { variable: 'valor', etiqueta: 'Valor de conversión', tipo: 'metrica', fuente: 'google_ads' },
  { variable: 'cpa', etiqueta: 'CPA', tipo: 'metrica', fuente: 'google_ads' },
  { variable: 'roas', etiqueta: 'ROAS', tipo: 'metrica', fuente: 'google_ads' },
  { variable: 'ctr', etiqueta: 'CTR (%)', tipo: 'metrica', fuente: 'google_ads' },
  { variable: 'campana', etiqueta: 'Campaña', tipo: 'dimension', fuente: 'google_ads' },

  // Meta Ads
  { variable: 'coste', etiqueta: 'Importe gastado', tipo: 'metrica', fuente: 'meta_ads' },
  { variable: 'impresiones', etiqueta: 'Impresiones', tipo: 'metrica', fuente: 'meta_ads' },
  { variable: 'clics', etiqueta: 'Clics', tipo: 'metrica', fuente: 'meta_ads' },
  { variable: 'conversiones', etiqueta: 'Compras', tipo: 'metrica', fuente: 'meta_ads' },
  { variable: 'valor', etiqueta: 'Valor de conversión', tipo: 'metrica', fuente: 'meta_ads' },
  { variable: 'cpa', etiqueta: 'Coste por compra', tipo: 'metrica', fuente: 'meta_ads' },
  { variable: 'roas', etiqueta: 'ROAS', tipo: 'metrica', fuente: 'meta_ads' },
  { variable: 'ctr', etiqueta: 'CTR (%)', tipo: 'metrica', fuente: 'meta_ads' },

  // GA4
  { variable: 'sesiones', etiqueta: 'Sesiones', tipo: 'metrica', fuente: 'ga4' },
  { variable: 'usuarios', etiqueta: 'Total de usuarios', tipo: 'metrica', fuente: 'ga4' },
  { variable: 'usuarios_producto', etiqueta: 'Usuarios que ven producto', tipo: 'metrica', fuente: 'ga4' },
  { variable: 'productos_vistos', etiqueta: 'Productos vistos', tipo: 'metrica', fuente: 'ga4' },
  { variable: 'usuarios_carrito', etiqueta: 'Usuarios que añaden al carrito', tipo: 'metrica', fuente: 'ga4' },
  { variable: 'carritos', etiqueta: 'Añadidos al carrito', tipo: 'metrica', fuente: 'ga4' },
  { variable: 'compras', etiqueta: 'Compras', tipo: 'metrica', fuente: 'ga4' },
  { variable: 'compradores', etiqueta: 'Total de compradores', tipo: 'metrica', fuente: 'ga4' },
  { variable: 'articulos_comprados', etiqueta: 'Artículos comprados', tipo: 'metrica', fuente: 'ga4' },
  { variable: 'ingresos', etiqueta: 'Total de ingresos', tipo: 'metrica', fuente: 'ga4' },
  { variable: 'aov', etiqueta: 'AOV (ticket medio)', tipo: 'metrica', fuente: 'ga4' },

  // Shopify
  { variable: 'pedidos_reales', etiqueta: 'Pedidos reales', tipo: 'metrica', fuente: 'shopify' },
  { variable: 'ingresos_reales', etiqueta: 'Ingresos reales', tipo: 'metrica', fuente: 'shopify' },
  { variable: 'articulo', etiqueta: 'Artículo', tipo: 'dimension', fuente: 'shopify' },
  { variable: 'articulos_vistos', etiqueta: 'Artículos vistos', tipo: 'metrica', fuente: 'shopify' },
]
