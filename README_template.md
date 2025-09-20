# Surge Geosite Ruleset

Geosite Ruleset Converter for Surge

This project uses Cloudflare Workers to convert the repository's **prebuilt geosite JSON** (generated from [Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat)'s `geosite.dat`) into **Surge's Ruleset format** at request time — no runtime fetch from v2fly is required. For instance, you can convert the geosite entry:
```
geosite: apple@cn
```
into a Surge-compatible Ruleset using the following URL:
```
https://direct.sleepstars.de/geosite/apple@cn
```
This conversion ensures real-time updates and compatibility with Surge configurations.

---

**GeoIP Support**

- Endpoint: `https://direct.sleepstars.de/geoip/<name>[@v4|@v6]`
- Index JSON: `https://direct.sleepstars.de/geoip`
- Output format: plain text with `IP-CIDR` and `IP-CIDR6` lines.
- Examples: `.../geoip/cn`, `.../geoip/cn@v4`, `.../geoip/cn@v6`

**Geosite Ruleset Index**

* JSON Format: `https://direct.sleepstars.de/geosite`
* SRS Binary: `https://direct.sleepstars.de/srs/<name>[@cn|@!cn].srs`
-
