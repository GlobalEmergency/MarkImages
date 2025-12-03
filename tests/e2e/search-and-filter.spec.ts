import { test, expect } from '@playwright/test'

test.describe('Búsqueda y filtrado de DEAs', () => {
  test('debe mostrar el campo de búsqueda', async ({ page }) => {
    await page.goto('/')

    // Buscar el input de búsqueda
    const searchInput = page.locator('input[placeholder*="Buscar"]')
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toHaveAttribute('type', 'text')
  })

  test('debe permitir escribir en el campo de búsqueda', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.locator('input[placeholder*="Buscar"]')

    // Escribir en el campo de búsqueda
    await searchInput.fill('Hospital')

    // Verificar que el valor se estableció
    await expect(searchInput).toHaveValue('Hospital')
  })

  test('debe limpiar el campo de búsqueda', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.locator('input[placeholder*="Buscar"]')

    // Escribir y limpiar
    await searchInput.fill('Test')
    await expect(searchInput).toHaveValue('Test')

    await searchInput.clear()
    await expect(searchInput).toHaveValue('')
  })

  test('debe mostrar el contador de DEAs', async ({ page }) => {
    await page.goto('/')

    // Esperar a que cargue
    await page.waitForTimeout(1000)

    // Buscar el texto que muestra el total
    const totalText = page.locator('text=/\\d+ DEAs? disponibles/i')
    await expect(totalText).toBeVisible()
  })

  test('debe mantener el valor de búsqueda al cambiar de vista', async ({ page }) => {
    await page.goto('/')

    const searchInput = page.locator('input[placeholder*="Buscar"]')

    // Escribir búsqueda
    await searchInput.fill('Centro')

    // Cambiar a vista de lista
    const listButton = page.locator('button', { hasText: 'Lista' })
    await listButton.click()

    // Verificar que el valor de búsqueda se mantiene
    await expect(searchInput).toHaveValue('Centro')

    // Cambiar a vista de mapa
    const mapButton = page.locator('button', { hasText: 'Mapa' })
    await mapButton.click()

    // El valor debe seguir ahí
    await expect(searchInput).toHaveValue('Centro')
  })
})

test.describe('Cambio de vista (Lista/Mapa)', () => {
  test('debe iniciar en vista de mapa por defecto', async ({ page }) => {
    await page.goto('/')

    // Esperar a que cargue
    await page.waitForTimeout(500)

    // El botón de mapa debe estar activo (tener clases específicas)
    const mapButton = page.locator('button', { hasText: 'Mapa' })
    const buttonClass = await mapButton.getAttribute('class')

    expect(buttonClass).toContain('from-blue-500') // Clase activa
  })

  test('debe cambiar a vista de lista al hacer clic', async ({ page }) => {
    await page.goto('/')

    // Esperar carga inicial
    await page.waitForTimeout(500)

    // Click en vista de lista
    const listButton = page.locator('button', { hasText: 'Lista' })
    await listButton.click()

    // Esperar un poco para que cambie la vista
    await page.waitForTimeout(300)

    // Verificar que el botón de lista está activo
    const buttonClass = await listButton.getAttribute('class')
    expect(buttonClass).toContain('from-blue-500')
  })

  test('debe cambiar de lista a mapa correctamente', async ({ page }) => {
    await page.goto('/')

    // Cambiar a lista
    const listButton = page.locator('button', { hasText: 'Lista' })
    await listButton.click()
    await page.waitForTimeout(300)

    // Volver a mapa
    const mapButton = page.locator('button', { hasText: 'Mapa' })
    await mapButton.click()
    await page.waitForTimeout(300)

    // Verificar que el botón de mapa está activo
    const buttonClass = await mapButton.getAttribute('class')
    expect(buttonClass).toContain('from-blue-500')
  })

  test('debe mostrar contenido diferente en cada vista', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)

    // En vista de mapa, buscar indicador de carga del mapa
    const mapView = page.locator('text=/Cargando mapa/i').or(page.locator('[class*="leaflet"]'))

    // Cambiar a lista
    const listButton = page.locator('button', { hasText: 'Lista' })
    await listButton.click()
    await page.waitForTimeout(500)

    // En vista de lista, deberían aparecer las tarjetas
    // o el mensaje "No se encontraron DEAs"
    const cards = page.locator('button[class*="rounded-xl"]').filter({ hasText: /DEA/i })
    const noResults = page.locator('text=/No se encontraron DEAs/i')

    const cardsCount = await cards.count()
    const noResultsVisible = await noResults.isVisible().catch(() => false)

    // Debería haber tarjetas o mensaje de "no hay resultados"
    expect(cardsCount > 0 || noResultsVisible).toBeTruthy()
  })
})

test.describe('Paginación', () => {
  test('debe mostrar controles de paginación si hay más de una página', async ({ page }) => {
    await page.goto('/')

    // Cambiar a vista de lista
    const listButton = page.locator('button', { hasText: 'Lista' })
    await listButton.click()
    await page.waitForTimeout(1000)

    // Buscar botones de paginación
    const prevButton = page.locator('button', { hasText: 'Anterior' })
    const nextButton = page.locator('button', { hasText: 'Siguiente' })

    // Si hay paginación, los botones deben existir
    const prevExists = await prevButton.count()
    const nextExists = await nextButton.count()

    // Si existe uno, debe existir el otro
    if (prevExists > 0) {
      expect(nextExists).toBeGreaterThan(0)
    }
  })

  test('debe deshabilitar "Anterior" en la primera página', async ({ page }) => {
    await page.goto('/')

    // Cambiar a vista de lista
    const listButton = page.locator('button', { hasText: 'Lista' })
    await listButton.click()
    await page.waitForTimeout(1000)

    // Buscar botón "Anterior"
    const prevButton = page.locator('button', { hasText: 'Anterior' })

    if ((await prevButton.count()) > 0) {
      // El botón debe estar deshabilitado en la primera página
      await expect(prevButton).toBeDisabled()
    }
  })

  test('debe mostrar el número de página actual', async ({ page }) => {
    await page.goto('/')

    // Cambiar a vista de lista
    const listButton = page.locator('button', { hasText: 'Lista' })
    await listButton.click()
    await page.waitForTimeout(1000)

    // Buscar indicador de página
    const pageIndicator = page.locator('text=/Página \\d+ de \\d+/i')

    if ((await pageIndicator.count()) > 0) {
      await expect(pageIndicator).toBeVisible()
      await expect(pageIndicator).toContainText('Página 1')
    }
  })
})

test.describe('Responsive Design', () => {
  test('debe adaptarse correctamente a pantalla móvil', async ({ page }) => {
    // Configurar viewport móvil
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Verificar que la página carga
    await expect(page.locator('h1')).toBeVisible()

    // Verificar que los controles son accesibles
    const searchInput = page.locator('input[placeholder*="Buscar"]')
    await expect(searchInput).toBeVisible()
  })

  test('debe adaptarse correctamente a tablet', async ({ page }) => {
    // Configurar viewport tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')

    await expect(page.locator('h1')).toBeVisible()

    const searchInput = page.locator('input[placeholder*="Buscar"]')
    await expect(searchInput).toBeVisible()
  })

  test('debe adaptarse correctamente a desktop', async ({ page }) => {
    // Configurar viewport desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    await expect(page.locator('h1')).toBeVisible()

    const searchInput = page.locator('input[placeholder*="Buscar"]')
    await expect(searchInput).toBeVisible()
  })

  test('debe mantener funcionalidad en diferentes tamaños', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1920, height: 1080, name: 'Desktop' },
    ]

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/')

      // Verificar que elementos clave son visibles
      await expect(page.locator('h1')).toBeVisible()

      const searchInput = page.locator('input[placeholder*="Buscar"]')
      await expect(searchInput).toBeVisible()

      // Verificar que podemos interactuar con el input
      await searchInput.fill('Test')
      await expect(searchInput).toHaveValue('Test')
      await searchInput.clear()
    }
  })
})
