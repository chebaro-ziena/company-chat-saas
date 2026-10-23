
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// Company-specific permissions
export const companyRoleEnum = pgEnum('company_role', [
  'ADMIN',
  'TEAM_MEMBER',
]);

export const subscriptionPlanEnum = pgEnum(
  'subscription_plan',
  ['FREE', 'PAID'],
);

export const subscriptionStatusEnum = pgEnum(
  'subscription_status',
  ['PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED'],
);

// Company status
export const companyStatusEnum = pgEnum('company_status', [
  'ACTIVE',
  'SUSPENDED',
]);

// Companies
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull(),
    status: companyStatusEnum('status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('companies_slug_unique').on(table.slug),
  ],
);

// User accounts
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    isEmailVerified: boolean('is_email_verified').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
  ],
);

// Memberships connect users to companies
export const companyMemberships = pgTable(
  'company_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: companyRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('company_memberships_company_user_unique').on(
      table.companyId,
      table.userId,
    ),
    index('company_memberships_user_id_idx').on(table.userId),
  ],
);

// Products published by companies
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    imageUrl: text('image_url'),
    isPublished: boolean('is_published').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('products_company_id_idx').on(table.companyId),
    index('products_company_published_idx').on(
      table.companyId,
      table.isPublished,
    ),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    companyId: uuid('company_id')
      .references(() => companies.id, { onDelete: 'cascade' }),

    plan: subscriptionPlanEnum('plan').notNull().default('FREE'),

    status: subscriptionStatusEnum('status')
      .notNull()
      .default('PENDING'),

    providerSubscriptionId: varchar('provider_subscription_id', {
      length: 255,
    }),

    currentPeriodEnd: timestamp('current_period_end', {
      withTimezone: true,
    }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('subscriptions_company_id_unique').on(table.companyId),
    index('subscriptions_user_id_idx').on(table.userId),
    index('subscriptions_status_idx').on(table.status),
  ],
);