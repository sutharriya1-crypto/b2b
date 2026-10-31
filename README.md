# Bale to Brick

A marketplace that turns crop stubble into a resource instead of smoke.
Farmers list land to be cleared, buyers (brick kilns, biomass plants) pick land by region, crop and price,
and operators bid in a reverse auction to bale and haul it on time. The buyer seals the deal with the operator they prefer.

## Run it
Requires Node.js 22.13 or newer. No database server needed (uses Node's built-in SQLite).

    npm install
    cp .env.example .env   # optional: add Google keys
    npm start              # http://localhost:3000
    npm test               # end-to-end tests (Google features run against a mock Gemini)

On first start with an empty database, demo data is loaded (DEMO_SEED=0 to skip).
Demo accounts use the password demo1234: farmer@demo.in, farmer2@demo.in, buyer@demo.in, buyer2@demo.in,
operator@demo.in, operator2@demo.in, operator3@demo.in. With no SMS or email service set up, one-time codes
are shown on screen (demo mode).

Open **/#/tech** ("Built with Google" in the footer) to see which Google services are connected.

## Google technologies and where they are used

| Google service | What it does in Bale to Brick | Without a key |
|---|---|---|
| **Gemini API** (AI Studio) | Farmer describes land by voice or text in Hindi, Marwari, Mewari, Punjabi or English and the form fills itself (bigha, killa and hectare converted). Reads a photo of a Jamabandi or Khatauni: owner, Khasra numbers, area, and checks the name against the account. Writes the impact summary and baling tips in Hindi or English. | Hidden; Gemma takes over if running |
| **Gemma** (open model) | The same AI features offline, through Ollama on a laptop or field office server. | Off |
| **Google Maps Platform** | Satellite pin picker, Places search for villages, one map of all open land with the buyer's kiln, satellite view and directions on sealed deals. | Keyless map embeds, GPS and pasted links |
| **Routes API** | Road distance and drive time: operator's yard to field, field to kiln, plus a hauling cost. | Straight line x 1.3 |
| **Google Earth Engine** | Sentinel-2 NDVI/NDTI says whether the field is harvested; NASA FIRMS fire pixels prove zero burning from a week before the deal to completion. | NASA FIRMS direct for fire only |
| **Firebase Authentication** | Phone OTP for farmers (Firebase sends the SMS) and "Continue with Google" for buyers, verified on the server with the Admin SDK. | Built-in OTP (SMTP/Twilio/Fast2SMS or demo) |
| **Cloud Firestore** | Live bid boards and notification pings; bids appear on the buyer's screen instantly. | Server-Sent Events (also instant) |
| **Cloud Functions for Firebase** | `functions/` texts the winning operator and the farmer when a deal is sealed. | Server can text directly (SMS_ALERTS=1) |
| **Cloud Vision API** | Checks proof photos for a cleared field or bales, flags smoke or fire. | Gemini looks at the photo |
| **Vertex AI** | Suggests a fair job price (AutoML tabular regression trained on `npm run export-training`). | Local model learning from past deals |
| **Cloud Run + Firebase Hosting** | Container deploy (Dockerfile) served at `your-project.web.app` with HTTPS. | Run anywhere with Node |

Privacy is kept the same way throughout: before a deal, buyers and operators see only the village and a position
rounded to about 5 km; land-record photos are read and then discarded; Firestore holds only counts and statuses.

## Deploy on Google Cloud (Cloud Run + Firebase Hosting)

    gcloud run deploy bale-to-brick --source . --region asia-south1 --allow-unauthenticated \
      --max-instances 1 --set-env-vars OTP_DEV_MODE=1,GEMINI_API_KEY=...,GOOGLE_MAPS_API_KEY=...
    cp .firebaserc.example .firebaserc     # put your project id in it
    firebase deploy --only hosting,firestore:rules
    firebase deploy --only functions        # optional: SMS on deal sealed (set its secrets first)

Notes for Cloud Run: the SQLite file lives in the container, so data resets when the instance restarts
(fine for a demo; keep `--max-instances 1`). For a real launch, move to Cloud SQL or keep one instance with
a Cloud Storage volume and regular backups. Behind Firebase Hosting, Firestore carries the live updates.
Add your web.app and run.app addresses to the Maps key's allowed websites and to Firebase Auth's authorised domains.

## How a job moves
1. Farmer posts acres, crop, location and a clear-by date (speak it, or type it).
2. Buyer sets preferences; listings are ranked by match score and can be sorted by distance to the kiln.
3. Buyer picks a plot with a budget (Vertex AI suggests one) and deadline. Operators in that state are notified.
4. Operators bid price plus days. A revised bid must be lower, or the same price in fewer days.
5. Buyer accepts one bid live. Contact details, the exact pin and the road route unlock for the three parties.
6. Operator starts, adds proof photos (Vision-checked), finishes; the farmer confirms; a satellite zero-burn check can be run; farmer and buyer rate the operator.

## Payments, order tracking and auctions
- **Escrow payments** (`#/payments`): after a deal is sealed the buyer pays operator price + farmer's stubble price + platform fee (PLATFORM_FEE_PCT, default 1%) into escrow by UPI, net banking or card. Work can start only once money is held. Farmer's confirmation releases it to the operator and farmer; cancelling before work starts refunds the buyer. PAYMENT_GATEWAY=demo records everything without moving real money.
- **Order tracking** (`#/track`, `#/track/:id`): nine-step rail from deal sealed to payment released, acres-cleared meter and live field updates posted by the operator.
- **Reverse-auction hall** (`#/buyer/auctions`): every live auction with a price-drop chart against the budget, top three bids and one-tap accept.

## Layout
server.js (app, security headers) | src/api.js (marketplace rules) | src/api-google.js (Google feature routes)
src/google/ (ai, earth, firebase, routes, vertex, vision) | src/otp.js | src/live.js | src/estimate.js
public/ (single-page app, English and Hindi) | test/ | functions/ (Cloud Function) | firebase.json, firestore.rules, Dockerfile

## Not included yet
A live payment gateway (escrow runs on a demo gateway; swap `charge()` in `src/payments.js` for Razorpay/Cashfree) and an admin panel.
Before public launch: set a strong JWT_SECRET, use HTTPS, restrict all API keys, and back up the data.
