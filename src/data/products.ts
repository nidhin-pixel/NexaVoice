export type ProductPlanId = 'starter' | 'business' | 'enterprise';

export interface ProductPlan {
  id: ProductPlanId;
  name: string;
  priceMonthly: number;
  currency: string;
  maxUsers: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export const PRODUCT_PLANS: ProductPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 999,
    currency: 'INR',
    maxUsers: 10,
    tagline: 'For small teams getting started',
    features: [
      'Up to 10 users',
      'Real-time voice AI agent',
      'Live transcript & prospect capture',
      'Email support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 2499,
    currency: 'INR',
    maxUsers: 50,
    tagline: 'For growing sales teams',
    highlight: true,
    features: [
      'Up to 50 users',
      'Advanced lead qualification',
      'Prospect intelligence & CRM sync',
      'Human escalation workflows',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 4999,
    currency: 'INR',
    maxUsers: 100,
    tagline: 'For large organizations',
    features: [
      'Up to 100 users',
      'Custom AI sales playbooks',
      'Dedicated success manager',
      'SSO & advanced security',
      '24/7 priority support',
    ],
  },
];

export function formatPrice(plan: ProductPlan): string {
  return `₹${plan.priceMonthly.toLocaleString('en-IN')}/month`;
}

export function getPlanById(id: ProductPlanId): ProductPlan | undefined {
  return PRODUCT_PLANS.find((p) => p.id === id);
}
