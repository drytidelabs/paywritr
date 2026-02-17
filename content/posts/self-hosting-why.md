---
title: "Why I Self-Host Everything (And You Should Too)"
type: post
slug: self-hosting-why
price_sats: 200
published_date: "2026-02-12"
summary: "Your data, your rules. A practical case for running your own services."
---

I run my own email, cloud storage, DNS, and now my blog's payment infrastructure. People think I'm paranoid. I think I'm practical.

<!--more-->

## The problem with "free"

If you're not paying for the product, you *are* the product. Gmail reads your emails to serve ads. Google Drive scans your files. Dropbox has had multiple breaches.

Self-hosting flips the equation: you pay in time and hardware, but you own the result completely.

## What I run

- **Email:** Stalwart Mail on a VPS — full JMAP/IMAP, spam filtering, works great
- **Storage:** Nextcloud on a mini PC at home with encrypted backups to Backblaze B2
- **DNS:** Pi-hole for ad blocking, plus my own authoritative DNS for my domains
- **Payments:** Alby Hub for Lightning — no KYC, no custodian, my keys

## The real cost

A $5/month VPS and a $150 mini PC handle 90% of it. The time investment is front-loaded — once things are running, they mostly just... run.

## The payoff

No one can deplatform me. No one can read my mail. No one can freeze my payments. That peace of mind is worth more than any subscription.
