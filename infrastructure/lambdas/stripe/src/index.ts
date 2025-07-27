import { APIGatewayProxyResult, Context } from 'aws-lambda'
import { createSuccessResponse, createErrorResponse } from './utils/response'
import Stripe from 'stripe'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

const secretsManagerClient = new SecretsManagerClient({ region: process.env.REGION })
const APP_SECRETS_ARN = process.env.APP_SECRETS_ARN!

let stripeSecretKey: string | undefined;
let stripeWebhookSecret: string | undefined;

async function getStripeSecrets() {
  if (stripeSecretKey && stripeWebhookSecret) {
    return { stripeSecretKey, stripeWebhookSecret };
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: APP_SECRETS_ARN });
    const data = await secretsManagerClient.send(command);
    if (data.SecretString) {
      const secrets = JSON.parse(data.SecretString);
      stripeSecretKey = secrets.stripeSecretKey;
      stripeWebhookSecret = secrets.stripeWebhookSecret;
      return { stripeSecretKey, stripeWebhookSecret };
    }
    throw new Error('Stripe secrets not found in Secrets Manager');
  } catch (error) {
    console.error('Error retrieving Stripe secrets from Secrets Manager:', error);
    throw new Error('Could not retrieve Stripe secrets');
  }
}

export const handler = async (
  event: any,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const { stripeSecretKey, stripeWebhookSecret } = await getStripeSecrets();
    
    if (!stripeSecretKey || !stripeWebhookSecret) {
      return createErrorResponse(500, 'Stripe configuration not available');
    }
    
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

    const sig = event.headers['stripe-signature'];
    let stripeEvent: Stripe.Event;

    try {
      stripeEvent = stripe.webhooks.constructEvent(event.body, sig, stripeWebhookSecret);
    } catch (err: any) {
      console.error('Stripe webhook signature verification failed:', err);
      return createErrorResponse(400, `Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        // TODO: Fulfill the purchase...
        console.log('Checkout session completed:', session);
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${stripeEvent.type}`);
    }

    return createSuccessResponse({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
} 