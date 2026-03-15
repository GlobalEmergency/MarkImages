# feat: Embeddable map widget (iframe) for third-party websites

## Summary

Create an embeddable map widget that third parties can integrate into their websites via `<iframe>`. This will increase DeaMap visibility, generate natural backlinks (SEO), and facilitate adoption by organizations that manage or install AEDs.

## Use Cases

- **AED installers**: Show their installed defibrillators on their company website
- **Maintenance companies**: Display their coverage area and maintained AEDs
- **Municipalities**: Embed a map of all AEDs in their city on the official website
- **Shopping centers / hospitals / sports venues**: Show nearby AEDs for visitors
- **Organizations**: Display their organization's AEDs on their website

## Proposed Routes

| Route | Description |
|-------|-------------|
| `/embed/map?city={city}` | Map centered on a city showing all its AEDs |
| `/embed/map?lat={lat}&lng={lng}&radius={km}` | Map centered on coordinates within a radius |
| `/embed/map?org={orgId}` | Map showing only an organization's AEDs |
| `/embed/map?ids={id1,id2,...}` | Map showing specific AEDs by ID |

## Integration Snippet

```html
<iframe
  src="https://deamap.es/embed/map?city=Madrid"
  width="100%"
  height="400"
  frameborder="0"
  allow="geolocation"
  title="Mapa de Desfibriladores - DeaMap"
></iframe>
```

## Requirements

### Core
- [ ] Lightweight map component (Leaflet, no navigation chrome)
- [ ] Responsive design that adapts to iframe dimensions
- [ ] Marker clusters for dense areas
- [ ] Click on marker shows basic AED info (name, address, schedule)
- [ ] "View on DeaMap" link in popups (drives traffic to main site)
- [ ] "Powered by DeaMap" watermark/badge with link

### Query Parameters
- [ ] `city` - Filter by city name
- [ ] `lat` + `lng` + `radius` - Geographic filter
- [ ] `org` - Filter by organization ID
- [ ] `ids` - Comma-separated list of specific AED IDs
- [ ] `zoom` - Initial zoom level (optional)
- [ ] `theme` - Light/dark theme (optional, default: light)
- [ ] `lang` - Language: es, en, fr, de, pt (optional, default: es)

### Security
- [ ] Relax `X-Frame-Options` only for `/embed/*` routes (currently DENY globally in `next.config.ts`)
- [ ] Add `Content-Security-Policy: frame-ancestors *` for embed routes
- [ ] Rate limit the embed data endpoint
- [ ] Consider optional API key for high-traffic embeds

### SEO & Visibility
- [ ] "Powered by DeaMap" badge links back to deamap.es (generates backlinks)
- [ ] Embed generator page at `/embed` where users can configure and copy the snippet
- [ ] Track embed usage via analytics (referrer, city, org)

## Technical Notes

- The embed page should be a minimal Next.js page without the main navigation/layout
- Use the existing `/api/v1/aeds/nearby` and `/api/v1/aeds/city/{city}` endpoints for data
- Consider lazy-loading markers for large datasets
- The `X-Frame-Options: DENY` header in `next.config.ts` must be conditionally removed for `/embed/*` paths

## Out of Scope (Future)

- Customizable marker colors/icons per embed
- Embed analytics dashboard for organizations
- Premium embeds with custom branding (no DeaMap watermark)
