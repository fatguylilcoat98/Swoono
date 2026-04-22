import express from 'express'
import Stripe from 'stripe'
import { db } from '../db'

const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Create checkout session
router.post('/create-checkout', async (req, res) => {
  try {
    const { clientId, roomCode, priceId, email } = req.body

    // Get or create customer
    let { data: customer } = await db()
      .from('customers')
      .select('*')
      .eq('client_id', clientId)
      .single()

    let stripeCustomerId = customer?.stripe_customer_id

    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email,
        metadata: { clientId, roomCode }
      })
      stripeCustomerId = stripeCustomer.id

      await db().from('customers').insert({
        client_id: clientId,
        room_code: roomCode,
        stripe_customer_id: stripeCustomerId,
        email
      })
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: { clientId, roomCode }
    })

    res.json({ url: session.url })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get subscription status
router.get('/subscription/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params

    const { data: customer } = await db()
      .from('customers')
      .select('*, subscriptions(*)')
      .eq('client_id', clientId)
      .single()

    if (!customer) {
      return res.json({ plan: 'free', status: 'inactive' })
    }

    const sub = customer.subscriptions?.[0]
    res.json({
      plan: sub?.plan || 'free',
      status: sub?.status || 'inactive',
      currentPeriodEnd: sub?.current_period_end
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    const { clientId } = req.body

    const { data: customer } = await db()
      .from('customers')
      .select('*, subscriptions(*)')
      .eq('client_id', clientId)
      .single()

    const sub = customer?.subscriptions?.[0]
    if (!sub?.stripe_subscription_id) {
      return res.status(404).json({ error: 'No subscription found' })
    }

    await stripe.subscriptions.update(
      sub.stripe_subscription_id,
      { cancel_at_period_end: true }
    )

    await db()
      .from('subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('id', sub.id)

    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Stripe webhook
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature']!
    let event: any

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err: any) {
      return res.status(400).json({ error: err.message })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const { clientId, roomCode } = session.metadata!

        const { data: customer } = await db()
          .from('customers')
          .select('id')
          .eq('client_id', clientId)
          .single()

        if (customer && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          await db().from('subscriptions').upsert({
            customer_id: customer.id,
            stripe_subscription_id: sub.id,
            stripe_price_id: sub.items.data[0].price.id,
            status: 'active',
            plan: 'pro',
            current_period_start: new Date(
              (sub as any).current_period_start * 1000
            ).toISOString(),
            current_period_end: new Date(
              (sub as any).current_period_end * 1000
            ).toISOString()
          })
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as any
        const status = sub.status === 'active' ? 'active' : 'inactive'
        const plan = sub.status === 'active' ? 'pro' : 'free'

        await db()
          .from('subscriptions')
          .update({ status, plan, cancel_at_period_end: sub.cancel_at_period_end })
          .eq('stripe_subscription_id', sub.id)
        break
      }
    }

    res.json({ received: true })
  }
)

export default router