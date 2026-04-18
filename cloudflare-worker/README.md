# Cloudflare Worker — boda-fotos-presign

Generates presigned PUT URLs so the Angular frontend can upload files directly to R2.

## Endpoint

POST / — body: `{ "filename": "foto.jpg", "contentType": "image/jpeg" }`
Response: `{ "uploadUrl": "...", "key": "timestamp-uuid.jpg" }`

## Setup

See Task 1 of docs/superpowers/plans/2026-04-17-photo-upload.md

## Local dev (optional)

Install wrangler: `npm install -g wrangler`
Run locally: `wrangler dev index.js`
