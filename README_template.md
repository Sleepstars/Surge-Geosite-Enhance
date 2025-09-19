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

**Geosite Ruleset Index**

* JSON Format: `https://direct.sleepstars.de/geosite`
