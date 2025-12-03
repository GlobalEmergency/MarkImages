import { test, expect } from '@playwright/test'

test.describe('Página Principal - Elementos Básicos', () => {
  test('debe cargar la página principal correctamente', async ({ page }) => {
    await page.goto('/')

    // Verificar que el título principal está visible
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()
    await expect(heading).toContainText('deamap.es')
  })

  test('debe mostrar el header con información correcta', async ({ page }) => {
    await page.goto('/')

    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Verificar elementos del header
    await expect(header.locator('h1')).toContainText('deamap.es')
    await expect(header).toContainText('Mapa de Desfibriladores')
  })

  test('debe mostrar todos los controles principales', async ({ page }) => {
    await page.goto('/')

    // Barra de búsqueda
    const searchInput = page.locator('input[placeholder*="Buscar"]')
    await expect(searchInput).toBeVisible()

    // Botón agregar DEA
    const addButton = page.locator('a[href="/dea/new"]')
    await expect(addButton).toBeVisible()

    // Toggle de vista
    const listButton = page.locator('button', { hasText: 'Lista' })
    const mapButton = page.locator('button', { hasText: 'Mapa' })
    await expect(listButton).toBeVisible()
    await expect(mapButton).toBeVisible()
  })

  test('debe mostrar el contador de DEAs disponibles', async ({ page }) => {
    await page.goto('/')

    await page.waitForTimeout(1000) // Esperar carga de datos

    // Buscar texto con patrón "X DEAs disponibles"
    const counter = page.locator('text=/\\d+ DEAs? disponibles/i')
    await expect(counter).toBeVisible()
  })

  test('debe tener iconos visuales apropiados', async ({ page }) => {
    await page.goto('/')

    // Verificar que hay SVGs/iconos visibles (Lucide icons)
    const icons = page.locator('svg')
    const iconCount = await icons.count()

    // Debería haber varios iconos en la página
    expect(iconCount).toBeGreaterThan(3)
  })
})

test.describe('Página Principal - Responsive Design', () => {
  test('debe funcionar correctamente en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Elementos principales deben ser visibles
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible()
    await expect(page.locator('a[href="/dea/new"]')).toBeVisible()
  })

  test('debe funcionar correctamente en tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')

    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible()
  })

  test('debe funcionar correctamente en desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible()
  })

  test('debe ajustar el layout en diferentes orientaciones', async ({ page }) => {
    // Vertical (portrait)
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()

    // Horizontal (landscape)
    await page.setViewportSize({ width: 667, height: 375 })
    await page.reload()
    await expect(page.locator('h1')).toBeVisible()
  })
})

test.describe('Página Principal - Estados de Carga', () => {
  test('debe mostrar estado inicial correctamente', async ({ page }) => {
    await page.goto('/')

    // La página debe renderizarse aunque aún no haya datos
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('debe manejar el estado sin resultados', async ({ page }) => {
    await page.goto('/')

    // Cambiar a vista de lista
    await page.click('button:has-text("Lista")')
    await page.waitForTimeout(500)

    // Buscar algo que no existe
    await page.fill('input[placeholder*="Buscar"]', 'xyzabc123notfound999')
    await page.waitForTimeout(1000)

    // Debería mostrar mensaje de "no encontrado" o lista vacía
    const noResults = page.locator('text=/No se encontraron DEAs/i')
    const emptyList = page.locator('[class*="grid"]').locator('button')

    const noResultsVisible = await noResults.isVisible().catch(() => false)
    const hasResults = (await emptyList.count()) === 0

    // Debe mostrar "no resultados" O tener lista vacía
    expect(noResultsVisible || hasResults).toBeTruthy()
  })
})
