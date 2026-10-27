# WhatsApp deal agent

Send a screenshot or photo of a LinkedIn deal post to a WhatsApp number. The agent reads it with Claude and adds the transaction to an Excel table in OneDrive/SharePoint. Then it replies with what it saved.

```
WhatsApp → Twilio → this service (Railway) → Claude extracts the deal → Excel (Microsoft Graph)
                                     ↘ reply on WhatsApp: "✅ Added: PIDZ · Diana & Vesta · 940 m²"
```

**Fields captured:** tenant, building, address, city, size (m²), post date, transaction date (when stated), tenant broker (usually the poster), leasing broker(s), lease type, notes. The sender and the time it was added are captured too.

**Duplicates:** the same deal is often posted by both brokers. When a row already has the same tenant and building, the agent only fills its empty cells and adds any new leasing broker. It does not add a second row.

## 1. Excel sheet

1. Format the data as a table: select the header row and data, then **Insert → Table** and tick "My table has headers".
2. Column headers are matched automatically, in English or Dutch. Examples: _Company/Huurder_, _Building/Gebouw_, _Size/m²_, _Date/Datum_, _Tenant broker/Huurdersmakelaar_, _Leasing broker/Verhuurmakelaar_, _Notes_. For any other header name, set `COLUMN_MAP`; see `.env.example`.

## 2. Microsoft Entra app (may need IT)

1. In [entra.microsoft.com](https://entra.microsoft.com), go to **App registrations → New registration**. Name it "WhatsApp deal agent" and choose single tenant.
2. Go to **API permissions → Add → Microsoft Graph → Application permissions** and add `Files.ReadWrite.All`. Then click **Grant admin consent**, which needs an admin.
   - A stricter option: use `Sites.Selected` and have an admin grant the app write access to just the one SharePoint site.
3. Under **Certificates & secrets → New client secret**, copy the secret value.
4. Copy the **Directory (tenant) ID** and **Application (client) ID** from the Overview page.
5. In Excel, use **Share → Copy link** and set the link as `EXCEL_SHARE_URL`.

## 3. Twilio WhatsApp

1. Create an account at [twilio.com](https://www.twilio.com).
2. To test right away, use the sandbox at **Messaging → Try it out → Send a WhatsApp message**. Send the shown `join <code>` message from your phone to the sandbox number.
3. In **Sandbox settings**, set "When a message comes in" to `https://<your-railway-domain>/whatsapp` (POST).
4. For production, buy a Twilio number and register it as a WhatsApp sender (**Messaging → Senders → WhatsApp senders**). Then point its webhook to the same URL.

## 4. Railway

1. Create a service from this GitHub repo and set **Root Directory** to `/whatsapp-agent`. Set the config file path to `/whatsapp-agent/railway.json`.
2. Generate a domain for the service.
3. Set the variables from `.env.example`. `TWILIO_WEBHOOK_URL` must be exactly the URL entered in Twilio.
4. Deploy. `GET /health` returns `ok`.

The agent works without the Microsoft variables. It then extracts the deal and replies, but saves nothing. This lets you test WhatsApp and the extraction before IT approves the Entra app.

## Local

```sh
bun install
bun test
ANTHROPIC_API_KEY=... bun run extract screenshot.jpg   # extraction only
```
