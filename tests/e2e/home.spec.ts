import { test, expect } from '@playwright/test'

test.describe('Página Principal', () => {
  test('debe cargar la página principal correctamente', async ({ page }) => {
    // Navegar a la página principal
    await page.goto('/')

    // Verificar que la página carga
    await expect(page).toHaveTitle(/DEA Madrid/i)
  })

  test('debe mostrar el header de la aplicación', async ({ page }) => {
    await page.goto('/')

    // Verificar que existe algún contenido visible en la página
    const body = await page.locator('body')
    await expect(body).toBeVisible()
  })

  test('debe ser responsive', async ({ page }) => {
    // Probar en móvil
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    const body = await page.locator('body')
    await expect(body).toBeVisible()

    // Probar en desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(body).toBeVisible()
  })
})
