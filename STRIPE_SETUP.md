# Stripe Dashboard Setup Instructions

Follow these exact steps to configure Stripe for Swoono PRO subscriptions.

## 1. Create Product "Swoono PRO"

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products** in the left sidebar
3. Click **+ Add product**
4. Fill out:
   - **Name**: `Swoono PRO`
   - **Description**: `Premium subscription for Swoono - A room for the two of you`
   - **Image**: Upload the Swoono icon if desired

## 2. Create Monthly Price ($4.99/month recurring)

1. In the product you just created, click **+ Add pricing**
2. Configure:
   - **Type**: `Recurring`
   - **Price**: `4.99`
   - **Currency**: `USD`
   - **Billing period**: `Monthly`
   - **Usage type**: `Licensed` (fixed price)
3. Click **Save pricing**
4. **Copy the Price ID** (starts with `price_`) - this is your `STRIPE_MONTHLY_PRICE_ID`

## 3. Create Yearly Price ($39.99/year recurring)

1. In the same product, click **+ Add pricing** again
2. Configure:
   - **Type**: `Recurring`
   - **Price**: `39.99`
   - **Currency**: `USD`
   - **Billing period**: `Yearly`
   - **Usage type**: `Licensed` (fixed price)
3. Click **Save pricing**
4. **Copy the Price ID** (starts with `price_`) - this is your `STRIPE_YEARLY_PRICE_ID`

## 4. Get API Keys

1. Navigate to **Developers** > **API keys**
2. **Copy the Publishable key** (starts with `pk_`) - this is your `VITE_STRIPE_PUBLISHABLE_KEY`
3. **Reveal and copy the Secret key** (starts with `sk_`) - this is your `STRIPE_SECRET_KEY`

## 5. Set Up Webhook Endpoint

1. Navigate to **Developers** > **Webhooks**
2. Click **+ Add endpoint**
3. Configure:
   - **Endpoint URL**: `https://swoono.onrender.com/api/stripe/webhook`
   - **Listen to**: `Events on your account`
   - **Select events**:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
4. Click **Add endpoint**
5. **Copy the Signing secret** (starts with `whsec_`) - this is your `STRIPE_WEBHOOK_SECRET`

## 6. Environment Variables for Render

Add these environment variables to your Render deployment:

### Server Environment Variables
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...
CLIENT_URL=https://swoono.onrender.com
```

### Client Environment Variables  
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_API_URL=https://swoono.onrender.com
```

## 7. Test the Integration

1. Use Stripe's test mode first with test API keys
2. Create test subscriptions using test card: `4242 4242 4242 4242`
3. Verify webhook events are received
4. Check Supabase tables are populated correctly
5. Switch to live mode when ready

## 8. Supabase Database Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Copy the contents of server/db/add-subscriptions.sql
```

Your Stripe integration is now ready! 🎉