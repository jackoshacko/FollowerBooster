// server/src/services/payments/providers.js
import {
  createCheckout,
  captureAndCredit,
  handleWebhook,
} from "./paypal.js";

export const paymentsProviders = {
  paypal: {
    createCheckout,
    captureAndCredit,
    handleWebhook,
  },
};
