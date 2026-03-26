# DeaMap - Custom Product Pages & Tracking

## App Store Connect - Custom Product Pages

Cada pagina tiene un `ppid` unico. Al usar estas URLs en campanas, App Store Analytics
muestra impresiones, descargas y conversion por pagina.

| Audiencia        | ppid                                   | URL                                                                                                         |
| ---------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Municipios       | `dc956d8a-caee-40fe-947a-c84ebd9de117` | https://apps.apple.com/us/app/deamap-desfibriladores/id6760004634?ppid=dc956d8a-caee-40fe-947a-c84ebd9de117 |
| Mantenimiento    | `17930f01-3e54-4f07-905a-36e78648d3f2` | https://apps.apple.com/us/app/deamap-desfibriladores/id6760004634?ppid=17930f01-3e54-4f07-905a-36e78648d3f2 |
| Proteccion Civil | `59da5a0d-963b-4ec8-91a5-8e3de2195ea2` | https://apps.apple.com/us/app/deamap-desfibriladores/id6760004634?ppid=59da5a0d-963b-4ec8-91a5-8e3de2195ea2 |
| Deportes         | `e65956ec-a4ea-4dc6-a868-289159961b24` | https://apps.apple.com/us/app/deamap-desfibriladores/id6760004634?ppid=e65956ec-a4ea-4dc6-a868-289159961b24 |
| Farmacias        | `43b76a70-7e67-4c48-9ffc-e60605737cce` | https://apps.apple.com/us/app/deamap-desfibriladores/id6760004634?ppid=43b76a70-7e67-4c48-9ffc-e60605737cce |

### Donde usar estas URLs

- Apple Search Ads: asigna cada CPP a una campana por audiencia
- Redes sociales: comparte la URL con ppid para la audiencia objetivo
- Email marketing: enlaza a la pagina personalizada segun el destinatario
- Sitio web: landing pages por sector con enlace a la CPP correspondiente

### Metricas disponibles en App Store Connect > Analytics

- Impresiones por Custom Product Page
- Descargas por Custom Product Page
- Tasa de conversion por pagina
- Comparativa entre paginas
- Retention por fuente

## Google Play - Custom Store Listings

Google Play Custom Store Listings se crean desde Play Console (no via API).
Los screenshots por audiencia estan generados en `screenshots/custom_pages/`.

### Pasos para crear en Google Play Console:

1. Ir a Google Play Console > DeaMap > Store presence > Custom store listings
2. Crear 5 listings con los nombres de audiencia
3. Para cada listing, subir los screenshots de `screenshots/custom_pages/{audiencia}/{lang}/android/`
4. Copiar titulo, descripcion corta y descripcion larga del script `create_google_custom_listings.py`

### URLs de tracking (despues de crear en Console):

- `https://play.google.com/store/apps/details?id=es.deamap.mobile&listing=municipios`
- `https://play.google.com/store/apps/details?id=es.deamap.mobile&listing=mantenimiento`
- `https://play.google.com/store/apps/details?id=es.deamap.mobile&listing=proteccion-civil`
- `https://play.google.com/store/apps/details?id=es.deamap.mobile&listing=deportes`
- `https://play.google.com/store/apps/details?id=es.deamap.mobile&listing=farmacias`

## Deep Link Tracking

Todas las URLs de las stores se pueden combinar con `deamap.es/open?source=X` para tracking:

| Fuente                   | URL                                              |
| ------------------------ | ------------------------------------------------ |
| Landing municipios       | `https://deamap.es/open?source=municipios`       |
| Landing mantenimiento    | `https://deamap.es/open?source=mantenimiento`    |
| Landing proteccion civil | `https://deamap.es/open?source=proteccion-civil` |
| Landing deportes         | `https://deamap.es/open?source=deportes`         |
| Landing farmacias        | `https://deamap.es/open?source=farmacias`        |
| EmerKit launcher         | `https://deamap.es/open?source=emerkit`          |

El parametro `source` se forwarded a la app y se trackea en GA4 como evento `app_open`.

## Plan de analisis (revisar en 2-4 semanas)

1. **Conversion por CPP**: Cual tiene mejor ratio impresion->descarga?
2. **Retention por fuente**: Los usuarios de que audiencia retienen mas?
3. **Engagement por nicho**: Que audiencia registra/verifica mas DEAs?
4. **A/B test**: Probar variantes de screenshots y promo text por CPP
5. **Keyword optimization**: Analizar que keywords traen trafico a cada CPP
6. **Funnel**: deamap.es/open -> Store -> Install -> First open -> Registration
