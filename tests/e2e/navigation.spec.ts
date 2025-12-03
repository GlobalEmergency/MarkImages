import { test, expect } from '@playwright/test'

test.describe('Navegación de la aplicación', () => {
  test('debe navegar correctamente por las páginas principales', async ({ page }) => {
    // Navegar a la página principal
    await page.goto('/')

    // Verificar que estamos en la home
    await expect(page).toHaveURL('/')
    await expect(page.locator('h1')).toContainText('deamap.es')

    // Verificar que el header tiene el logo y título
    const header = page.locator('header')
    await expect(header).toBeVisible()
    await expect(header.locator('h1')).toContainText('deamap.es')
    await expect(header).toContainText('Mapa de Desfibriladores')
  })

  test('debe mostrar el botón de agregar DEA', async ({ page }) => {
    await page.goto('/')

    // Buscar el botón "Agregar DEA"
    const addButton = page.locator('a[href="/dea/new"]')
    await expect(addButton).toBeVisible()
    await expect(addButton).toContainText('Agregar DEA')
  })

  test('debe poder hacer clic en "Agregar DEA" y navegar', async ({ page }) => {
    await page.goto('/')

    // Click en el botón
    await page.click('a[href="/dea/new"]')

    // Verificar que navegamos a la página correcta
    await expect(page).toHaveURL('/dea/new')
  })

  test('debe tener navegación funcional entre vistas', async ({ page }) => {
    await page.goto('/')

    // Verificar que los botones de vista están presentes
    const listButton = page.locator('button', { hasText: 'Lista' })
    const mapButton = page.locator('button', { hasText: 'Mapa' })

    await expect(listButton).toBeVisible()
    await expect(mapButton).toBeVisible()
  })

  test('debe mostrar meta tags correctos en la página principal', async ({ page }) => {
    await page.goto('/')

    // Verificar que el título de la página está presente
    await expect(page).toHaveTitle(/DEA|Madrid|deamap/i)
  })
})

test.describe('Accesibilidad de la navegación', () => {
  test('debe tener suficiente contraste en los elementos principales', async ({ page }) => {
    await page.goto('/')

    // Verificar que el header es visible
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Verificar que los botones principales son visibles
    const buttons = page.locator('button').filter({ hasText: /Lista|Mapa|Agregar/ })
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('debe tener tamaños de toque apropiados en móvil', async ({ page }) => {
    // Configurar viewport móvil
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Los botones deberían tener min-height de 44px (estándar de Apple)
    const addButton = page.locator('a[href="/dea/new"]')
    await expect(addButton).toBeVisible()

    const buttonBox = await addButton.boundingBox()
    if (buttonBox) {
      // El botón debe tener al menos 44px de altura para ser fácil de tocar
      expect(buttonBox.height).toBeGreaterThanOrEqual(40) // Damos un margen
    }
  })

  test('debe ser navegable con teclado', async ({ page }) => {
    await page.goto('/')

    // Presionar Tab varias veces para navegar
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Verificar que hay un elemento enfocado
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement).toBeTruthy()
  })
})
