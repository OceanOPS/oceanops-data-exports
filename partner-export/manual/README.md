# Manual partner counts

Some networks cannot be counted reliably from PostgreSQL. For those, edit the JSON file here before `npm run export:partners`.

| File | Partner key | Map layer |
|------|-------------|-----------|
| `oceantrax.json` | `oceantrax` | Ocean TraX |

## Format

Use **reporting** ISO 3166-1 alpha-2 keys (same rules as `sql/_partner_country_iso.sql`):

- `CN` not `HK`, `EU` not `EN`
- do not include `AQ`, `UN`, `UNKNOWN`, `U-`

```json
{
  "AU": 2,
  "CN": 3,
  "US": 5
}
```

Keys starting with `_` are ignored.
