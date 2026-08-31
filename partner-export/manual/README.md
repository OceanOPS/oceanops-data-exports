# Manual partner counts

Some networks cannot be counted reliably from PostgreSQL. For those, edit the JSON file here before `npm run export:partners`.

| File | Partner key (internal) | Map layer |
|------|------------------------|-----------|
| `oceantrax.json` | `oceantrax` | Ocean TraX |

## Format

ISO 3166-1 alpha-2 keys, integer values:

```json
{
  "AU": 2,
  "US": 5,
  "FR": 1
}
```

Keys starting with `_` are ignored. Same ISO rollup rules as SQL export (`HK` → `CN`, etc.) apply on load.
