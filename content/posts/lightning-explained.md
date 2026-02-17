---
title: "Lightning Network in 5 Minutes"
type: post
slug: lightning-explained
price_sats: 100
published_date: "2026-02-10"
summary: "What the Lightning Network actually is, how it works, and why it matters — no jargon."
---

You've heard people say "just use Lightning" but what does that actually mean? Let me break it down without the usual crypto-bro jargon.

<!--more-->

## The problem Lightning solves

Bitcoin's base layer processes about 7 transactions per second. Visa does 65,000. That's not going to work for buying coffee.

Lightning is a second layer built on top of Bitcoin that handles small, fast payments — think milliseconds, not minutes.

## How it works (simply)

1. Two people open a **payment channel** by locking some Bitcoin in a shared address
2. They can now send payments back and forth instantly, updating the balance between them
3. When they're done, they close the channel and the final balance settles on-chain

The magic: you don't need a direct channel with everyone. Payments **route** through a network of channels, hopping from node to node until they reach the recipient.

## Why it matters

- **Speed:** Payments confirm in under a second
- **Cost:** Fees are fractions of a cent
- **Scale:** Millions of transactions per second, theoretically
- **Privacy:** Individual payments don't hit the public blockchain

## The catch

It's still early. Channel management can be fiddly. Liquidity isn't always where you need it. But tools like Alby Hub are making it dead simple — you press a button and you're running a Lightning node.

This blog runs on Lightning. That paywall you just paid? That was a Lightning payment. Pretty cool, right?
